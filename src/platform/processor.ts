import { SENSOR_CATALOG, STOCK_TAGS, type AssetKind, type SensorSpec } from '../data/sensorCatalog'
import { DEFECT_TYPES, type DefectType, type FactoryLayout, type PlantEvent, type StationStatus, type TruckStatus } from '../domain/types'
import { AlarmEngine, type AlarmRecord } from './alarms'
import type { MessageBus, PlantMessage, TelemetryMessage } from './bus'
import { RingBuffer } from './ringBuffer'

/** 시계열 보관 길이(초) — 1초 샘플 기준 10분 */
const SERIES_SECONDS = 600
/** 예지 보전 추세 계산 창(초)과 최소 표본 수 */
const TREND_WINDOW = 300
const TREND_MIN_SAMPLES = 40
/** 임계치 도달 예상 시간을 보여 줄 최대 범위(초) */
const ETA_HORIZON = 3600
/** 생산 추이 집계 단위(초)와 표시 개수 */
export const BUCKET_SECONDS = 300
export const BUCKET_COUNT = 12
const LEAD_TIME_SAMPLES = 50
const RATE_WINDOW = 60
/** 완료 오더 보관 개수 */
const ORDER_HISTORY = 40

interface AssetInfo {
  id: string
  name: string
  kind: AssetKind
  lineId: string | null
  sensors: SensorSpec[]
}

interface StationAccount {
  state: StationStatus
  since: number
  downTime: number
  total: number
  ng: number
  idealTime: number
}

interface LineAccount {
  /** 병목(기준 사이클이 가장 긴) 설비 */
  bottleneckId: string
  idealCycle: number
  good: number
  ng: number
  buckets: Map<number, { good: number; ng: number }>
  defects: Record<DefectType, number>
  leadTimes: number[]
}

export interface OeeBreakdown {
  oee: number
  availability: number
  performance: number
  quality: number
}

export interface StationAnalytics {
  oee: OeeBreakdown
  /** 건강도(0~1). 추세 표본이 부족하면 null */
  health: number | null
  /** 위험 임계치 도달 예상(초). 악화 추세가 아니면 null */
  etaSeconds: number | null
  latest: Record<string, number>
}

export interface LineAnalytics extends OeeBreakdown {
  good: number
  ng: number
  leadTimeAvg: number | null
  buckets: { start: number; good: number; ng: number }[]
  defects: { type: DefectType; count: number }[]
}

export interface OrderView {
  id: string
  customer: string
  pallets: number
  shipped: number
  createdAt: number
  dueAt: number
  completedAt: number | null
  /** 납기를 넘겼는지(완료 오더는 완료 시각 기준, 미완료는 현재 기준) */
  late: boolean
}

export interface OrderAnalytics {
  list: OrderView[]
  open: number
  overdueOpen: number
  completed: number
  completedOnTime: number
  /** 납기 준수율(완료 오더 기준). 완료 오더가 없으면 null */
  onTimeRate: number | null
}

export interface LogisticsAnalytics {
  docksInUse: number
  dockCount: number
  /** 도크로 오가거나 접안 중인 트럭 */
  activeTrucks: number
  /** 재고 부족 알림(창고 재고·라인 투입 자재) */
  stockAlerts: number
}

export interface SeriesData {
  spec: SensorSpec
  points: [number, number][]
}

export interface AnalyticsSnapshot {
  time: number
  messageCount: number
  messagesPerMinute: number
  alarms: AlarmRecord[]
  activeAlarmCount: { warn: number; crit: number; unacknowledged: number }
  plant: OeeBreakdown
  orders: OrderAnalytics
  logistics: LogisticsAnalytics
  lines: Record<string, LineAnalytics>
  stations: Record<string, StationAnalytics>
  /** 선택된 자산의 센서 시계열(선택이 없거나 라인이면 null) */
  selectedSeries: { assetId: string; series: SeriesData[] } | null
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** 최소제곱 직선(기울기, 마지막 시각의 추정값) */
export function linearTrend(points: [number, number][]): { slope: number; fitted: number } | null {
  const n = points.length
  if (n < 2) return null
  let st = 0
  let sv = 0
  for (const [t, v] of points) {
    st += t
    sv += v
  }
  const mt = st / n
  const mv = sv / n
  let num = 0
  let den = 0
  for (const [t, v] of points) {
    num += (t - mt) * (v - mv)
    den += (t - mt) ** 2
  }
  if (den === 0) return null
  const slope = num / den
  return { slope, fitted: mv + slope * (points[n - 1][0] - mt) }
}

/**
 * 데이터 처리기: 버스의 메시지만 보고(시뮬레이터 내부를 참조하지 않음)
 * 시계열 저장, 알람, OEE, 생산 추이, 불량 파레토, 예지 보전 지표를 계산한다.
 */
export class DataProcessor {
  readonly alarms = new AlarmEngine()
  private readonly assets = new Map<string, AssetInfo>()
  private readonly series = new Map<string, RingBuffer>()
  private readonly trends = new Map<string, RingBuffer>()
  private readonly latest = new Map<string, Record<string, number>>()
  private readonly stationAccounts = new Map<string, StationAccount>()
  private readonly lineAccounts = new Map<string, LineAccount>()
  private readonly rate: { second: number; count: number }[] = []
  private readonly orders = new Map<string, OrderView>()
  private readonly docks = new Map<string, TruckStatus>()
  private startTs: number | null = null
  private now = 0
  private messageCount = 0

