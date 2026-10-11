// 공장 도메인 모델.
// Spec 타입은 변하지 않는 레이아웃(설비 배치·사양), State 타입은 매 순간 바뀌는 운영 상태다.
// 지금은 시뮬레이터가 State를 만들지만, 이후 MES/PLC 데이터 어댑터가 같은 State를 채우면
// 3D 장면과 UI는 그대로 재사용된다.

export type Vec2 = { x: number; z: number }

export type StationKind = 'cnc' | 'robot' | 'inspection' | 'packaging'
export type StationStatus = 'idle' | 'processing' | 'blocked' | 'down'
export type ItemStage = 'raw' | 'machined' | 'welded' | 'inspected' | 'packed'
export type CargoKind = 'raw' | 'finished'
export type AgvStatus = 'moving' | 'queued' | 'loading' | 'unloading' | 'waiting' | 'charging'
export type AgvStopKind = 'warehouse' | 'lineInput' | 'lineOutput' | 'shipping'
export type TruckStatus = 'away' | 'arriving' | 'docked' | 'departing'
export type EventLevel = 'info' | 'warn' | 'error'

// ---------- 레이아웃(정적) ----------

export interface StationSpec {
  id: string
  lineId: string
  name: string
  kind: StationKind
  /** 라인 축(x) 위의 중심 위치 */
  x: number
  /** 기준 사이클 타임(초) */
  cycleTime: number
  /** 사이클 타임 변동 폭(0~1) */
  cycleJitter: number
  /** 평균 고장 간격(가동 초) */
  mtbf: number
  /** 평균 수리 시간(초) */
  mttr: number
  /** 검사 공정 불량률(0~1) */
  ngRate?: number
  /** 가공 1초당 마모 증가량. 마모가 쌓일수록 센서 값이 나빠지고 고장 확률이 오른다. */
  wearRate: number
}

export interface LineSpec {
  id: string
  name: string
  /** 라인이 놓인 z 좌표 */
  z: number
  xStart: number
  xEnd: number
  /** 공정 순서대로 정렬 */
  stations: StationSpec[]
  conveyorSpeed: number
  itemSpacing: number
  /** 설비가 차지하는 컨베이어 길이 */
  stationLength: number
  /** 투입 버퍼 최대 수량 */
  inputCapacity: number
  /** 팔레트 1개당 수량 */
  palletSize: number
  /** 완제품 팔레트 대기 슬롯 수 */
  outputSlots: number
}

export interface AgvStopSpec {
  id: string
  kind: AgvStopKind
  name: string
  lineId?: string
  point: Vec2
}

/** 순환로 밖 충전 베이. 본선에서 분기해 들어가 충전하고 다시 합류한다(드라이브스루형). */
export interface ChargingBaySpec {
  id: string
  name: string
  /** 베이 중심 x 좌표 */
  x: number
}

export interface ChargingSpec {
  /** 분기·합류하는 본선 차선의 z 좌표 */
  laneZ: number
  /** 베이가 놓인 z 좌표 */
  bayZ: number
  /** 베이 중심에서 분기점·합류점까지 x 거리 */
  halfSpan: number
  bays: ChargingBaySpec[]
}

export interface AgvSpec {
  id: string
  name: string
  /** 순환 경로상의 시작 비율(0~1) */
  startAt: number
}

export interface DockSpec {
  id: string
  name: string
  /** 도크 중심 z 좌표 */
  z: number
}

export interface FactoryLayout {
  name: string
  floor: { minX: number; maxX: number; minZ: number; maxZ: number }
  lines: LineSpec[]
  agv: {
    /** 진행 방향 순서의 꼭짓점(닫힌 경로) */
    corners: Vec2[]
    cornerRadius: number
    speed: number
    accel: number
    safeGap: number
    stops: AgvStopSpec[]
    charging: ChargingSpec
    fleet: AgvSpec[]
  }
  warehouse: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
    pickup: Vec2
    /** 랙 보관 가능 팔레트 수 */
    capacity: number
    initialStock: number
  }
  shipping: {
    stagingOrigin: Vec2
    stagingCapacity: number
    truckCapacity: number
    dockX: number
    docks: DockSpec[]
  }
}

// ---------- 운영 상태(동적) ----------

export type ItemLocation =
  | { type: 'segment'; index: number }
  | { type: 'station'; stationId: string }
  | { type: 'reject'; elapsed: number }

