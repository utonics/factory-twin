import { create } from 'zustand'
import type { StationStatus } from '../domain/types'
import type { AnalyticsSnapshot } from '../platform/processor'
import type { AreaId } from '../scene/areas'
import { processor, simulation } from '../runtime'
import { createSnapshot, type FactorySnapshot } from '../sim/snapshot'

export type CameraCommand = { type: 'zoomIn' | 'zoomOut' } | { type: 'focus'; areaId: AreaId }
export type ListTab = 'stations' | 'agvs' | 'orders' | 'alarms' | 'events'
/** AGV 상태 필터(비슷한 상태는 묶음) */
export type AgvFilter = 'all' | 'moving' | 'queued' | 'handling' | 'charging'

interface FactoryStore {
  selectedId: string | null
  speed: number
  paused: boolean
  /** 설비 운영 상태 요약(시뮬레이터) */
  snapshot: FactorySnapshot
  /** 데이터 처리 결과(OEE·알람·센서 시계열) */
  analytics: AnalyticsSnapshot
  listTab: ListTab
  area: AreaId
  /** 상태 필터: 해당 상태의 설비·AGV만 목록에 남기고 장면에서는 나머지를 흐리게 */
  stationFilter: StationStatus | 'all'
  agvFilter: AgvFilter
  delayedOnly: boolean
  /** 카메라 요청. nonce로 같은 요청의 반복을 구분한다. */
  cameraCommand: (CameraCommand & { nonce: number }) | null
  select: (id: string | null) => void
  setSpeed: (speed: number) => void
  togglePause: () => void
  refreshSnapshot: () => void
  setListTab: (tab: ListTab) => void
  setArea: (area: AreaId) => void
  setStationFilter: (filter: StationStatus | 'all') => void
  setAgvFilter: (filter: AgvFilter) => void
  setDelayedOnly: (value: boolean) => void
  acknowledgeAlarm: (id: number) => void
  sendCameraCommand: (command: CameraCommand) => void
}

export const useFactoryStore = create<FactoryStore>((set, get) => ({
  selectedId: null,
  speed: 1,
  paused: false,
  snapshot: createSnapshot(simulation),
  analytics: processor.snapshot(null),
  listTab: 'stations',
  area: 'all',
  stationFilter: 'all',
  agvFilter: 'all',
  delayedOnly: false,
  cameraCommand: null,
  select: (id) => set({ selectedId: id, analytics: processor.snapshot(id) }),
  setSpeed: (speed) => set({ speed, paused: false }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  refreshSnapshot: () => set({ snapshot: createSnapshot(simulation), analytics: processor.snapshot(get().selectedId) }),
  setListTab: (tab) => set({ listTab: tab }),
  setArea: (area) => set({ area, cameraCommand: { type: 'focus', areaId: area, nonce: Math.random() } }),
  setStationFilter: (filter) => set({ stationFilter: filter }),
  setAgvFilter: (filter) => set({ agvFilter: filter }),
  setDelayedOnly: (value) => set({ delayedOnly: value }),
  acknowledgeAlarm: (id) => {
    processor.acknowledge(id)
    set({ analytics: processor.snapshot(get().selectedId) })
  },
  sendCameraCommand: (command) => set({ cameraCommand: { ...command, nonce: Math.random() } }),
}))
