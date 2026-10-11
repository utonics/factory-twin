import type { AgvState, CargoKind } from '../domain/types'
import { simulation } from '../runtime'

export const AGV_DECK_Y = 0.42
export const AGV_LIFT_STROKE = 0.14

/** 화면에 보일 적재물: 적재 작업 중이면 실을 화물을 미리 보여 준다 */
export function displayedCargo(agv: AgvState): CargoKind | null {
  if (agv.cargo) return agv.cargo
  if (agv.status !== 'loading') return null
  const stop = simulation.layout.agv.stops.find((s) => s.id === agv.currentStopId)
  if (stop?.kind === 'warehouse') return 'raw'
  if (stop?.kind === 'lineOutput') return 'finished'
  return null
}

/** 리프트 상승 비율(0~1) */
export function liftAmount(agv: AgvState): number {
  const t = agv.taskDuration > 0 ? 1 - agv.taskRemaining / agv.taskDuration : 1
  if (agv.status === 'loading') return Math.min(1, t * 1.5)
  if (agv.status === 'unloading') return Math.max(0, 1 - t * 1.5)
  return agv.cargo ? 1 : 0
}
