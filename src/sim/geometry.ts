import type { FactoryLayout, LineSpec } from '../domain/types'

export interface SegmentBounds {
  start: number
  end: number
}

/** 라인의 컨베이어 구간. 설비 n개 사이에 n+1개 구간이 생긴다. */
export function lineSegments(line: LineSpec): SegmentBounds[] {
  const half = line.stationLength / 2
  const bounds: SegmentBounds[] = []
  let start = line.xStart
  for (const station of line.stations) {
    bounds.push({ start, end: station.x - half })
    start = station.x + half
  }
  bounds.push({ start, end: line.xEnd })
  return bounds
}

export const TRUCK_LENGTH = 13
export const TRUCK_OFFSCREEN_X = 78

/** 도크에 후진 정차했을 때 트럭 중심 x */
export function truckDockedX(layout: FactoryLayout): number {
  return layout.shipping.dockX + TRUCK_LENGTH / 2 + 0.4
}
