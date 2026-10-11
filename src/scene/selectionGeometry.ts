import { simulation } from '../runtime'
import { truckDockedX } from '../sim/geometry'

export interface SelectionFrame {
  w: number
  d: number
  h: number
}

/** 선택 대상의 현재 위치·회전. 움직이는 AGV·트럭도 매 프레임 추적한다. */
export function locateSelection(id: string): { x: number; z: number; rotY: number } | null {
  const { layout, state, path } = simulation
  const agv = state.agvs.find((a) => a.id === id)
  if (agv) {
    const pose = path.pose(agv.s)
    return { x: pose.x, z: pose.z, rotY: -pose.heading }
  }
  if (id === 'TRUCK') {
    const t = state.shipping.truck
    return { x: t.status === 'away' ? truckDockedX(layout) : t.x, z: layout.shipping.dockZ, rotY: 0 }
  }
  for (const line of layout.lines) {
    if (line.id === id) return { x: (line.xStart + line.xEnd) / 2 + 0.6, z: line.z, rotY: 0 }
    const station = line.stations.find((s) => s.id === id)
    if (station) return { x: station.x, z: line.z, rotY: 0 }
  }
  return null
}

export function selectionFrame(id: string): SelectionFrame {
  const { layout, state } = simulation
  if (state.agvs.some((a) => a.id === id)) return { w: 2.2, d: 1.7, h: 1.6 }
  if (id === 'TRUCK') return { w: 14, d: 3.4, h: 4 }
  const line = layout.lines.find((l) => l.id === id)
  if (line) return { w: line.xEnd - line.xStart + 7.5, d: 7.6, h: 3.4 }
  const kind = layout.lines.flatMap((l) => l.stations).find((s) => s.id === id)?.kind
  return kind === 'robot' ? { w: 4.6, d: 6.2, h: 3.4 } : { w: 4.2, d: 3.4, h: 3.2 }
}
