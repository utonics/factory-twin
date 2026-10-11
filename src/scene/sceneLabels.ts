import { factoryLayout } from '../data/factoryLayout'

// 3D 위치에 붙는 DOM 라벨. DOM은 App 트리(SceneLabels)가 그리고,
// 캔버스 안의 LabelProjector가 매 프레임 화면 좌표로 옮긴다.

interface ZoneLabel {
  id: string
  text: string
  position: [number, number, number]
}

const park = factoryLayout.agv.stops.find((s) => s.kind === 'park')!.point

export const ZONE_LABELS: ZoneLabel[] = [
  { id: 'zone-warehouse', text: '자재창고', position: [-35.5, 6, -21] },
  ...factoryLayout.lines.map((line) => ({ id: `zone-${line.id}`, text: line.name, position: [line.xStart - 1, 0.2, line.z - 3.1] as [number, number, number] })),
  { id: 'zone-shipping', text: '출하 적치장', position: [33.5, 0.2, 9] },
  { id: 'zone-charging', text: 'AGV 충전', position: [park.x, 1.8, park.z + 2.4] },
]

export const SELECTION_LABEL_ID = 'selection'

/** 라벨 id → DOM 요소 */
export const labelElements = new Map<string, HTMLElement>()