  constructor(private readonly layout: FactoryLayout, bus: MessageBus) {
    for (const line of layout.lines) {
      const bottleneck = line.stations.reduce((a, b) => (b.cycleTime > a.cycleTime ? b : a))
      this.lineAccounts.set(line.id, {
        bottleneckId: bottleneck.id,
        idealCycle: bottleneck.cycleTime,
        good: 0,
        ng: 0,
        buckets: new Map(),
        defects: Object.fromEntries(DEFECT_TYPES.map((d) => [d, 0])) as Record<DefectType, number>,
        leadTimes: [],
      })
      for (const spec of line.stations) {
        this.assets.set(spec.id, { id: spec.id, name: `${line.name} ${spec.name}`, kind: spec.kind, lineId: line.id, sensors: SENSOR_CATALOG[spec.kind] })
        this.stationAccounts.set(spec.id, { state: 'idle', since: 0, downTime: 0, total: 0, ng: 0, idealTime: 0 })
      }
    }
    for (const agv of layout.agv.fleet) {
      this.assets.set(agv.id, { id: agv.id, name: agv.name, kind: 'agv', lineId: null, sensors: SENSOR_CATALOG.agv })
    }
    this.assets.set('WH', { id: 'WH', name: '자재창고', kind: 'warehouse', lineId: null, sensors: SENSOR_CATALOG.warehouse })
    for (const line of layout.lines) {
      this.assets.set(line.id, { id: line.id, name: line.name, kind: 'line', lineId: line.id, sensors: SENSOR_CATALOG.line })
    }
    for (const dock of layout.shipping.docks) this.docks.set(dock.id, 'away')
    bus.subscribe((message) => this.handle(message))
  }

  handle(message: PlantMessage): void {
    if (this.startTs === null) {
      this.startTs = message.ts
      for (const account of this.stationAccounts.values()) account.since = message.ts
    }
    this.now = Math.max(this.now, message.ts)
    this.messageCount++
    this.countRate(message.ts)
    if (message.kind === 'telemetry') this.onTelemetry(message)
    else this.onEvent(message.event)
  }

  acknowledge(alarmId: number): void {
    this.alarms.acknowledge(alarmId)
  }

  /** 장면 표시용: 자산의 현재 알람 등급(0 없음, 1 경고, 2 위험) */
  alarmLevel(assetId: string): 0 | 1 | 2 {
    return this.alarms.levelOf(assetId)
  }

  // ------------------------------------------------------------ 수집

  private countRate(ts: number): void {
    const second = Math.floor(ts)
    const last = this.rate[this.rate.length - 1]
    if (last && last.second === second) last.count++
    else this.rate.push({ second, count: 1 })
    while (this.rate.length > 0 && this.rate[0].second <= second - RATE_WINDOW) this.rate.shift()
  }

  private buffer(map: Map<string, RingBuffer>, key: string, capacity: number): RingBuffer {
    let buf = map.get(key)
    if (!buf) {
      buf = new RingBuffer(capacity)
      map.set(key, buf)
    }
    return buf
  }

  private onTelemetry(m: TelemetryMessage): void {
    const asset = this.assets.get(m.assetId)
    if (!asset) return
    this.latest.set(m.assetId, m.values)
    for (const spec of asset.sensors) {
      const value = m.values[spec.tag]
      if (value === undefined) continue
      this.buffer(this.series, `${m.assetId}:${spec.tag}`, SERIES_SECONDS).push(m.ts, value)
      if (spec.whileRunning && !m.running) continue
      if (spec.health) this.buffer(this.trends, m.assetId, TREND_WINDOW).push(m.ts, value)
      this.alarms.evaluate(m.ts, m.assetId, asset.name, spec, value)
    }
  }

