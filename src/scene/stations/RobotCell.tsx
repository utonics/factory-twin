import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3, type Group, type Mesh } from 'three'
import type { StationSpec } from '../../domain/types'
import { simulation } from '../../runtime'
import { StaticInstances, type InstanceTransform } from '../StaticInstances'
import { BELT_Y, COLORS, smoothstep } from '../theme'

const SHOULDER_HEIGHT = 1.35
const UPPER_ARM = 1.5
const FOREARM = 1.35
const TOOL = 0.4

interface ArmProps {
  stationId: string
  /** 셀 중심 기준 로봇 베이스 위치 */
  base: [number, number]
  /** 휴지 자세의 툴 끝 위치(셀 기준) */
  rest: [number, number, number]
  /** 용접 경로 위상 차 */
  phase: number
  color: string
}

/** 2링크 역기구학으로 툴 끝을 목표점에 맞추는 6축 로봇 형태의 팔 */
function RobotArm({ stationId, base, rest, phase, color }: ArmProps) {
  const yaw = useRef<Group>(null)
  const shoulder = useRef<Group>(null)
  const elbow = useRef<Group>(null)
  const wrist = useRef<Group>(null)
  const spark = useRef<Mesh>(null)
  const tip = useMemo(() => new Vector3(...rest), [rest])
  const goal = useMemo(() => new Vector3(), [])

  useFrame(({ clock }, delta) => {
    const st = simulation.state.stations[stationId]
    const p = st.progress
    const working = st.status === 'processing'
    const reach = working ? smoothstep(0.02, 0.14, p) * (1 - smoothstep(0.86, 0.98, p)) : 0
    const weldX = Math.sin((p + phase) * Math.PI * 5) * 0.28
    goal.set(
      rest[0] + (weldX - rest[0]) * reach,
      rest[1] + (BELT_Y + 0.62 - rest[1]) * reach,
      rest[2] + (Math.sign(base[1]) * 0.2 - rest[2]) * reach,
    )
    // 고장 시 정지, 그 외에는 부드럽게 추종
    if (st.status !== 'down') tip.lerp(goal, Math.min(1, delta * 8))

    // 역기구학: 툴은 항상 아래를 향하므로 손목점 = 툴 끝 + 툴 길이
    const wx = tip.x - base[0]
    const wz = tip.z - base[1]
    const wy = tip.y + TOOL - SHOULDER_HEIGHT
    const r = Math.hypot(wx, wz)
    const d = Math.min(UPPER_ARM + FOREARM - 0.01, Math.max(0.3, Math.hypot(r, wy)))
    const elbowInner = Math.acos((UPPER_ARM ** 2 + FOREARM ** 2 - d ** 2) / (2 * UPPER_ARM * FOREARM))
    const shoulderAngle = Math.atan2(wy, r) + Math.acos((UPPER_ARM ** 2 + d ** 2 - FOREARM ** 2) / (2 * UPPER_ARM * d))
    const elbowAngle = -(Math.PI - elbowInner)
    if (yaw.current) yaw.current.rotation.y = -Math.atan2(wz, wx)
    if (shoulder.current) shoulder.current.rotation.z = shoulderAngle
    if (elbow.current) elbow.current.rotation.z = elbowAngle
    if (wrist.current) wrist.current.rotation.z = -Math.PI / 2 - (shoulderAngle + elbowAngle)

    const welding = working && reach > 0.95
    const flicker = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 47 + phase * 10)
    if (spark.current) {
      spark.current.visible = welding
      spark.current.scale.setScalar(0.6 + flicker * 0.8)
    }
  })

  return (
    <group position={[base[0], 0, base[1]]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.55, 0.5, 16]} />
        <meshStandardMaterial color={COLORS.charcoal} />
      </mesh>
      <group ref={yaw} position={[0, 0.5, 0]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.36, 0.4, 0.85, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <group ref={shoulder} position={[0, SHOULDER_HEIGHT - 0.5, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.55, 16]} />
            <meshStandardMaterial color={COLORS.charcoal} />
          </mesh>
          <mesh position={[UPPER_ARM / 2, 0, 0]} castShadow>
            <boxGeometry args={[UPPER_ARM, 0.3, 0.32]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <group ref={elbow} position={[UPPER_ARM, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.19, 0.19, 0.42, 16]} />
              <meshStandardMaterial color={COLORS.charcoal} />
            </mesh>
            <mesh position={[FOREARM / 2, 0, 0]} castShadow>
              <boxGeometry args={[FOREARM, 0.22, 0.24]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <group ref={wrist} position={[FOREARM, 0, 0]}>
              <mesh position={[TOOL / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.05, 0.1, TOOL, 10]} />
                <meshStandardMaterial color={COLORS.steelDark} metalness={0.6} roughness={0.35} />
              </mesh>
              <mesh ref={spark} position={[TOOL + 0.02, 0, 0]} visible={false}>
                <sphereGeometry args={[0.09, 10, 10]} />
                <meshBasicMaterial color="#fff3b0" toneMapped={false} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

const FENCE_POSTS: InstanceTransform[] = [
  [-2.1, -2.9],
  [0, -2.9],
  [2.1, -2.9],
  [-2.1, -1.1],
  [2.1, -1.1],
].map(([x, z]) => ({ position: [x, 0.9, z] as [number, number, number] }))

export function RobotCell({ spec }: { spec: StationSpec }) {
  return (
    <group>
      {/* 지그 베드 */}
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.76, 1.3]} />
        <meshStandardMaterial color={COLORS.steel} />
      </mesh>
      {/* 클램프 */}
      {[-0.55, 0.55].map((z) => (
        <mesh key={z} position={[0, BELT_Y + 0.12, z]}>
          <boxGeometry args={[0.5, 0.24, 0.1]} />
          <meshStandardMaterial color={COLORS.accent} />
        </mesh>
      ))}
      <RobotArm stationId={spec.id} base={[-0.4, -1.75]} rest={[-0.9, 2.6, -1.0]} phase={0} color={COLORS.accent} />
      <RobotArm stationId={spec.id} base={[0.5, 1.75]} rest={[1.0, 2.5, 1.0]} phase={0.35} color={COLORS.accent} />
      {/* 후면 안전 펜스 */}
      <StaticInstances instances={FENCE_POSTS}>
        <boxGeometry args={[0.08, 1.8, 0.08]} />
        <meshStandardMaterial color={COLORS.accent} />
      </StaticInstances>
      <mesh position={[0, 0.95, -2.9]}>
        <boxGeometry args={[4.2, 1.5, 0.03]} />
        <meshStandardMaterial color={COLORS.steel} transparent opacity={0.35} />
      </mesh>
      {[-2.1, 2.1].map((x) => (
        <mesh key={x} position={[x, 0.95, -2]}>
          <boxGeometry args={[0.03, 1.5, 1.8]} />
          <meshStandardMaterial color={COLORS.steel} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  )
}
