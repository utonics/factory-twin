import {
  DEFECT_TYPES,
  type AgvState,
  type AgvStopSpec,
  type DefectType,
  type EventLevel,
  type FactoryLayout,
  type FactoryState,
  type ItemStage,
  type LineSpec,
  type LineState,
  type OrderState,
  type PlantEvent,
  type StationKind,
  type StationSpec,
  type StationState,
  type StationStatus,
  type TruckState,
  type TruckStatus,
} from '../domain/types'
import { lineSegments, truckDockedX, TRUCK_OFFSCREEN_X } from './geometry'
import { LoopPath } from './loopPath'
import { createRng } from './random'

const STAGE_AFTER: Record<StationKind, ItemStage> = {
  cnc: 'machined',
  robot: 'welded',
  inspection: 'inspected',
  packaging: 'packed',
}

const EPS = 1e-4
const MAX_SUBSTEP = 0.05
const REJECT_DURATION = 1.6
const MAX_EVENTS = 40

const AGV_LOAD_TIME = 4
const AGV_DECISION_DISTANCE = 8
const AGV_DRAIN_PER_SEC = 0.06
const AGV_CHARGE_PER_SEC = 1.5
const AGV_LOW_BATTERY = 30
const AGV_RESUME_BATTERY = 60
/** 이 거리 안이면 '이미 지난 정류장'으로 보고 다음 정류장을 찾는다 */
const STOP_PASSED = 1e-3
/** 정차 예정 정류장까지 이 거리 안이면 도착 처리. STOP_PASSED보다 커야 정류장을 놓치지 않는다. */
const STOP_ARRIVE = 0.02

/** 불량 유형 발생 비중(DEFECT_TYPES 순서) */
const DEFECT_WEIGHTS = [0.4, 0.3, 0.2, 0.1]

const TRUCK_LOAD_INTERVAL = 3.5
/** 출발 후 다음 트럭이 오기까지(초) */
const TRUCK_AWAY_MIN = 60
const TRUCK_AWAY_MAX = 180

/** 고객 출하 오더: 평균 발생 간격(초), 팔레트 수, 납기 여유(초) */
const ORDER_MEAN_INTERVAL = 210
const ORDER_PALLETS = [2, 8]
const ORDER_LEAD_TIME = [300, 1080]
/** 시작 시점 오더의 추가 납기 여유(초) */
const INITIAL_ORDER_EXTRA_LEAD = 600
const CUSTOMERS = ['한빛모터스', '대성기계', '세진오토', '미래로보틱스', '동해산업', '나래전자']

/** 원자재 정기 입고 간격(초)·수량(팔레트), 긴급 발주 기준과 리드타임 */
const INBOUND_INTERVAL = [540, 1020]
const INBOUND_PALLETS = [18, 30]
const EXPEDITE_THRESHOLD = 32
const EXPEDITE_LEAD_TIME = 180

interface Segment {
  start: number
  end: number
  /** 앞(하류)쪽부터 정렬된 아이템 id */
  items: number[]
}

interface LineRuntime {
  spec: LineSpec
  segments: Segment[]
}

export interface SimulationOptions {
  seed?: number
  /** 시작 전에 미리 돌려 둘 시간(초). 화면이 처음부터 가동 중인 상태로 보이게 한다. */
  warmup?: number
}

/**
 * 공장 이산 시뮬레이터.
 * 렌더링과 무관한 순수 로직이며, step(dt)로 상태(state)를 진행시킨다.
 */
export class FactorySimulation {
  readonly layout: FactoryLayout
  readonly path: LoopPath
  readonly stopS: Record<string, number>
  readonly state: FactoryState

  private readonly rng: () => number
  private readonly runtimes: LineRuntime[]
  private readonly stationSpecs: Record<string, StationSpec> = {}
  private nextItemId = 1
  private nextEventId = 1
  private truckSeq = 0
  private orderSeq = 1000
  private nextOrderAt = 0
  private readonly listeners = new Set<(event: PlantEvent) => void>()

