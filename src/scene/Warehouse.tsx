import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Object3D, type InstancedMesh } from 'three'
import { simulation } from '../runtime'
import { createRng } from '../sim/random'
import { Selectable } from './Selectable'
import { StaticInstances, type InstanceTransform } from './StaticInstances'
import { COLORS } from './theme'

const ROW_XS = [-40.5, -36, -31.5]
const BAY = 2.4
const LEVELS = [0.15, 1.75, 3.35]
const DEPTH = 1.3
const HEIGHT = 4.8

interface RackParts {
  uprights: [number, number, number][]
  /** 빔은 모두 같은 길이 */
  beams: InstanceTransform[]
  beamLength: number
  loads: [number, number, number][]
}

function buildRacks(): RackParts {
  const { minZ, maxZ } = simulation.layout.warehouse
  const rng = createRng(4242)
  const bays = Math.floor((maxZ - minZ) / BAY)
  const parts: RackParts = { uprights: [], beams: [], beamLength: bays * BAY, loads: [] }
  const z0 = minZ + ((maxZ - minZ) - bays * BAY) / 2
  for (const x of ROW_XS) {
    for (let b = 0; b <= bays; b++) {
      const z = z0 + b * BAY
      parts.uprights.push([x - DEPTH / 2, HEIGHT / 2, z], [x + DEPTH / 2, HEIGHT / 2, z])
    }
    for (const y of LEVELS) {
      for (const side of [-1, 1]) parts.beams.push({ position: [x + side * (DEPTH / 2), y + 0.05, z0 + (bays * BAY) / 2] })
      for (let b = 0; b < bays; b++) parts.loads.push([x, y + 0.1, z0 + b * BAY + BAY / 2])
    }
  }
  // 재고가 줄 때 빈 칸이 흩어져 보이도록 적재 순서를 섞는다(앞에서부터 재고 수만큼 표시)
  for (let i = parts.loads.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[parts.loads[i], parts.loads[j]] = [parts.loads[j], parts.loads[i]]
  }
  return parts
}

/** 자재창고 랙(인스턴싱). 랙에 보이는 팔레트 수가 실제 원자재 재고를 따라간다. */
export function Warehouse() {
  const parts = useMemo(buildRacks, [])
  const geometries = useMemo(
    () => ({
      upright: new BoxGeometry(0.1, HEIGHT, 0.1),
      pallet: new BoxGeometry(1.1, 0.14, 1.1),
      load: new BoxGeometry(1.0, 1.0, 1.0),
    }),
    [],
  )
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries])
  const uprights = useRef<InstancedMesh>(null)
  const pallets = useRef<InstancedMesh>(null)
  const loads = useRef<InstancedMesh>(null)

  useFrame(() => {
    const { stock } = simulation.state.warehouse
    const visible = Math.min(parts.loads.length, Math.round((stock / simulation.layout.warehouse.capacity) * parts.loads.length))
    if (pallets.current) pallets.current.count = visible
    if (loads.current) loads.current.count = visible
  })

  useLayoutEffect(() => {
    const dummy = new Object3D()
    parts.uprights.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z)
      dummy.updateMatrix()
      uprights.current!.setMatrixAt(i, dummy.matrix)
    })
    parts.loads.forEach(([x, y, z], i) => {
      dummy.position.set(x, y + 0.07, z)
      dummy.updateMatrix()
      pallets.current!.setMatrixAt(i, dummy.matrix)
      dummy.position.set(x, y + 0.14 + 0.5, z)
      dummy.updateMatrix()
      loads.current!.setMatrixAt(i, dummy.matrix)
    })
    for (const mesh of [uprights.current!, pallets.current!, loads.current!]) mesh.instanceMatrix.needsUpdate = true
  }, [parts])

  const { pickup } = simulation.layout.warehouse
  return (
    <Selectable id="WH">
      <instancedMesh ref={uprights} args={[geometries.upright, undefined, parts.uprights.length]} castShadow>
        <meshStandardMaterial color={COLORS.primary} />
      </instancedMesh>
      <StaticInstances instances={parts.beams}>
        <boxGeometry args={[0.08, 0.12, parts.beamLength]} />
        <meshStandardMaterial color="#f08c1a" />
      </StaticInstances>
      <instancedMesh ref={pallets} args={[geometries.pallet, undefined, parts.loads.length]} castShadow>
        <meshStandardMaterial color={COLORS.pallet} />
      </instancedMesh>
      <instancedMesh ref={loads} args={[geometries.load, undefined, parts.loads.length]} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS.rawPart} />
      </instancedMesh>
      {/* 출고장 바닥 표시 */}
      <mesh position={[pickup.x, 0.02, pickup.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.8, 1.8]} />
        <meshStandardMaterial color={COLORS.primary} transparent opacity={0.18} />
      </mesh>
    </Selectable>
  )
}