  private onEvent(event: PlantEvent): void {
    switch (event.type) {
      case 'stationState': {
        const account = this.stationAccounts.get(event.stationId)
        if (!account) return
        if (account.state === 'down') account.downTime += event.ts - account.since
        account.state = event.state
        account.since = event.ts
        const asset = this.assets.get(event.stationId)!
        if (event.state === 'down') this.alarms.setFault(event.ts, asset.id, asset.name, true)
        else if (event.prev === 'down') this.alarms.setFault(event.ts, asset.id, asset.name, false)
        break
      }
      case 'cycleComplete': {
        const account = this.stationAccounts.get(event.stationId)
        if (!account) return
        account.total++
        account.idealTime += event.idealCycleTime
        if (event.result === 'ng') {
          account.ng++
          const line = this.lineAccounts.get(event.lineId)!
          line.ng++
          this.bucket(line, event.ts).ng++
          if (event.defect) line.defects[event.defect]++
        }
        break
      }
      case 'unitCompleted': {
        const line = this.lineAccounts.get(event.lineId)
        if (!line) return
        line.good++
        this.bucket(line, event.ts).good++
        line.leadTimes.push(event.leadTime)
        if (line.leadTimes.length > LEAD_TIME_SAMPLES) line.leadTimes.shift()
        break
      }
      case 'truckState':
        this.docks.set(event.dockId, event.state)
        break
      case 'orderCreated':
        this.orders.set(event.orderId, {
          id: event.orderId,
          customer: event.customer,
          pallets: event.pallets,
          shipped: 0,
          createdAt: event.ts,
          dueAt: event.dueAt,
          completedAt: null,
          late: false,
        })
        break
      case 'orderShipped': {
        const order = this.orders.get(event.orderId)
        if (!order) return
        order.shipped += event.pallets
        if (event.completed) {
          order.completedAt = event.ts
          order.late = event.ts > order.dueAt
          this.completedCount++
          if (!order.late) this.completedOnTime++
          this.trimOrders()
        }
        break
      }
      case 'materialReceived':
        break
    }
  }

  /** 완료 오더는 최근 ORDER_HISTORY건만 보관(납기 준수 집계는 누적 카운터로 유지) */
  private completedCount = 0
  private completedOnTime = 0

  private trimOrders(): void {
    const done = [...this.orders.values()].filter((o) => o.completedAt !== null)
    if (done.length > ORDER_HISTORY) {
      done.sort((a, b) => a.completedAt! - b.completedAt!)
      for (const o of done.slice(0, done.length - ORDER_HISTORY)) this.orders.delete(o.id)
    }
  }

  private bucket(line: LineAccount, ts: number): { good: number; ng: number } {
    const key = Math.floor(ts / BUCKET_SECONDS)
    let b = line.buckets.get(key)
    if (!b) {
      b = { good: 0, ng: 0 }
      line.buckets.set(key, b)
      for (const k of line.buckets.keys()) if (k <= key - BUCKET_COUNT) line.buckets.delete(k)
    }
    return b
  }

  // ------------------------------------------------------------ 계산

  private planned(): number {
    return Math.max(1e-6, this.now - (this.startTs ?? this.now))
  }

  private runTime(a: StationAccount): number {
    const down = a.downTime + (a.state === 'down' ? this.now - a.since : 0)
    return Math.max(1e-6, this.planned() - down)
  }

  /** 설비 OEE. 자재 대기·후공정 정체 시간은 성능 손실로 집계된다. */
  private stationOee(id: string): OeeBreakdown {
    const a = this.stationAccounts.get(id)!
    const planned = this.planned()
    const runTime = this.runTime(a)
    const availability = clamp01(runTime / planned)
    const performance = clamp01(a.idealTime / runTime)
    const quality = a.total > 0 ? (a.total - a.ng) / a.total : 1
    return { oee: availability * performance * quality, availability, performance, quality }
  }

  /**
   * 라인 OEE는 병목 설비 기준으로 계산한다(버퍼가 있어 다른 설비 정지는 라인 출력에 바로 영향을 주지 않음).
   * A·P·Q의 곱 = 양품 수 × 병목 기준 사이클 / 계획 시간
   */
  private lineOee(line: LineAccount): OeeBreakdown {
    const planned = this.planned()
    const runTime = this.runTime(this.stationAccounts.get(line.bottleneckId)!)
    const total = line.good + line.ng
    const availability = clamp01(runTime / planned)
    const performance = clamp01((line.idealCycle * total) / runTime)
    const quality = total > 0 ? line.good / total : 1
    return { oee: availability * performance * quality, availability, performance, quality }
  }

