import type { AgvStatus, ItemStage, StationKind, StationStatus, TruckStatus } from '../domain/types'

export const STATION_STATUS_LABEL: Record<StationStatus, string> = {
  processing: '가동',
  idle: '대기(자재 없음)',
  blocked: '정체(후공정 대기)',
  down: '고장',
}

export const STATION_KIND_LABEL: Record<StationKind, string> = {
  cnc: 'CNC 가공',
  robot: '로봇 용접',
  inspection: '비전 검사',
  packaging: '자동 포장',
}

export const AGV_STATUS_LABEL: Record<AgvStatus, string> = {
  moving: '주행',
  queued: '정체 대기',
  loading: '적재 중',
  unloading: '하역 중',
  waiting: '적치 공간 대기',
  charging: '충전 중',
}

export const TRUCK_STATUS_LABEL: Record<TruckStatus, string> = {
  away: '배차 대기',
  arriving: '도크 진입',
  docked: '상차 중',
  departing: '출발',
}

export const ITEM_STAGE_LABEL: Record<ItemStage, string> = {
  raw: '원자재',
  machined: '가공품',
  welded: '용접품',
  inspected: '검사 완료품',
  packed: '포장품',
}

/** 시뮬레이션 0초 = 08:00 근무 시작 */
const SHIFT_START = 8 * 3600

export function formatClock(simSeconds: number): string {
  const total = Math.floor(SHIFT_START + simSeconds) % 86400
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s}초`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}분 ${s % 60}초` : `${Math.floor(m / 60)}시간 ${m % 60}분`
}

export function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}
