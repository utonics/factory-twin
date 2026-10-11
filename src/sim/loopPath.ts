import type { Vec2 } from '../domain/types'

export interface PathPose {
  x: number
  z: number
  /** 진행 방향 각도(라디안, x축 기준, z+ 방향이 양수) */
  heading: number
}

/** 모서리를 둥글린 닫힌 경로. 호 길이(s)로 위치를 조회한다. */
export class LoopPath {
  readonly points: Vec2[]
  readonly cumulative: number[]
  readonly length: number

  constructor(corners: Vec2[], radius: number, arcSegments = 10) {
    this.points = roundCorners(corners, radius, arcSegments)
    this.cumulative = [0]
    for (let i = 1; i <= this.points.length; i++) {
      const a = this.points[i - 1]
      const b = this.points[i % this.points.length]
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(b.x - a.x, b.z - a.z))
    }
    this.length = this.cumulative[this.points.length]
  }

  wrap(s: number): number {
    return ((s % this.length) + this.length) % this.length
  }

  /** a에서 진행 방향으로 b까지의 거리 */
  forwardDistance(a: number, b: number): number {
    return this.wrap(b - a)
  }

  pose(s: number): PathPose {
    const t = this.wrap(s)
    let lo = 0
    let hi = this.points.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.cumulative[mid] <= t) lo = mid
      else hi = mid - 1
    }
    const a = this.points[lo]
    const b = this.points[(lo + 1) % this.points.length]
    const segLen = this.cumulative[lo + 1] - this.cumulative[lo]
    const f = segLen > 0 ? (t - this.cumulative[lo]) / segLen : 0
    return {
      x: a.x + (b.x - a.x) * f,
      z: a.z + (b.z - a.z) * f,
      heading: Math.atan2(b.z - a.z, b.x - a.x),
    }
  }

  /** 점을 경로에 투영한 호 길이 */
  project(p: Vec2): number {
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < this.points.length; i++) {
      const a = this.points[i]
      const b = this.points[(i + 1) % this.points.length]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len2 = dx * dx + dz * dz
      const f = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0
      const d = Math.hypot(a.x + dx * f - p.x, a.z + dz * f - p.z)
      if (d < bestDist) {
        bestDist = d
        best = this.cumulative[i] + f * Math.sqrt(len2)
      }
    }
    return best
  }
}

function roundCorners(corners: Vec2[], radius: number, arcSegments: number): Vec2[] {
  const out: Vec2[] = []
  const n = corners.length
  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n]
    const cur = corners[i]
    const next = corners[(i + 1) % n]
    const inLen = Math.hypot(cur.x - prev.x, cur.z - prev.z)
    const outLen = Math.hypot(next.x - cur.x, next.z - cur.z)
    const r = Math.min(radius, inLen / 2, outLen / 2)
    const inDir = { x: (cur.x - prev.x) / inLen, z: (cur.z - prev.z) / inLen }
    const outDir = { x: (next.x - cur.x) / outLen, z: (next.z - cur.z) / outLen }
    const start = { x: cur.x - inDir.x * r, z: cur.z - inDir.z * r }
    const end = { x: cur.x + outDir.x * r, z: cur.z + outDir.z * r }
    // 2차 베지어로 모서리를 근사
    for (let k = 0; k <= arcSegments; k++) {
      const t = k / arcSegments
      const u = 1 - t
      out.push({
        x: u * u * start.x + 2 * u * t * cur.x + t * t * end.x,
        z: u * u * start.z + 2 * u * t * cur.z + t * t * end.z,
      })
    }
  }
  return out
}
