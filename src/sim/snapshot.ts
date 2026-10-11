import type {
  AgvStatus,
  CargoKind,
  FactoryEvent,
  ItemStage,
  StationKind,
  StationStatus,
  TruckStatus,
} from '../domain/types'
import type { FactorySimulation } from './engine'

// UI 패널용 직렬화 가능한 요약. 실제 데이터 연결 시 API 응답도 이 형태로 맞추면 된다.

export interface StationSnapshot {
  id: string
  name: string
  kind: StationKind
  lineId: string
  lineName: string
  status: StationStatus
  progress: number
  cycleTime: number
  currentCycleTime: number
  processed: number
  ngCount: number
  faultCount: number
  utilization: number
  repairRemaining: number
  statusSince: number
  itemStage: ItemStage | null
}

export interface AgvSnapshot {
  id: string
  name: string
  status: AgvStatus
  cargo: CargoKind | null
  cargoLineId: string | null
  battery: number
  speed: number
  odometer: number
  deliveries: number
  stopName: string | null
  task: string
}

export interface LineSnapshot {
  id: string
  name: string
  inputUnits: number
  inboundUnits: number
  palletFill: number
  palletSize: number
  readyPallets: number
  started: number
  completed: number
  rejected: number
}

export interface DockSnapshot {
  dockId: string
  dockName: string
  truckId: string
  plate: string
  status: TruckStatus
  load: number
  capacity: number
}

export interface ShippingSnapshot {
  staged: number
  stagingCapacity: number
  shippedPallets: number
  trucksDispatched: number
}

export interface WarehouseSnapshot {
  stock: number
  capacity: number
  /** 다음 입고까지 남은 시간(초) */
  nextInboundIn: number
  expedited: boolean
}

export interface FactoryKpis {
  produced: number
  throughputPerHour: number
  totalStations: number
  totalAgvs: number
  shippedPallets: number
  wip: number
}

export interface FactorySnapshot {
  time: number
  updatedAt: number
  stations: StationSnapshot[]
  agvs: AgvSnapshot[]
  lines: LineSnapshot[]
  docks: DockSnapshot[]
  shipping: ShippingSnapshot
  warehouse: WarehouseSnapshot
  kpis: FactoryKpis
  events: FactoryEvent[]
}

function agvTask(sim: FactorySimulation, cargo: CargoKind | null, cargoLineId: string | null, status: AgvStatus): string {
  const lineName = (id: string | null) => sim.layout.lines.find((l) => l.id === id)?.name ?? ''
  if (status === 'charging') return '충전 스테이션 대기'
  if (cargo === 'raw') return `원자재 → ${lineName(cargoLineId)} 투입구`
  if (cargo === 'finished') return `완제품 → 출하 적치장`
  if (cargoLineId) {
    // 아직 적재 전, 예약만 된 상태
    return status === 'loading' ? '적재 작업 중' : `${lineName(cargoLineId)} 운반 배정, 이동 중`
  }
  return '배정 대기 (순회)'
}

export function createSnapshot(sim: FactorySimulation): FactorySnapshot {
  const { state, layout } = sim
  const time = state.time
  const stopName = (id: string | null) => layout.agv.stops.find((s) => s.id === id)?.name ?? null

  const stations: StationSnapshot[] = layout.lines.flatMap((line) =>
    line.stations.map((spec) => {
      const st = state.stations[spec.id]
      return {
        id: spec.id,
        name: spec.name,
        kind: spec.kind,
        lineId: line.id,
        lineName: line.name,
        status: st.status,
        progress: st.progress,
        cycleTime: spec.cycleTime,
        currentCycleTime: st.currentCycleTime,
        processed: st.processed,
        ngCount: st.ngCount,
        faultCount: st.faultCount,
        utilization: time > 0 ? st.busyTime / time : 0,
        repairRemaining: st.repairRemaining,
        statusSince: st.statusSince,
        itemStage: st.itemId === null ? null : (state.items.get(st.itemId)?.stage ?? null),
      }
    }),
  )

  const agvs: AgvSnapshot[] = state.agvs.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    cargo: a.cargo,
    cargoLineId: a.cargoLineId,
    battery: a.battery,
    speed: a.speed,
    odometer: a.odometer,
    deliveries: a.deliveries,
    stopName: stopName(a.currentStopId),
    task: agvTask(sim, a.cargo, a.cargoLineId, a.status),
  }))

  const lines: LineSnapshot[] = layout.lines.map((spec) => {
    const l = state.lines[spec.id]
    return {
      id: spec.id,
      name: spec.name,
      inputUnits: l.inputUnits,
      inboundUnits: l.inboundUnits,
      palletFill: l.palletFill,
      palletSize: spec.palletSize,
      readyPallets: l.readyPallets,
      started: l.started,
      completed: l.completed,
      rejected: l.rejected,
    }
  })

  const produced = lines.reduce((sum, l) => sum + l.completed, 0)
  let wip = 0
  for (const item of state.items.values()) if (item.location.type !== 'reject') wip++

  const { shipping } = state
  return {
    time,
    updatedAt: Date.now(),
    stations,
    agvs,
    lines,
    docks: shipping.trucks.map((t) => ({
      dockId: t.dockId,
      dockName: layout.shipping.docks.find((d) => d.id === t.dockId)?.name ?? t.dockId,
      truckId: t.id,
      plate: t.plate,
      status: t.status,
      load: t.load,
      capacity: layout.shipping.truckCapacity,
    })),
    shipping: {
      staged: shipping.staged,
      stagingCapacity: layout.shipping.stagingCapacity,
      shippedPallets: shipping.shippedPallets,
      trucksDispatched: shipping.trucksDispatched,
    },
    warehouse: {
      stock: state.warehouse.stock,
      capacity: layout.warehouse.capacity,
      nextInboundIn: Math.max(0, state.warehouse.nextInboundAt - time),
      expedited: state.warehouse.expedited,
    },
    kpis: {
      produced,
      throughputPerHour: time > 0 ? (produced / time) * 3600 : 0,
      totalStations: stations.length,
      totalAgvs: agvs.length,
      shippedPallets: shipping.shippedPallets,
      wip,
    },
    events: state.events.slice(0, 12),
  }
}
