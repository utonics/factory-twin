import { TELEMETRY_INTERVAL } from '../data/sensorCatalog'
import type { PlantEvent, StationKind, StationSpec, StationState } from '../domain/types'
import type { MessageBus } from '../platform/bus'
import type { FactorySimulation } from './engine'
import { createRng } from './random'

const SUBSTEP = 0.05

/** 1차 지연(온도처럼 서서히 따라가는 값) */
function approach(current: number, target: number, tau: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / tau))
}

/**
 * 가상 공장: 시뮬레이터에 가상 센서를 붙여, 실제 설비처럼 텔레메트리와 이벤트를 버스로 발행한다.
 * 센서 값은 설비 상태와 마모(wear)로부터 만들어지므로 고장 전에 이상 징후가 데이터에 먼저 나타난다.
 */
export class VirtualPlant {
  private readonly rng: () => number
  private readonly temps = new Map<string, number>()
  private nextSampleAt = 0
  private started = false

  constructor(
    readonly simulation: FactorySimulation,
    private readonly bus: MessageBus,
    seed = 777,
  ) {
    this.rng = createRng(seed)
    simulation.subscribe((event) => this.publishEvent(event))
    this.nextSampleAt = simulation.state.time
  }

  step(dt: number): void {
    if (!this.started) {
      this.started = true
      this.publishInitialState()
    }
    let remaining = dt
    while (remaining > 1e-6) {
      const h = Math.min(remaining, SUBSTEP)
      this.simulation.step(h)
      this.integrate(h)
      remaining -= h
      if (this.simulation.state.time >= this.nextSampleAt) {
        this.sample()
        this.nextSampleAt += TELEMETRY_INTERVAL
      }
    }
  }

  /** 근사 정규분포 잡음 */
  private noise(): number {
    return (this.rng() + this.rng() + this.rng() - 1.5) * 1.15
  }

  private topicOf(area: string, assetId: string, kind: 'telemetry' | 'event'): string {
    return `f01/${area}/${assetId}/${kind}`
  }

  /** 이벤트 출처별 토픽: 설비·라인은 라인 아래, 물류는 logistics, 주문은 erp */
  private eventTopic(event: PlantEvent): string {
    switch (event.type) {
      case 'stationState':
      case 'cycleComplete':
        return this.topicOf(event.lineId, event.stationId, 'event')
      case 'unitCompleted':
        return this.topicOf(event.lineId, event.lineId, 'event')
      case 'truckState':
        return this.topicOf('logistics', event.dockId, 'event')
      case 'materialReceived':
        return this.topicOf('logistics', 'WH', 'event')
      case 'orderCreated':
      case 'orderShipped':
        return this.topicOf('erp', event.orderId, 'event')
    }
  }

  private publishEvent(event: PlantEvent): void {
    this.bus.publish({ kind: 'event', topic: this.eventTopic(event), ts: event.ts, event })
  }

  /**
   * 이벤트는 변경분만 전하므로, 첫 진행 시 현재 상태 전체를 한 번 발행한다
   * (실설비 연동에서 접속 직후 받는 초기 상태와 같은 역할).
   */
  private publishInitialState(): void {
    const { state, layout } = this.simulation
    const ts = state.time
    for (const line of layout.lines) {
      for (const spec of line.stations) {
        const status = state.stations[spec.id].status
        this.publishEvent({ type: 'stationState', ts, stationId: spec.id, lineId: line.id, state: status, prev: status })
      }
    }
    for (const truck of state.shipping.trucks) {
      this.publishEvent({ type: 'truckState', ts, truckId: truck.id, dockId: truck.dockId, state: truck.status, load: truck.load })
    }
    for (const order of state.orders) {
      this.publishEvent({ type: 'orderCreated', ts, orderId: order.id, customer: order.customer, pallets: order.pallets, dueAt: order.dueAt })
    }
  }