  constructor(layout: FactoryLayout, options: SimulationOptions = {}) {
    this.layout = layout
    this.rng = createRng(options.seed ?? 20261011)
    this.path = new LoopPath(layout.agv.corners, layout.agv.cornerRadius)
    this.stopS = Object.fromEntries(layout.agv.stops.map((stop) => [stop.id, this.path.project(stop.point)]))

    this.runtimes = layout.lines.map((spec) => ({
      spec,
      segments: lineSegments(spec).map((b) => ({ ...b, items: [] })),
    }))

    const stations: Record<string, StationState> = {}
    const lines: Record<string, LineState> = {}
    for (const line of layout.lines) {
      lines[line.id] = {
        id: line.id,
        inputUnits: line.inputCapacity,
        inboundUnits: 0,
        palletFill: 0,
        readyPallets: 0,
        reservedPickups: 0,
        started: 0,
        completed: 0,
        rejected: 0,
      }
      for (const spec of line.stations) {
        this.stationSpecs[spec.id] = spec
        stations[spec.id] = {
          id: spec.id,
          status: 'idle',
          progress: 0,
          itemId: null,
          currentCycleTime: spec.cycleTime,
          repairRemaining: 0,
          processed: 0,
          ngCount: 0,
          faultCount: 0,
          busyTime: 0,
          downTime: 0,
          lastResult: null,
          lastResultAt: -Infinity,
          statusSince: 0,
          // 설비마다 마모 시점이 겹치지 않도록 초기 마모를 흩뜨림
          wear: this.rng() * 0.5,
        }
      }
    }

    const agvs: AgvState[] = layout.agv.fleet.map((spec, i) => ({
      id: spec.id,
      name: spec.name,
      s: this.path.length * spec.startAt,
      speed: 0,
      status: 'moving',
      cargo: null,
      cargoLineId: null,
      plannedStopId: null,
      decidedStopId: null,
      currentStopId: null,
      taskRemaining: 0,
      taskDuration: 0,
      battery: 95 - i * 9,
      chargeUntil: 0,
      odometer: 0,
      deliveries: 0,
    }))

    this.state = {
      time: 0,
      items: new Map(),
      stations,
      lines,
      agvs,
      shipping: {
        staged: 2,
        shippedPallets: 0,
        trucksDispatched: 0,
        trucks: layout.shipping.docks.map((dock, i) => ({
          id: this.nextTruckId(),
          dockId: dock.id,
          plate: this.nextPlate(),
          // 첫 도크는 접안 상태로, 나머지는 시차를 두고 도착
          status: i === 0 ? 'docked' : 'away',
          x: i === 0 ? truckDockedX(layout) : TRUCK_OFFSCREEN_X,
          load: 0,
          timer: i === 0 ? TRUCK_LOAD_INTERVAL : 20 + i * 25,
        })),
      },
      warehouse: {
        stock: layout.warehouse.initialStock,
        nextInboundAt: this.uniform(INBOUND_INTERVAL),
        expedited: false,
      },
      orders: [],
      events: [],
    }
    // 시작 시점에 이미 접수된 오더 몇 건(라인이 채워지는 시간을 감안해 납기 여유를 더 줌)
    for (let i = 0; i < 4; i++) this.createOrder(INITIAL_ORDER_EXTRA_LEAD)
    this.nextOrderAt = this.exponential(ORDER_MEAN_INTERVAL)

    const warmup = options.warmup ?? 0
    if (warmup > 0) this.step(warmup)
  }

