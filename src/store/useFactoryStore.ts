import { create } from 'zustand'
import type { AnalyticsSnapshot } from '../platform/processor'
import { processor, simulation } from '../runtime'
import { createSnapshot, type FactorySnapshot } from '../sim/snapshot'

export type CameraCommand = 'zoomIn' | 'zoomOut' | 'home'
export type ListTab = 'stations' | 'agvs' | 'alarms' | 'events'

interface FactoryStore {
  selectedId: string | null
  speed: number
  paused: boolean
  /** 설비 운영 상태 요약(시뮬레이터) */
  snapshot: FactorySnapshot
  /** 데이터 처리 결과(OEE·알람·센서 시계열) */
  analytics: AnalyticsSnapshot
  listTab: ListTab
  /** 카메라 버튼 요청. 장면의 카메라 리그가 처리 후 비운다. */
  cameraCommand: { type: CameraCommand; nonce: number } | null
  select: (id: string | null) => void
  setSpeed: (speed: number) => void
  togglePause: () => void
  refreshSnapshot: () => void
  setListTab: (tab: ListTab) => void
  acknowledgeAlarm: (id: number) => void
  sendCameraCommand: (type: CameraCommand) => void
}

export const useFactoryStore = create<FactoryStore>((set, get) => ({
  selectedId: null,
  speed: 1,
  paused: false,
  snapshot: createSnapshot(simulation),
  analytics: processor.snapshot(null),
  listTab: 'stations',
  cameraCommand: null,
  select: (id) => set({ selectedId: id, analytics: processor.snapshot(id) }),
  setSpeed: (speed) => set({ speed, paused: false }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  refreshSnapshot: () => set({ snapshot: createSnapshot(simulation), analytics: processor.snapshot(get().selectedId) }),
  setListTab: (tab) => set({ listTab: tab }),
  acknowledgeAlarm: (id) => {
    processor.acknowledge(id)
    set({ analytics: processor.snapshot(get().selectedId) })
  },
  sendCameraCommand: (type) => set({ cameraCommand: { type, nonce: Math.random() } }),
}))
