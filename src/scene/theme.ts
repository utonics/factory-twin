import type { AgvStatus, StationStatus } from '../domain/types'
import { useFactoryStore } from '../store/useFactoryStore'

export const COLORS = {
  background: '#e8edf4',
  ground: '#dfe5ed',
  floor: '#f3f5f8',
  wall: '#fbfcfd',
  primary: '#2f5bea',
  accent: '#f5b301',
  steel: '#9aa4b2',
  steelDark: '#5b6472',
  charcoal: '#2c323b',
  belt: '#3a404a',
  white: '#ffffff',
  glass: '#bcd3ff',
  cardboard: '#d6a56b',
  pallet: '#b98a55',
  rawPart: '#8c99ab',
  machined: '#cfd6df',
  welded: '#4f74e8',
  tree: '#66c28f',
  trunk: '#8a6a4f',
  marking: '#f2c230',
  ok: '#22b573',
  ng: '#ef4444',
}

export const STATION_STATUS_COLOR: Record<StationStatus, string> = {
  processing: '#22b573',
  idle: '#f5b301',
  blocked: '#f08c1a',
  down: '#ef4444',
}

export const AGV_STATUS_COLOR: Record<AgvStatus, string> = {
  moving: '#2f5bea',
  queued: '#f5b301',
  loading: '#22b573',
  unloading: '#22b573',
  waiting: '#f08c1a',
  charging: '#8b5cf6',
}

/** 컨베이어 벨트 상면 높이 */
export const BELT_Y = 0.85

/** 화면 연출용 시간 증분: 일시정지·배속을 반영 */
export function sceneDelta(delta: number): number {
  const { paused, speed } = useFactoryStore.getState()
  return paused ? 0 : Math.min(delta, 0.1) * speed
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
