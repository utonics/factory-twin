import { Grid, Line } from '@react-three/drei'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three'
import type { Vec2 } from '../domain/types'
import { simulation } from '../runtime'
import { COLORS } from './theme'

const LANE_WIDTH = 1.7

/** 닫힌 경로를 따라가는 납작한 띠 형상 */
function ribbonGeometry(points: Vec2[], width: number): BufferGeometry {
  const positions: number[] = []
  const n = points.length
  for (let i = 0; i <= n; i++) {
    const p = points[i % n]
    const prev = points[(i - 1 + n) % n]
    const next = points[(i + 1) % n]
    const dx = next.x - prev.x
    const dz = next.z - prev.z
    const len = Math.hypot(dx, dz) || 1
    const nx = -dz / len
    const nz = dx / len
    positions.push(p.x + (nx * width) / 2, 0, p.z + (nz * width) / 2, p.x - (nx * width) / 2, 0, p.z - (nz * width) / 2)
  }
  const index: number[] = []
  for (let i = 0; i < n; i++) {
    const a = i * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

function offsetPath(points: Vec2[], offset: number): [number, number, number][] {
  const n = points.length
  const out: [number, number, number][] = []
  for (let i = 0; i <= n; i++) {
    const p = points[i % n]
    const prev = points[(i - 1 + n) % n]
    const next = points[(i + 1) % n]
    const dx = next.x - prev.x
    const dz = next.z - prev.z
    const len = Math.hypot(dx, dz) || 1
    out.push([p.x - (dz / len) * offset, 0.03, p.z + (dx / len) * offset])
  }
  return out
}

function rect(cx: number, cz: number, w: number, d: number): [number, number, number][] {
  return [
    [cx - w / 2, 0.03, cz - d / 2],
    [cx + w / 2, 0.03, cz - d / 2],
    [cx + w / 2, 0.03, cz + d / 2],
    [cx - w / 2, 0.03, cz + d / 2],
    [cx - w / 2, 0.03, cz - d / 2],
  ]
}

function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 1.2, 6]} />
        <meshStandardMaterial color={COLORS.trunk} />
      </mesh>
      <mesh position={[0, 1.9, 0]} castShadow>
        <icosahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial color={COLORS.tree} flatShading />
      </mesh>
    </group>
  )
}

export function FactoryFloor() {
  const { layout, path } = simulation
  const { floor } = layout
  const width = floor.maxX - floor.minX
  const depth = floor.maxZ - floor.minZ
  const cx = (floor.minX + floor.maxX) / 2
  const cz = (floor.minZ + floor.maxZ) / 2

  const lane = useMemo(() => ribbonGeometry(path.points, LANE_WIDTH), [path])
  const laneEdges = useMemo(() => [offsetPath(path.points, LANE_WIDTH / 2), offsetPath(path.points, -LANE_WIDTH / 2)], [path])
  const park = layout.agv.stops.find((s) => s.kind === 'park')!.point

  const pillars = useMemo(() => {
    const list: [number, number][] = []
    for (let x = floor.minX + 12; x < floor.maxX - 4; x += 16) list.push([x, floor.minZ + 0.6])
    for (let z = floor.minZ + 12; z < floor.maxZ - 4; z += 14) list.push([floor.minX + 0.6, z])
    return list
  }, [floor])

  return (
    <group>
      {/* 외부 부지 */}
      <mesh position={[cx, -0.02, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width + 80, depth + 80]} />
        <meshStandardMaterial color={COLORS.ground} />
      </mesh>
      {/* 공장 바닥 */}
      <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={COLORS.floor} />
      </mesh>
      <Grid
        position={[cx, 0.005, cz]}
        args={[width, depth]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#e3e8ef"
        sectionSize={4}
        sectionThickness={0.8}
        sectionColor="#d3dae4"
        fadeDistance={160}
        fadeStrength={1}
      />

      {/* AGV 주행로 */}
      <mesh geometry={lane} position={[0, 0.012, 0]} receiveShadow>
        <meshStandardMaterial color={COLORS.primary} transparent opacity={0.1} side={DoubleSide} />
      </mesh>
      {laneEdges.map((pts, i) => (
        <Line key={i} points={pts} color={COLORS.marking} lineWidth={2} dashed dashSize={0.8} gapSize={0.5} />
      ))}

      {/* 작업 구역 표시 */}
      {layout.lines.map((line) => (
        <Line key={line.id} points={rect((line.xStart + line.xEnd) / 2, line.z, line.xEnd - line.xStart + 4, 7.2)} color={COLORS.marking} lineWidth={2} />
      ))}
      <Line points={rect(33.5, 11.75, 9.5, 4.8)} color={COLORS.marking} lineWidth={2} />
      <Line points={rect(park.x, park.z + 2.2, 4, 2)} color={COLORS.ok} lineWidth={2} />

      {/* 북·서측 벽(남·동측은 시야 확보를 위해 생략) */}
      <mesh position={[cx, 2.5, floor.minZ - 0.15]} castShadow receiveShadow>
        <boxGeometry args={[width, 5, 0.3]} />
        <meshStandardMaterial color={COLORS.wall} />
      </mesh>
      <mesh position={[floor.minX - 0.15, 2.5, cz]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 5, depth]} />
        <meshStandardMaterial color={COLORS.wall} />
      </mesh>
      <mesh position={[cx, 5.05, floor.minZ - 0.15]}>
        <boxGeometry args={[width, 0.1, 0.34]} />
        <meshStandardMaterial color={COLORS.primary} />
      </mesh>
      <mesh position={[floor.minX - 0.15, 5.05, cz]}>
        <boxGeometry args={[0.34, 0.1, depth]} />
        <meshStandardMaterial color={COLORS.primary} />
      </mesh>
      {pillars.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 2.5, z]} castShadow>
          <boxGeometry args={[0.6, 5, 0.6]} />
          <meshStandardMaterial color={COLORS.white} />
        </mesh>
      ))}

      {/* 충전 스테이션 */}
      <group position={[park.x, 0, park.z + 2.4]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 1.1, 0, 0]}>
            <mesh position={[0, 0.6, 0]} castShadow>
              <boxGeometry args={[0.7, 1.2, 0.5]} />
              <meshStandardMaterial color={COLORS.white} />
            </mesh>
            <mesh position={[0, 0.85, -0.26]}>
              <planeGeometry args={[0.4, 0.25]} />
              <meshStandardMaterial color="#0e2a1c" emissive={COLORS.ok} emissiveIntensity={0.8} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 외곽 조경 */}
      <Tree x={-30} z={33} />
      <Tree x={-24} z={35} scale={0.8} />
      <Tree x={6} z={33} scale={1.1} />
      <Tree x={14} z={34} scale={0.85} />
      <Tree x={51} z={-18} />
      <Tree x={53} z={-10} scale={0.8} />
      <Tree x={-52} z={-22} scale={0.9} />
    </group>
  )
}
