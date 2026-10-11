import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BoxGeometry, CylinderGeometry, Object3D, type BufferGeometry, type InstancedMesh } from 'three'
import type { ItemStage, ItemState, LineSpec } from '../domain/types'
import { simulation } from '../runtime'
import { REJECT_BIN_OFFSET } from './stations/InspectionStation'
import { BELT_Y, COLORS } from './theme'

const CAPACITY = 160

interface Visual {
  key: string
  stages: ItemStage[]
  height: number
  color: string
  geometry: BufferGeometry
}

/** 컨베이어 위 제품. 공정 단계마다 형상이 바뀌며, 단계별로 InstancedMesh 하나씩 그린다. */
export function Products() {
  const visuals = useMemo<Visual[]>(
    () => [
      { key: 'raw', stages: ['raw'], height: 0.36, color: COLORS.rawPart, geometry: new BoxGeometry(0.62, 0.36, 0.62) },
      { key: 'machined', stages: ['machined'], height: 0.46, color: COLORS.machined, geometry: new CylinderGeometry(0.3, 0.3, 0.46, 12) },
      { key: 'welded', stages: ['welded', 'inspected'], height: 0.5, color: COLORS.welded, geometry: new CylinderGeometry(0.3, 0.34, 0.5, 6) },
      { key: 'packed', stages: ['packed'], height: 0.62, color: COLORS.cardboard, geometry: new BoxGeometry(0.78, 0.62, 0.78) },
    ],
    [],
  )
  const meshes = useRef<(InstancedMesh | null)[]>([])
  const dummy = useMemo(() => new Object3D(), [])
  const lineById = useMemo(() => {
    const map: Record<string, LineSpec> = {}
    for (const line of simulation.layout.lines) map[line.id] = line
    return map
  }, [])
  const rejectXByLine = useMemo(() => {
    const map: Record<string, number> = {}
    for (const line of simulation.layout.lines) {
      const vis = line.stations.find((s) => s.kind === 'inspection')
      if (vis) map[line.id] = vis.x + REJECT_BIN_OFFSET.x
    }
    return map
  }, [])

  useFrame(() => {
    const counts = visuals.map(() => 0)
    const place = (item: ItemState) => {
      const vi = visuals.findIndex((v) => v.stages.includes(item.stage))
      const mesh = meshes.current[vi]
      if (!mesh || counts[vi] >= CAPACITY) return
      const line = lineById[item.lineId]
      const h = visuals[vi].height
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      if (item.location.type === 'reject') {
        // 옆으로 밀려나 배출함에 떨어지는 연출
        const t = item.location.elapsed
        const slide = Math.min(1, t / 0.6)
        const fall = Math.max(0, t - 0.6)
        dummy.position.set(
          item.x + (rejectXByLine[item.lineId] - item.x) * slide,
          Math.max(0.35, BELT_Y + h / 2 + 0.1 * Math.sin(slide * Math.PI) - 4.9 * fall * fall),
          line.z + REJECT_BIN_OFFSET.z * slide,
        )
        dummy.rotation.set(slide * 0.6, 0, slide * 0.4)
      } else {
        dummy.position.set(item.x, BELT_Y + h / 2, line.z)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(counts[vi]++, dummy.matrix)
    }
    for (const item of simulation.state.items.values()) place(item)
    visuals.forEach((_, i) => {
      const mesh = meshes.current[i]
      if (!mesh) return
      mesh.count = counts[i]
      mesh.instanceMatrix.needsUpdate = true
    })
  })

  return (
    <>
      {visuals.map((v, i) => (
        <instancedMesh
          key={v.key}
          ref={(m) => {
            meshes.current[i] = m
          }}
          args={[v.geometry, undefined, CAPACITY]}
          castShadow
          frustumCulled={false}
        >
          <meshStandardMaterial color={v.color} metalness={v.key === 'machined' ? 0.6 : 0.1} roughness={0.45} />
        </instancedMesh>
      ))}
    </>
  )
}