  /** 공장 이벤트 구독. 해제 함수를 돌려준다. */
  subscribe(listener: (event: PlantEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: PlantEvent): void {
    for (const listener of this.listeners) listener(event)
  }

  step(dt: number): void {
    let remaining = dt
    while (remaining > EPS) {
      const h = Math.min(remaining, MAX_SUBSTEP)
      this.tick(h)
      remaining -= h
    }
  }

  // ---------------------------------------------------------------- core

  private tick(h: number): void {
    this.state.time += h
    for (const rt of this.runtimes) this.tickLine(rt, h)
    this.tickAgvs(h)
    this.tickShipping(h)
    this.tickWarehouse()
    this.tickOrders()
  }

  private uniform([min, max]: number[]): number {
    return min + this.rng() * (max - min)
  }

  private exponential(mean: number): number {
    return -Math.log(1 - this.rng()) * mean
  }

  private log(level: EventLevel, sourceId: string, message: string): void {
    this.state.events.unshift({ id: this.nextEventId++, time: this.state.time, level, sourceId, message })
    if (this.state.events.length > MAX_EVENTS) this.state.events.length = MAX_EVENTS
  }

  // ---------------------------------------------------------------- 생산 라인

  private tickLine(rt: LineRuntime, h: number): void {
    const { spec, segments } = rt
    const line = this.state.lines[spec.id]
    const items = this.state.items

    // 1) 라인 끝: 완제품을 팔레트에 적재
    this.promotePallet(spec, line)
    const last = segments[segments.length - 1]
    const frontId = last.items[0]
    if (frontId !== undefined) {
      const item = items.get(frontId)!
      if (item.x >= last.end - EPS && line.palletFill < spec.palletSize) {
        last.items.shift()
        items.delete(frontId)
        line.palletFill++
        line.completed++
        this.emit({ type: 'unitCompleted', ts: this.state.time, lineId: spec.id, itemId: item.id, leadTime: this.state.time - item.startedAt })
        this.promotePallet(spec, line)
      }
    }

    // 2) 설비: 하류부터 처리해야 같은 틱에 빈자리가 전파된다
    for (let i = spec.stations.length - 1; i >= 0; i--) this.tickStation(rt, i, h)

    // 3) 컨베이어 이동(누적식: 앞 제품과 간격 유지)
    for (const seg of segments) {
      for (let j = 0; j < seg.items.length; j++) {
        const item = items.get(seg.items[j])!
        const limit = j === 0 ? seg.end : items.get(seg.items[j - 1])!.x - spec.itemSpacing
        item.x = Math.max(item.x, Math.min(item.x + spec.conveyorSpeed * h, limit))
      }
    }

    // 4) 투입: 투입 버퍼에서 원자재를 컨베이어에 올림
    if (line.inputUnits > 0 && this.canEnter(segments[0], spec)) {
      const id = this.nextItemId++
      items.set(id, {
        id,
        lineId: spec.id,
        stage: 'raw',
        x: segments[0].start,
        location: { type: 'segment', index: 0 },
        ng: false,
        startedAt: this.state.time,
      })
      segments[0].items.push(id)
      line.inputUnits--
      line.started++
    }

    // 5) 불량 배출 애니메이션이 끝난 제품 제거
    for (const item of items.values()) {
      if (item.lineId !== spec.id || item.location.type !== 'reject') continue
      item.location.elapsed += h
      if (item.location.elapsed >= REJECT_DURATION) items.delete(item.id)
    }
  }

  private promotePallet(spec: LineSpec, line: LineState): void {
    if (line.palletFill >= spec.palletSize && line.readyPallets < spec.outputSlots) {
      line.readyPallets++
      line.palletFill = 0
    }
  }

  private canEnter(seg: Segment, spec: LineSpec): boolean {
    const backId = seg.items[seg.items.length - 1]
    if (backId === undefined) return true
    return this.state.items.get(backId)!.x - seg.start >= spec.itemSpacing
  }

  private setStatus(st: StationState, status: StationStatus): void {
    if (st.status === status) return
    const prev = st.status
    st.status = status
    st.statusSince = this.state.time
    this.emit({ type: 'stationState', ts: this.state.time, stationId: st.id, lineId: this.stationSpecs[st.id].lineId, state: status, prev })
  }

  private pickDefect(): DefectType {
    let r = this.rng()
    for (let i = 0; i < DEFECT_TYPES.length; i++) {
      r -= DEFECT_WEIGHTS[i]
      if (r <= 0) return DEFECT_TYPES[i]
    }
    return DEFECT_TYPES[DEFECT_TYPES.length - 1]
  }

  private tickStation(rt: LineRuntime, index: number, h: number): void {
    const spec = rt.spec.stations[index]
    const st = this.state.stations[spec.id]
    const inSeg = rt.segments[index]
    const items = this.state.items

    if (st.status === 'down') {
      st.downTime += h
      st.repairRemaining -= h
      if (st.repairRemaining <= 0) {
        st.repairRemaining = 0
        // 수리 시 마모 부품 교체
        st.wear = 0.02 + this.rng() * 0.06
        // 고장은 가공 중에만 발생하므로 복구 후에는 하던 가공을 이어 간다
        this.setStatus(st, 'processing')
        this.log('info', spec.id, `${rt.spec.name} ${spec.name} 복구 완료`)
      }
      return
    }

    if (st.status === 'idle') {
      const frontId = inSeg.items[0]
      if (frontId === undefined) return
      const item = items.get(frontId)!
      if (item.x < inSeg.end - EPS) return
      inSeg.items.shift()
      item.location = { type: 'station', stationId: spec.id }
      item.x = spec.x
      st.itemId = item.id
      st.progress = 0
      st.currentCycleTime = spec.cycleTime * (1 + spec.cycleJitter * (this.rng() * 2 - 1))
      this.setStatus(st, 'processing')
      return
    }

    if (st.status === 'processing') {
      st.busyTime += h
      st.wear += spec.wearRate * h
      // 고장 위험은 마모의 세제곱에 비례해 커진다(마모 0.5 → 기준의 0.75배, 1.0 → 4.25배)
      if (this.rng() < (h / spec.mtbf) * (0.25 + 4 * st.wear ** 3)) {
        st.faultCount++
        st.repairRemaining = spec.mttr * (0.6 + this.rng() * 0.8)
        this.setStatus(st, 'down')
        this.log('error', spec.id, `${rt.spec.name} ${spec.name} 고장 발생`)
        return
      }
      st.progress = Math.min(1, st.progress + h / st.currentCycleTime)
      if (st.progress < 1) return
      const item = items.get(st.itemId!)!
      item.stage = STAGE_AFTER[spec.kind]
      let defect: DefectType | null = null
      if (spec.kind === 'inspection') {
        item.ng = this.rng() < (spec.ngRate ?? 0)
        if (item.ng) defect = this.pickDefect()
        st.lastResult = item.ng ? 'ng' : 'ok'
        st.lastResultAt = this.state.time
      }
      this.emit({
        type: 'cycleComplete',
        ts: this.state.time,
        stationId: spec.id,
        lineId: rt.spec.id,
        itemId: item.id,
        cycleTime: st.currentCycleTime,
        idealCycleTime: spec.cycleTime,
        result: item.ng ? 'ng' : 'ok',
        defect,
      })
      this.setStatus(st, 'blocked')
    }

    // blocked: 다음 구간에 자리가 나면 배출
    const item = items.get(st.itemId!)!
    const line = this.state.lines[rt.spec.id]
    if (item.ng) {
      item.location = { type: 'reject', elapsed: 0 }
      line.rejected++
      st.ngCount++
      this.log('warn', spec.id, `${rt.spec.name} 검사 불량 배출 (#${item.id})`)
    } else {
      const outSeg = rt.segments[index + 1]
      if (!this.canEnter(outSeg, rt.spec)) return
      item.location = { type: 'segment', index: index + 1 }
      item.x = outSeg.start
      outSeg.items.push(item.id)
    }
    st.processed++
    st.itemId = null
    st.progress = 0
    this.setStatus(st, 'idle')
  }

  // ---------------------------------------------------------------- AGV 물류

  /** 처리 대기 중인 운반 수요(자재 보충 + 완제품 회수) */
  transportDemand(): number {
    let demand = 0
    for (const spec of this.layout.lines) {
      const line = this.state.lines[spec.id]
      if (line.inputUnits + line.inboundUnits + spec.palletSize <= spec.inputCapacity) demand++
      demand += line.readyPallets - line.reservedPickups
    }
    return demand
  }

  private tickAgvs(h: number): void {
    for (const agv of this.state.agvs) {
      switch (agv.status) {
        case 'loading':
        case 'unloading':
          agv.taskRemaining -= h
          if (agv.taskRemaining <= 0) this.completeTask(agv)
          break
        case 'waiting':
          if (this.state.shipping.staged < this.layout.shipping.stagingCapacity) this.beginTask(agv, 'unloading')
          break
        case 'charging':
          agv.battery = Math.min(100, agv.battery + AGV_CHARGE_PER_SEC * h)
          if (agv.battery >= agv.chargeUntil && this.transportDemand() > 0) this.depart(agv)
          break
        default:
          this.drive(agv, h)
      }
    }
  }

  private nextStop(agv: AgvState): { stop: AgvStopSpec; distance: number } {
    let best = this.layout.agv.stops[0]
    let bestDistance = Infinity
    for (const stop of this.layout.agv.stops) {
      const d = this.path.forwardDistance(agv.s, this.stopS[stop.id])
      if (d > STOP_PASSED && d < bestDistance) {
        best = stop
        bestDistance = d
      }
    }
    return { stop: best, distance: bestDistance }
  }

  private drive(agv: AgvState, h: number): void {
    const cfg = this.layout.agv
    const { stop, distance } = this.nextStop(agv)

    if (distance < AGV_DECISION_DISTANCE && agv.decidedStopId !== stop.id) {
      agv.decidedStopId = stop.id
      agv.plannedStopId = this.decideStop(agv, stop) ? stop.id : null
    }

    let gap = Infinity
    for (const other of this.state.agvs) {
      if (other === agv) continue
      const d = this.path.forwardDistance(agv.s, other.s)
      if (d > 0 && d < gap) gap = d
    }

    const stopping = agv.plannedStopId === stop.id
    let target = Math.min(cfg.speed, Math.sqrt(Math.max(0, 2 * cfg.accel * (gap - cfg.safeGap))))
    if (stopping) target = Math.min(target, Math.max(0.5, Math.sqrt(2 * cfg.accel * distance)))
    agv.speed = agv.speed < target ? Math.min(target, agv.speed + cfg.accel * h) : Math.max(target, agv.speed - cfg.accel * 2 * h)

    let move = agv.speed * h
    const maxMove = Math.max(0, gap - cfg.safeGap * 0.8)
    if (move > maxMove) {
      move = maxMove
      agv.speed = Math.min(agv.speed, move / h)
    }

    if (stopping && move >= distance - STOP_ARRIVE) {
      agv.odometer += distance
      agv.s = this.stopS[stop.id]
      agv.speed = 0
      this.arrive(agv, stop)
      return
    }

    agv.s = this.path.wrap(agv.s + move)
    agv.odometer += move
    if (move > 0) agv.battery = Math.max(0, agv.battery - AGV_DRAIN_PER_SEC * h)
    agv.status = agv.speed < 0.05 ? 'queued' : 'moving'
  }

  private decideStop(agv: AgvState, stop: AgvStopSpec): boolean {
    switch (stop.kind) {
      case 'warehouse': {
        if (agv.cargo !== null || agv.cargoLineId !== null) return false
        if (this.state.warehouse.stock < 1) return false
        let pick: LineSpec | null = null
        let pickLevel = Infinity
        for (const spec of this.layout.lines) {
          const line = this.state.lines[spec.id]
          const level = line.inputUnits + line.inboundUnits
          if (level + spec.palletSize <= spec.inputCapacity && level < pickLevel) {
            pick = spec
            pickLevel = level
          }
        }
        if (!pick) return false
        this.state.lines[pick.id].inboundUnits += pick.palletSize
        // 출고 예약과 동시에 재고 차감
        this.state.warehouse.stock--
        agv.cargoLineId = pick.id
        return true
      }
      case 'lineInput':
        return agv.cargo === 'raw' && agv.cargoLineId === stop.lineId
      case 'lineOutput': {
        if (agv.cargo !== null || agv.cargoLineId !== null) return false
        const line = this.state.lines[stop.lineId!]
        if (line.readyPallets - line.reservedPickups <= 0) return false
        line.reservedPickups++
        agv.cargoLineId = line.id
        return true
      }
      case 'shipping':
        return agv.cargo === 'finished'
      case 'park':
        return agv.cargo === null && agv.cargoLineId === null && (agv.battery < AGV_LOW_BATTERY || this.transportDemand() === 0)
    }
  }

  private arrive(agv: AgvState, stop: AgvStopSpec): void {
    agv.currentStopId = stop.id
    agv.plannedStopId = null
    switch (stop.kind) {
      case 'warehouse':
      case 'lineOutput':
        this.beginTask(agv, 'loading')
        break
      case 'lineInput':
        this.beginTask(agv, 'unloading')
        break
      case 'shipping':
        if (this.state.shipping.staged < this.layout.shipping.stagingCapacity) this.beginTask(agv, 'unloading')
        else agv.status = 'waiting'
        break
      case 'park':
        agv.status = 'charging'
        // 배터리 부족으로 들어오면 일정 수준까지 충전, 일이 없어 쉬러 온 경우는 수요가 생기면 바로 출발
        agv.chargeUntil = agv.battery < AGV_LOW_BATTERY ? AGV_RESUME_BATTERY : 0
        if (agv.chargeUntil > 0) this.log('warn', agv.id, `${agv.name} 배터리 부족, 충전 시작`)
        break
    }
  }

  private beginTask(agv: AgvState, status: 'loading' | 'unloading'): void {
    agv.status = status
    agv.taskDuration = AGV_LOAD_TIME
    agv.taskRemaining = AGV_LOAD_TIME
  }

  private completeTask(agv: AgvState): void {
    const stop = this.layout.agv.stops.find((s) => s.id === agv.currentStopId)!
    switch (stop.kind) {
      case 'warehouse':
        agv.cargo = 'raw'
        break
      case 'lineInput': {
        const spec = this.layout.lines.find((l) => l.id === stop.lineId)!
        const line = this.state.lines[spec.id]
        line.inputUnits += spec.palletSize
        line.inboundUnits -= spec.palletSize
        agv.cargo = null
        agv.cargoLineId = null
        agv.deliveries++
        break
      }
      case 'lineOutput': {
        const line = this.state.lines[stop.lineId!]
        line.readyPallets--
        line.reservedPickups--
        agv.cargo = 'finished'
        break
      }
      case 'shipping':
        this.state.shipping.staged++
        agv.cargo = null
        agv.cargoLineId = null
        agv.deliveries++
        break
      case 'park':
        break
    }
    this.depart(agv)
  }

  private depart(agv: AgvState): void {
    agv.status = 'moving'
    agv.currentStopId = null
    agv.taskRemaining = 0
  }

  // ---------------------------------------------------------------- 출하

  private nextPlate(): string {
    const n = Math.floor(1000 + this.rng() * 9000)
    return `경기 ${80 + Math.floor(this.rng() * 19)}사 ${n}`
  }

  private nextTruckId(): string {
    this.truckSeq++
    return `TRK-${String(this.truckSeq).padStart(3, '0')}`
  }

  private setTruckStatus(truck: TruckState, status: TruckStatus): void {
    truck.status = status
    this.emit({ type: 'truckState', ts: this.state.time, truckId: truck.id, dockId: truck.dockId, state: status, load: truck.load })
  }

  private tickShipping(h: number): void {
    for (const truck of this.state.shipping.trucks) this.tickTruck(truck, h)
  }

  private tickTruck(truck: TruckState, h: number): void {
    const shipping = this.state.shipping
    const dockedX = truckDockedX(this.layout)
    const capacity = this.layout.shipping.truckCapacity
    const dockName = this.layout.shipping.docks.find((d) => d.id === truck.dockId)?.name ?? truck.dockId

    switch (truck.status) {
      case 'away':
        truck.timer -= h
        if (truck.timer <= 0) {
          truck.id = this.nextTruckId()
          truck.plate = this.nextPlate()
          truck.x = TRUCK_OFFSCREEN_X
          truck.load = 0
          this.setTruckStatus(truck, 'arriving')
        }
        break
      case 'arriving': {
        const speed = Math.min(9, Math.max(1.2, (truck.x - dockedX) * 0.9))
        truck.x = Math.max(dockedX, truck.x - speed * h)
        if (truck.x <= dockedX) {
          truck.timer = TRUCK_LOAD_INTERVAL
          this.setTruckStatus(truck, 'docked')
          this.log('info', truck.id, `출하 트럭 ${truck.id} ${dockName} 접안`)
        }
        break
      }
      case 'docked':
        if (shipping.staged > 0 && truck.load < capacity) {
          truck.timer -= h
          if (truck.timer <= 0) {
            shipping.staged--
            truck.load++
            truck.timer = TRUCK_LOAD_INTERVAL
          }
        }
        if (truck.load >= capacity) {
          truck.timer = 0
          shipping.shippedPallets += truck.load
          shipping.trucksDispatched++
          this.setTruckStatus(truck, 'departing')
          this.log('info', truck.id, `출하 트럭 ${truck.id} 출발 (팔레트 ${truck.load}개)`)
          this.allocateShipment(truck)
        }
        break
      case 'departing':
        truck.timer += h
        truck.x += Math.min(10, 0.5 + truck.timer * 2.5) * h
        if (truck.x >= TRUCK_OFFSCREEN_X) {
          truck.timer = this.uniform([TRUCK_AWAY_MIN, TRUCK_AWAY_MAX])
          truck.load = 0
          this.setTruckStatus(truck, 'away')
        }
        break
    }
  }

  // ---------------------------------------------------------------- 출하 오더

  private createOrder(extraLead = 0): void {
    const now = this.state.time
    const order: OrderState = {
      id: `SO-${++this.orderSeq}`,
      customer: CUSTOMERS[Math.floor(this.rng() * CUSTOMERS.length)],
      pallets: Math.round(this.uniform(ORDER_PALLETS)),
      shipped: 0,
      createdAt: now,
      dueAt: now + extraLead + this.uniform(ORDER_LEAD_TIME),
    }
    this.state.orders.push(order)
    this.emit({ type: 'orderCreated', ts: now, orderId: order.id, customer: order.customer, pallets: order.pallets, dueAt: order.dueAt })
  }

  private tickOrders(): void {
    while (this.state.time >= this.nextOrderAt) {
      this.createOrder()
      this.nextOrderAt += this.exponential(ORDER_MEAN_INTERVAL)
    }
  }

  /** 출발 트럭의 팔레트를 납기가 빠른 오더부터 배정. 남는 팔레트는 물류센터 재고 보충분 */
  private allocateShipment(truck: TruckState): void {
    let remaining = truck.load
    const open = [...this.state.orders].sort((a, b) => a.dueAt - b.dueAt)
    for (const order of open) {
      if (remaining <= 0) break
      const n = Math.min(remaining, order.pallets - order.shipped)
      order.shipped += n
      remaining -= n
      const completed = order.shipped >= order.pallets
      this.emit({ type: 'orderShipped', ts: this.state.time, orderId: order.id, truckId: truck.id, pallets: n, completed })
      if (completed) {
        this.state.orders.splice(this.state.orders.indexOf(order), 1)
        if (this.state.time > order.dueAt) this.log('warn', truck.id, `오더 ${order.id}(${order.customer}) 납기 지연 출하`)
      }
    }
  }

  // ---------------------------------------------------------------- 자재 입고

  private tickWarehouse(): void {
    const wh = this.state.warehouse
    const now = this.state.time
    if (!wh.expedited && wh.stock < EXPEDITE_THRESHOLD && wh.nextInboundAt - now > EXPEDITE_LEAD_TIME) {
      wh.expedited = true
      wh.nextInboundAt = now + EXPEDITE_LEAD_TIME
      this.log('warn', 'WH', `원자재 재고 ${wh.stock}팔레트, 긴급 발주`)
    }
    if (now < wh.nextInboundAt) return
    const pallets = Math.min(this.layout.warehouse.capacity - wh.stock, Math.round(this.uniform(INBOUND_PALLETS)))
    wh.stock += pallets
    this.emit({ type: 'materialReceived', ts: now, pallets, expedited: wh.expedited })
    this.log('info', 'WH', `원자재 ${pallets}팔레트 입고${wh.expedited ? ' (긴급)' : ''}`)
    wh.expedited = false
    wh.nextInboundAt = now + this.uniform(INBOUND_INTERVAL)
  }
}