  /** 온도처럼 시간에 따라 누적되는 물리량 적분 */
  private integrate(h: number): void {
    for (const line of this.simulation.layout.lines) {
      for (const spec of line.stations) {
        const st = this.simulation.state.stations[spec.id]
        const running = st.status === 'processing'
        const target = this.temperatureTarget(spec.kind, running, st.wear)
        if (target === null) continue
        const current = this.temps.get(spec.id) ?? target
        this.temps.set(spec.id, approach(current, target, spec.kind === 'robot' ? 90 : 60, h))
      }
    }
  }

  private temperatureTarget(kind: StationKind, running: boolean, wear: number): number | null {
    switch (kind) {
      case 'cnc':
        return running ? 48 + 18 * wear : 30
      case 'robot':
        return running ? 52 + 15 * wear : 32
      case 'packaging':
        return running ? 45 + 18 * wear : 30
      default:
        return null
    }
  }

  private stationValues(spec: StationSpec, st: StationState): Record<string, number> {
    const running = st.status === 'processing'
    const w = st.wear
    const n = () => this.noise()
    const temp = this.temps.get(spec.id) ?? 30
    switch (spec.kind) {
      case 'cnc': {
        const cutting = running && st.progress > 0.12 && st.progress < 0.88
        return {
          vibration: Math.max(0, running ? 1.6 + 5.2 * w ** 1.6 + n() * 0.22 : 0.25 + n() * 0.05),
          spindleTemp: temp + n() * 0.3,
          spindleLoad: Math.max(0, running ? 62 + 25 * w + n() * 3 : 4 + n()),
          spindleSpeed: cutting ? 8000 + n() * 40 : running ? 1200 : 0,
        }
      }
      case 'robot': {
        const welding = running && st.progress > 0.14 && st.progress < 0.86
        return {
          jointTorque: Math.max(0, running ? 55 + 40 * w ** 1.5 + n() * 2.5 : 10 + n()),
          motorTemp: temp + n() * 0.3,
          weldCurrent: welding ? 205 + n() * 6 : 0,
        }
      }
      case 'inspection':
        return {
          lightLevel: Math.min(100, 100 - 32 * w ** 1.4 + n() * 0.6),
          inspectTime: running ? 420 + 80 * w + n() * 15 : 0,
        }
      case 'packaging': {
        const pressing = running && st.progress > 0.25 && st.progress < 0.75
        return {
          airPressure: 6.1 - 1.3 * w ** 1.5 - (pressing ? 0.12 : 0) + n() * 0.04,
          motorTemp: temp + n() * 0.3,
        }
      }
    }
  }

  private sample(): void {
    const { state, layout } = this.simulation
    const ts = state.time
    for (const line of layout.lines) {
      for (const spec of line.stations) {
        const st = state.stations[spec.id]
        this.bus.publish({
          kind: 'telemetry',
          topic: this.topicOf(line.id, spec.id, 'telemetry'),
          ts,
          assetId: spec.id,
          running: st.status === 'processing',
          values: this.stationValues(spec, st),
        })
      }
    }
    // 재고 계측: 창고 원자재 재고, 라인 투입 버퍼
    this.bus.publish({ kind: 'telemetry', topic: this.topicOf('logistics', 'WH', 'telemetry'), ts, assetId: 'WH', running: true, values: { stock: state.warehouse.stock } })
    for (const line of layout.lines) {
      this.bus.publish({
        kind: 'telemetry',
        topic: this.topicOf(line.id, line.id, 'telemetry'),
        ts,
        assetId: line.id,
        running: true,
        values: { inputUnits: state.lines[line.id].inputUnits },
      })
    }
    for (const agv of state.agvs) {
      this.bus.publish({
        kind: 'telemetry',
        topic: this.topicOf('logistics', agv.id, 'telemetry'),
        ts,
        assetId: agv.id,
        running: agv.status === 'moving',
        values: { battery: agv.battery, speed: agv.speed },
      })
    }
  }
}
