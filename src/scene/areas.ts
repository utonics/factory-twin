import { Vector3 } from 'three'
import { factoryLayout } from '../data/factoryLayout'

export type AreaId = 'all' | 'warehouse' | 'L1' | 'L2' | 'shipping' | 'charging'

export interface Area {
  id: AreaId
  label: string
  target: [number, number, number]
  /** 시점 중심에서 카메라까지 거리 */
  distance: number
}

const park = factoryLayout.agv.stops.find((s) => s.kind === 'park')!.point
const wh = factoryLayout.warehouse
const line = (id: string) => factoryLayout.lines.find((l) => l.id === id)!

/** 상단 바 구역 선택 목록. 카메라는 기본 시점과 같은 방향에서 구역 중심을 바라본다. */
export const AREAS: Area[] = [
  { id: 'all', label: '전체 공장', target: [10, 0, 8], distance: 117 },
  { id: 'warehouse', label: '자재창고', target: [(wh.minX + wh.maxX) / 2, 0, (wh.minZ + wh.maxZ) / 2], distance: 62 },
  { id: 'L1', label: line('L1').name, target: [1, 0, line('L1').z], distance: 44 },
  { id: 'L2', label: line('L2').name, target: [1, 0, line('L2').z], distance: 44 },
  // 오른쪽 패널에 가리지 않도록 시점 중심을 구역보다 약간 동쪽·남쪽에 둔다
  { id: 'shipping', label: '출하장', target: [42, 0, 17], distance: 56 },
  { id: 'charging', label: 'AGV 충전소', target: [park.x, 0, park.z + 1], distance: 26 },
]

/** 기본 시점의 카메라 방향(시점 중심 → 카메라) */
const VIEW_DIRECTION = new Vector3(14, 80, 84).normalize()

export function areaCamera(area: Area): { position: Vector3; target: Vector3 } {
  const target = new Vector3(...area.target)
  return { target, position: target.clone().addScaledVector(VIEW_DIRECTION, area.distance) }
}
