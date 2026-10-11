import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import type { StationSpec } from '../../domain/types'
import { simulation } from '../../runtime'
import { BELT_Y, COLORS, sceneDelta } from '../theme'

/** 문 열림 정도: 사이클 시작·끝 구간에서 열리고 가공 중에는 닫힌다 */
function doorOpenAmount(status: string, progress: number): number {
  if (status !== 'processing' && status !== 'down') return 1
  if (progress < 0.1) return 1 - progress / 0.1
  if (progress > 0.9) return (progress - 0.9) / 0.1
  return 0
}

export function CncMachine({ spec }: { spec: StationSpec }) {
  const door = useRef<Group>(null)
  const spindle = useRef<Group>(null)
  const chuck = useRef<Mesh>(null)
  const glow = useRef<MeshStandardMaterial>(null)

  useFrame((_, delta) => {
    const st = simulation.state.stations[spec.id]
    const running = st.status === 'processing'
    const open = doorOpenAmount(st.status, st.progress)
    if (door.current) door.current.position.y = 1.0 + open * 1.05
    if (spindle.current) {
      // 가공 구간에서 스핀들이 내려와 회전
      const cut = running && st.progress > 0.12 && st.progress < 0.88 ? 1 : 0
      const targetY = 2.0 - cut * 0.55
      spindle.current.position.y += (targetY - spindle.current.position.y) * Math.min(1, delta * 6)
    }
    if (chuck.current && running) chuck.current.rotation.y += sceneDelta(delta) * 40
    if (glow.current) {
      const target = st.status === 'down' ? 0.2 : running ? 1.4 : 0.35
      glow.current.emissiveIntensity += (target - glow.current.emissiveIntensity) * Math.min(1, delta * 4)
      glow.current.emissive.set(st.status === 'down' ? COLORS.ng : '#7fb0ff')
    }
  })

  return (
    <group>
      {/* 하부 베드 */}
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.76, 2.4]} />
        <meshStandardMaterial color={COLORS.white} />
      </mesh>
      <mesh position={[0, 0.78, 0.95]}>
        <boxGeometry args={[3.02, 0.06, 0.5]} />
        <meshStandardMaterial color={COLORS.primary} />
      </mesh>
      {/* 후면 패널 + 내부 조명 */}
      <mesh position={[0, 1.65, -1.15]} castShadow>
        <boxGeometry args={[3, 1.7, 0.1]} />
        <meshStandardMaterial color={COLORS.white} />
      </mesh>
      <mesh position={[0, 1.65, -1.09]}>
        <planeGeometry args={[2.4, 1.2]} />
        <meshStandardMaterial ref={glow} color="#dbe7ff" emissive="#7fb0ff" emissiveIntensity={0.35} />
      </mesh>
      {/* 측면 패널(컨베이어 위쪽만) */}
      {[-1.45, 1.45].map((x) => (
        <mesh key={x} position={[x, 1.75, 0]} castShadow>
          <boxGeometry args={[0.1, 1.5, 2.4]} />
          <meshStandardMaterial color={COLORS.white} />
        </mesh>
      ))}
      {/* 지붕 */}
      <mesh position={[0, 2.55, 0]} castShadow>
        <boxGeometry args={[3.1, 0.12, 2.5]} />
        <meshStandardMaterial color={COLORS.primary} />
      </mesh>
      {/* 스핀들 */}
      <group ref={spindle} position={[0, 2.0, 0]}>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={COLORS.steelDark} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh ref={chuck} position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.12, 0.06, 0.4, 6]} />
          <meshStandardMaterial color={COLORS.machined} metalness={0.8} roughness={0.25} />
        </mesh>
      </group>
      {/* 전면 슬라이딩 도어(유리) */}
      <group ref={door} position={[0, 1.0, 1.2]}>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[2.8, 1.3, 0.06]} />
          <meshStandardMaterial color={COLORS.glass} transparent opacity={0.45} roughness={0.1} />
        </mesh>
        <mesh position={[0, 1.33, 0.02]}>
          <boxGeometry args={[2.8, 0.08, 0.08]} />
          <meshStandardMaterial color={COLORS.steelDark} />
        </mesh>
      </group>
      {/* 조작반 */}
      <group position={[1.85, 0, 0.7]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[0.5, 1.4, 0.5]} />
          <meshStandardMaterial color={COLORS.white} />
        </mesh>
        <mesh position={[0, 1.2, 0.26]}>
          <planeGeometry args={[0.38, 0.28]} />
          <meshStandardMaterial color="#0f1a33" emissive="#2f5bea" emissiveIntensity={0.6} />
        </mesh>
      </group>
      {/* 작업 위치 표시 */}
      <mesh position={[0, BELT_Y + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.44, 24]} />
        <meshBasicMaterial color={COLORS.accent} />
      </mesh>
    </group>
  )
}