export interface ItemState {
  id: number
  lineId: string
  stage: ItemStage
  /** 라인 축 위치 */
  x: number
  location: ItemLocation
  /** 비전 검사 불량 판정 여부 */
  ng: boolean
  /** 라인 투입 시각 */
  startedAt: number
}

export interface StationState {
  id: string
  status: StationStatus
  /** 현재 사이클 진행률 0~1 */
  progress: number
  itemId: number | null
  currentCycleTime: number
  repairRemaining: number
  processed: number
  ngCount: number
  faultCount: number
  busyTime: number
  downTime: number
  lastResult: 'ok' | 'ng' | null
  lastResultAt: number
  statusSince: number
  /** 누적 마모(0~). 수리 시 초기화 */
  wear: number
}

export interface LineState {
  id: string
  inputUnits: number
  /** AGV가 운반 중인 투입 예정 수량 */
  inboundUnits: number
  /** 적재 중인 완제품 팔레트 수량 */
  palletFill: number
  readyPallets: number
  reservedPickups: number
  started: number
  completed: number
  rejected: number
}

export interface AgvState {
  id: string
  name: string
  /** 순환 경로 위 위치(호 길이). 분기선에 있을 때는 분기점 위치에 머문다 */
  s: number
  /** 본선(loop) 또는 충전 분기선(spur) 주행 중 */
  track: 'loop' | 'spur'
  /** 예약·사용 중인 충전 베이 번호 */
  bay: number | null
  /** 분기선 위 위치(호 길이) */
  spurS: number
  speed: number
  status: AgvStatus
  cargo: CargoKind | null
  cargoLineId: string | null
  /** 정차 예정 정류장 */
  plannedStopId: string | null
  /** 정차 결정을 이미 내린 정류장 */
  decidedStopId: string | null
  currentStopId: string | null
  /** 현재 작업(적재·하역) 남은 시간과 전체 시간 */
  taskRemaining: number
  taskDuration: number
  battery: number
  /** 충전 중 이 수준(%)에 도달하기 전에는 출발하지 않음 */
  chargeUntil: number
  odometer: number
  deliveries: number
}

export interface TruckState {
  id: string
  dockId: string
  plate: string
  status: TruckStatus
  /** 트럭 중심 x 좌표 */
  x: number
  load: number
  timer: number
}

export interface ShippingState {
  staged: number
  shippedPallets: number
  trucksDispatched: number
  /** 도크마다 트럭 1대가 접안·출발을 반복 */
  trucks: TruckState[]
}

export interface WarehouseState {
  /** 원자재 재고(팔레트) */
  stock: number
  nextInboundAt: number
  /** 긴급 발주가 걸려 있는지 */
  expedited: boolean
}

/** 고객 출하 오더(미완료만 보관) */
export interface OrderState {
  id: string
  customer: string
  pallets: number
  shipped: number
  createdAt: number
  dueAt: number
}

export interface FactoryEvent {
  id: number
  time: number
  level: EventLevel
  sourceId: string
  message: string
}

export interface FactoryState {
  /** 시뮬레이션 경과 시간(초) */
  time: number
  items: Map<number, ItemState>
  stations: Record<string, StationState>
  lines: Record<string, LineState>
  agvs: AgvState[]
  shipping: ShippingState
  warehouse: WarehouseState
  orders: OrderState[]
  events: FactoryEvent[]
}

// ---------- 공장 이벤트(설비에서 발생해 데이터 플랫폼으로 전달) ----------

export const DEFECT_TYPES = ['용접 기공', '치수 불량', '표면 스크래치', '이물 혼입'] as const
export type DefectType = (typeof DEFECT_TYPES)[number]

export type PlantEvent =
  | { type: 'stationState'; ts: number; stationId: string; lineId: string; state: StationStatus; prev: StationStatus }
  | {
      type: 'cycleComplete'
      ts: number
      stationId: string
      lineId: string
      itemId: number
      cycleTime: number
      idealCycleTime: number
      result: 'ok' | 'ng'
      defect: DefectType | null
    }
  | { type: 'unitCompleted'; ts: number; lineId: string; itemId: number; leadTime: number }
  | { type: 'truckState'; ts: number; truckId: string; dockId: string; state: TruckStatus; load: number }
  | { type: 'orderCreated'; ts: number; orderId: string; customer: string; pallets: number; dueAt: number }
  | { type: 'orderShipped'; ts: number; orderId: string; truckId: string; pallets: number; completed: boolean }
  | { type: 'materialReceived'; ts: number; pallets: number; expedited: boolean }
