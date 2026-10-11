import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, MeshStandardMaterial } from 'three'
import { simulation } from '../runtime'
import { TRUCK_LENGTH } from '../sim/geometry'
import { Selectable } from './Selectable'
import { COLORS } from './theme'

const TRAILER = 9.6
const CAB = TRUCK_LENGTH - TRAILER

function TruckModel() {
  const wheels = [-3.6, -2.4, 2.6]
  return (
    <group>
      {/* 트레일러: 후면(-x)이 도크를 향함 */}
      <mesh position={[-TRUCK_LENGTH / 2 + TRAILER / 2, 1.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[TRAILER, 2.7, 2.5]} />
        <meshStandardMaterial color={COLORS.white} />
      </mesh>
      <mesh position={[-TRUCK_LENGTH / 2 + TRAILER / 2, 1.3, 1.26]}>
        <boxGeometry args={[TRAILER - 0.4, 0.35, 0.02]} />
        <meshStandardMaterial color={COLORS.primary} />
      </mesh>
      <mesh position={[-TRUCK_LENGTH / 2 + TRAILER / 2, 0.55, 0]}>
        <boxGeometry args={[TRAILER, 0.2, 2.2]} />
        <meshStandardMaterial color={COLORS.charcoal} />
      </mesh>
      {/* 캡 */}
      <group position={[TRUCK_LENGTH / 2 - CAB / 2, 0, 0]}>
        <mesh position={[0, 1.55, 0]} castShadow>
          <boxGeometry args={[CAB, 2.1, 2.4]} />
          <meshStandardMaterial color={COLORS.primary} />
        </mesh>
        <mesh position={[CAB / 2 + 0.01, 1.95, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[2.0, 0.8]} />
          <meshStandardMaterial color="#1b2740" roughness={0.2} />
        </mesh>
        <mesh position={[0.3, 2.0, 1.21]}>
          <planeGeometry args={[1.2, 0.7]} />
          <meshStandardMaterial color="#1b2740" roughness={0.2} />
        </mesh>
      </group>
      {wheels.map((x) =>
        [-1, 1].map((side) => (
          <mesh key={`${x}:${side}`} position={[x, 0.45, side * 1.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.45, 0.45, 0.35, 16]} />
            <meshStandardMaterial color={COLORS.charcoal} />
          </mesh>
        )),
      )}
    </group>
  )
}

export function ShippingDock() {
  const truck = useRef<Group>(null)
  const doorLight = useRef<MeshStandardMaterial>(null)
  const { dockX, dockZ, stagingOrigin } = simulation.layout.shipping

  useFrame(() => {
    const t = simulation.state.shipping.truck
    if (truck.current) {
      truck.current.visible = t.status !== 'away'
      truck.current.position.x = t.x
    }
    if (doorLight.current) {
      const color = t.status === 'docked' ? COLORS.ok : COLORS.ng
      doorLight.current.color.set(color)
      doorLight.current.emissive.set(color)
    }
  })

  return (
    <group>
      {/* 적치장 바닥 */}
      <mesh position={[stagingOrigin.x + 3, 0.015, stagingOrigin.z + 0.75]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 3.6]} />
        <meshStandardMaterial color={COLORS.primary} transparent opacity={0.1} />
      </mesh>
      {/* 도크 게이트 */}
      <group position={[dockX, 0, dockZ]}>
        {[-1.7, 1.7].map((z) => (
          <mesh key={z} position={[0, 2.1, z]} castShadow>
            <boxGeometry args={[0.35, 4.2, 0.35]} />
            <meshStandardMaterial color={COLORS.primary} />
          </mesh>
        ))}
        <mesh position={[0, 4.3, 0]} castShadow>
          <boxGeometry args={[0.5, 0.4, 3.75]} />
          <meshStandardMaterial color={COLORS.primary} />
        </mesh>
        <mesh position={[0.6, 4.7, 0]} castShadow>
          <boxGeometry args={[2.2, 0.12, 4.6]} />
          <meshStandardMaterial color={COLORS.white} />
        </mesh>
        <mesh position={[0, 0.6, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.9, 1.2, 3.0]} />
          <meshStandardMaterial color={COLORS.steel} />
        </mesh>
        <mesh position={[0.05, 3.6, -2.0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial ref={doorLight} color={COLORS.ng} emissive={COLORS.ng} emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      </group>
      {/* 트럭 */}
      <group ref={truck} position={[0, 0, dockZ]}>
        <Selectable id="TRUCK">
          <TruckModel />
        </Selectable>
      </group>
    </group>
  )
}
