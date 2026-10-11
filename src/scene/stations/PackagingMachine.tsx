import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import type { StationSpec } from '../../domain/types'
import { simulation } from '../../runtime'
import { BELT_Y, COLORS } from '../theme'

/** 사이클 중반에 프레스가 내려와 박스를 접고 테이핑한다 */
function pressAmount(status: string, progress: number): number {
  if (status !== 'processing') return 0
  const t = Math.min(1, Math.max(0, (progress - 0.25) / 0.5))
  return Math.sin(t * Math.PI)
}

export function PackagingMachine({ spec }: { spec: StationSpec }) {
  const press = useRef<Group>(null)
  const flaps = useRef<Group>(null)

  useFrame(() => {
    const st = simulation.state.stations[spec.id]
    const amount = pressAmount(st.status, st.progress)
    if (press.current) press.current.position.y = 2.15 - amount * 0.75
    if (flaps.current) flaps.current.children.forEach((flap, i) => (flap.rotation.x = (i === 0 ? 1 : -1) * amount * 0.9))
  })

  return (
    <group>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.76, 1.4]} />
        <meshStandardMaterial color={COLORS.white} />
      </mesh>
      {/* 프레임 기둥 */}
      {[
        [-1.35, -0.85],
        [1.35, -0.85],
        [-1.35, 0.85],
        [1.35, 0.85],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 1.6, z]} castShadow>
          <boxGeometry args={[0.14, 1.7, 0.14]} />
          <meshStandardMaterial color={COLORS.primary} />
        </mesh>
      ))}
      <mesh position={[0, 2.5, 0]} castShadow>
        <boxGeometry args={[2.9, 0.2, 1.84]} />
        <meshStandardMaterial color={COLORS.white} />
      </mesh>
      {/* 프레스 헤드 */}
      <group ref={press} position={[0, 2.15, 0]}>
        <mesh>
          <boxGeometry args={[0.95, 0.12, 0.95]} />
          <meshStandardMaterial color={COLORS.steelDark} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.6, 8]} />
          <meshStandardMaterial color={COLORS.machined} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      {/* 플랩 폴더 */}
      <group ref={flaps} position={[0, BELT_Y + 0.75, 0]}>
        {[-0.62, 0.62].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <boxGeometry args={[0.8, 0.05, 0.3]} />
            <meshStandardMaterial color={COLORS.accent} />
          </mesh>
        ))}
      </group>
      {/* 골판지 매거진 */}
      <group position={[-0.4, 0, 1.6]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[1.2, 0.9, 0.8]} />
          <meshStandardMaterial color={COLORS.white} />
        </mesh>
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[1.0, 0.4, 0.6]} />
          <meshStandardMaterial color={COLORS.cardboard} />
        </mesh>
      </group>
    </group>
  )
}
