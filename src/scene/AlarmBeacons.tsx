import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, MeshStandardMaterial } from 'three'
import type { StationSpec } from '../domain/types'
import { processor, simulation } from '../runtime'

/** 선택 라벨(설비 높이 + 0.6)과 겹치지 않는 높이 */
const BEACON_Y = 5.4
const LEVEL_COLOR = ['', '#f5a000', '#ef4444']

/** 데이터 처리기가 판정한 알람을 설비 위 표식으로 보여 준다(경고 주황, 위험 빨강) */
function Beacon({ spec, z }: { spec: StationSpec; z: number }) {
  const group = useRef<Group>(null)
  const material = useRef<MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    const level = processor.alarmLevel(spec.id)
    if (!group.current || !material.current) return
    group.current.visible = level > 0
    if (level === 0) return
    const t = clock.elapsedTime
    group.current.position.y = BEACON_Y + Math.sin(t * 3) * 0.12
    group.current.rotation.y = t * 1.5
    material.current.color.set(LEVEL_COLOR[level])
    material.current.emissive.set(LEVEL_COLOR[level])
    material.current.emissiveIntensity = level === 2 ? 0.6 + 0.5 * Math.sin(t * 8) : 0.5
  })

  return (
    <group ref={group} position={[spec.x, BEACON_Y, z]} visible={false}>
      <mesh castShadow>
        <octahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial ref={material} color={LEVEL_COLOR[1]} emissive={LEVEL_COLOR[1]} flatShading />
      </mesh>
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.6, 6]} />
        <meshBasicMaterial color="#9aa4b2" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

export function AlarmBeacons() {
  return (
    <>
      {simulation.layout.lines.flatMap((line) => line.stations.map((spec) => <Beacon key={spec.id} spec={spec} z={line.z} />))}
    </>
  )
}
