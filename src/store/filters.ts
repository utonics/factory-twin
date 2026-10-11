import type { AgvStatus, StationStatus } from '../domain/types'
import type { AgvFilter } from './useFactoryStore'

export const STATION_FILTERS: [StationStatus | 'all', string][] = [
  ['all', '전체'],
  ['processing', '가동'],
  ['idle', '대기'],
  ['blocked', '정체'],
  ['down', '고장'],
]

export const AGV_FILTERS: [AgvFilter, string][] = [
  ['all', '전체'],
  ['moving', '주행'],
  ['queued', '정체·대기'],
  ['handling', '적재·하역'],
  ['charging', '충전'],
]

const AGV_FILTER_STATUSES: Record<Exclude<AgvFilter, 'all'>, AgvStatus[]> = {
  moving: ['moving'],
  queued: ['queued', 'waiting'],
  handling: ['loading', 'unloading'],
  charging: ['charging'],
}

export function matchesStationFilter(status: StationStatus, filter: StationStatus | 'all'): boolean {
  return filter === 'all' || status === filter
}

export function matchesAgvFilter(status: AgvStatus, filter: AgvFilter): boolean {
  return filter === 'all' || AGV_FILTER_STATUSES[filter].includes(status)
}
