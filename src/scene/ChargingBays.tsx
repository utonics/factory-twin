import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { simulation } from '../runtime'
import { StaticInstances, type InstanceTransform } from './StaticInstances'
import { COLORS } from './theme'

/** 충전기는 베이 남쪽(카메라 쪽)에 낮게 두어 베이 안 AGV를 가리지 않게 한다 */
const CABINET_OFFSET = 1.3
const CABINET_HEIGHT = 0.7

/** 순환로 밖 충전 베이: 분기 차선 표시, 베이 구획, 충전기 */
export function ChargingBays() {
  const { charging } = simulation.layout.agv
  const lanes = useMemo(
    () =>
      charging.bays.map((bay) => [
        [bay.x + charging.halfSpan, 0.03, charging.laneZ],
        [bay.x + 0.9, 0.03, charging.bayZ],
        [bay.x - 0.9, 0.03, charging.bayZ],
        [bay.x - charging.halfSpan, 0.03, charging.laneZ],
      ] as [number, number, number][]),
    [charging],
  )
  const cabinets = useMemo<InstanceTransform[]>(() => charging.bays.map((bay) => ({ position: [bay.x, CABINET_HEIGHT / 2, charging.bayZ + CABINET_OFFSET] })), [charging])
  const screens = useMemo<InstanceTransform[]>(
    () => charging.bays.map((bay) => ({ position: [bay.x, CABINET_HEIGHT * 0.7, charging.bayZ + CABINET_OFFSET + 0.21] })),
    [charging],
  )

  return (
    <group>
      {lanes.map((points, i) => (
        <Line key={charging.bays[i].id} points={points} color={COLORS.ok} lineWidth={2} dashed dashSize={0.5} gapSize={0.35} />
      ))}
      {charging.bays.map((bay) => {
        const hx = 1.1
        const hz = 0.8
        const z = charging.bayZ
        return (
          <Line
            key={bay.id}
            points={[
              [bay.x - hx, 0.03, z - hz],
              [bay.x + hx, 0.03, z - hz],
              [bay.x + hx, 0.03, z + hz],
              [bay.x - hx, 0.03, z + hz],
              [bay.x - hx, 0.03, z - hz],
            ]}
            color={COLORS.ok}
            lineWidth={2}
          />
        )
      })}
      <StaticInstances instances={cabinets} castShadow>
        <boxGeometry args={[0.9, CABINET_HEIGHT, 0.4]} />
        <meshStandardMaterial color={COLORS.white} />
      </StaticInstances>
      <StaticInstances instances={screens}>
        <planeGeometry args={[0.45, 0.2]} />
        <meshStandardMaterial color="#0e2a1c" emissive={COLORS.ok} emissiveIntensity={0.8} />
      </StaticInstances>
    </group>
  )
}