  private prediction(asset: AssetInfo): { health: number | null; etaSeconds: number | null } {
    const spec = asset.sensors.find((s) => s.health)
    const buf = this.trends.get(asset.id)
    if (!spec?.limits || !buf) return { health: null, etaSeconds: null }
    const points = buf.toArray(this.now - TREND_WINDOW)
    if (points.length < TREND_MIN_SAMPLES) return { health: null, etaSeconds: null }
    const trend = linearTrend(points)
    if (!trend) return { health: null, etaSeconds: null }
    const { crit, direction } = spec.limits
    const health = clamp01((crit - trend.fitted) / (crit - spec.nominal))
    const worsening = direction === 'high' ? trend.slope > 0 : trend.slope < 0
    const eta = worsening ? (crit - trend.fitted) / trend.slope : Infinity
    return { health, etaSeconds: eta > 0 && eta < ETA_HORIZON ? eta : null }
  }

  private orderAnalytics(): OrderAnalytics {
    const list = [...this.orders.values()].map((o) => ({ ...o, late: o.completedAt === null ? this.now > o.dueAt : o.late }))
    const open = list.filter((o) => o.completedAt === null).sort((a, b) => a.dueAt - b.dueAt)
    const done = list.filter((o) => o.completedAt !== null).sort((a, b) => b.completedAt! - a.completedAt!)
    return {
      list: [...open, ...done],
      open: open.length,
      overdueOpen: open.filter((o) => o.late).length,
      completed: this.completedCount,
      completedOnTime: this.completedOnTime,
      onTimeRate: this.completedCount > 0 ? this.completedOnTime / this.completedCount : null,
    }
  }

  snapshot(selectedId: string | null): AnalyticsSnapshot {
    const lines: Record<string, LineAnalytics> = {}
    const currentBucket = Math.floor(this.now / BUCKET_SECONDS)
    for (const spec of this.layout.lines) {
      const line = this.lineAccounts.get(spec.id)!
      const buckets: LineAnalytics['buckets'] = []
      for (let k = currentBucket - BUCKET_COUNT + 1; k <= currentBucket; k++) {
        if (k < 0) continue
        const b = line.buckets.get(k)
        buckets.push({ start: k * BUCKET_SECONDS, good: b?.good ?? 0, ng: b?.ng ?? 0 })
      }
      lines[spec.id] = {
        ...this.lineOee(line),
        good: line.good,
        ng: line.ng,
        leadTimeAvg: line.leadTimes.length > 0 ? line.leadTimes.reduce((s, v) => s + v, 0) / line.leadTimes.length : null,
        buckets,
        defects: DEFECT_TYPES.map((type) => ({ type, count: line.defects[type] })).sort((a, b) => b.count - a.count),
      }
    }
    const lineList = Object.values(lines)
    const avg = (key: keyof OeeBreakdown) => lineList.reduce((s, l) => s + l[key], 0) / Math.max(1, lineList.length)

    const stations: Record<string, StationAnalytics> = {}
    for (const id of this.stationAccounts.keys()) {
      const asset = this.assets.get(id)!
      stations[id] = { oee: this.stationOee(id), ...this.prediction(asset), latest: this.latest.get(id) ?? {} }
    }

    const records = this.alarms.records()
    const active = records.filter((a) => a.clearedAt === null)
    const ordered = [
      ...active.sort((a, b) => (a.level === b.level ? b.raisedAt - a.raisedAt : a.level === 'crit' ? -1 : 1)),
      ...records.filter((a) => a.clearedAt !== null),
    ]

    const selected = selectedId ? this.assets.get(selectedId) : undefined
    return {
      time: this.now,
      messageCount: this.messageCount,
      messagesPerMinute: this.rate.reduce((s, r) => s + r.count, 0) * (60 / RATE_WINDOW),
      alarms: ordered.map((a) => ({ ...a })),
      activeAlarmCount: {
        warn: active.filter((a) => a.level === 'warn').length,
        crit: active.filter((a) => a.level === 'crit').length,
        unacknowledged: active.filter((a) => !a.acknowledged).length,
      },
      plant: { oee: avg('oee'), availability: avg('availability'), performance: avg('performance'), quality: avg('quality') },
      orders: this.orderAnalytics(),
      logistics: {
        docksInUse: [...this.docks.values()].filter((s) => s === 'docked').length,
        dockCount: this.docks.size,
        activeTrucks: [...this.docks.values()].filter((s) => s !== 'away').length,
        stockAlerts: active.filter((a) => STOCK_TAGS.includes(a.tag)).length,
      },
      lines,
      stations,
      selectedSeries: selected
        ? {
            assetId: selected.id,
            series: selected.sensors.map((spec) => ({ spec, points: this.series.get(`${selected.id}:${spec.tag}`)?.toArray() ?? [] })),
          }
        : null,
    }
  }
}
