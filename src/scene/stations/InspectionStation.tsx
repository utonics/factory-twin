import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh, MeshStandardMaterial } from 'three'
import type { StationSpec } from '../../domain/types'
import { simulation } from '../../runtime'
import { BELT_Y, COLORS } from '../theme'

/** 불량품 배출함 위치(설비 기준). Products 레이어와 공유 */
export const REJECT_BIN_OFFSET = { x: 0.2, z: 1.95 }

const RESULT_FLASH = 1.4

export function InspectionStation({ spec }: { spec: StationSpec }) {
  const scanner = useRef<Mesh>(null)
  const beam = useRef<MeshStandardMaterial>(null)
  const result = useRef<MeshStandardMaterial>(null)

  useFrame(() => {
    const st = simulation.state.stations[spec.id]
    const scanning = st.status === 'processing'
    if (scanner.current) {
      scanner.current.visible = scanning
      scanner.current.position.x = Math.sin(st.progress * Math.PI * 4) * 0.55
    }
    if (beam.current) beam.current.opacity = scanning ? 0.55 : 0
    if (result.current) {
      const since = simulation.state.time - st.lastResultAt
      const active = since < RESULT_FLASH && st.lastResult !== null
      const color = st.lastResult === 'ng' ? COLORS.ng : COLORS.ok
      result.current.color.set(active ? color : '#d9dee6')
      result.current.emissive.set(color)
      result.current.emissiveIntensity = active ? 1.6 : 0
    }
  })

  return (
    <group>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.76, 1.3]} />
        <meshStandardMaterial color={COLORS.white} />
      </mesh>
      {/* 게이트형 프레임 */}
      {[-0.85, 0.85].map((z) => (
        <mesh key={z} position={[0, 1.45, z]} castShadow>
          <boxGeometry args={[0.22, 1.4, 0.16]} />
          <meshStandardMaterial color={COLORS.primary} />
        </mesh>
      ))}
      <mesh position={[0, 2.2, 0]} castShadow>
        <boxGeometry args={[0.5, 0.22, 1.9]} />
        <meshStandardMaterial color={COLORS.primary} />
      </mesh>
      {/* 비전 카메라 */}
      <mesh position={[0, 1.95, 0]}>
        <boxGeometry args={[0.32, 0.3, 0.32]} />
        <meshStandardMaterial color={COLORS.charcoal} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.08, 16]} />
        <meshStandardMaterial color="#111" emissive="#4cc3ff" emissiveIntensity={0.8} />
      </mesh>
      {/* 스캔 라인 */}
      <mesh ref={scanner} position={[0, BELT_Y + 0.55, 0]} visible={false}>
        <boxGeometry args={[0.04, 1.0, 1.1]} />
        <meshStandardMaterial ref={beam} color="#5fd4ff" emissive="#5fd4ff" emissiveIntensity={1.5} transparent opacity={0} toneMapped={false} />
      </mesh>
      {/* 판정 램프 */}
      <mesh position={[0, 2.34, 0]}>
        <boxGeometry args={[0.4, 0.06, 1.5]} />
        <meshStandardMaterial ref={result} color="#d9dee6" emissive={COLORS.ok} emissiveIntensity={0} toneMapped={false} />
      </mesh>
      {/* 배출 푸셔 */}
      <mesh position={[REJECT_BIN_OFFSET.x, BELT_Y + 0.2, -0.75]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 10]} />
        <meshStandardMaterial color={COLORS.steelDark} />
      </mesh>
      {/* 불량품 배출함 */}
      <group position={[REJECT_BIN_OFFSET.x, 0, REJECT_BIN_OFFSET.z]}>
        <mesh position={[0, 0.05, 0]} receiveShadow>
          <boxGeometry args={[1.1, 0.1, 1.0]} />
          <meshStandardMaterial color={COLORS.ng} />
        </mesh>
        {[
          [0, 0.35, -0.48, 1.1, 0.6, 0.05],
          [0, 0.35, 0.48, 1.1, 0.6, 0.05],
          [-0.53, 0.35, 0, 0.05, 0.6, 1.0],
          [0.53, 0.35, 0, 0.05, 0.6, 1.0],
        ].map(([x, y, z, w, h, d]) => (
          <mesh key={`${x}:${z}`} position={[x, y, z]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={COLORS.ng} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
