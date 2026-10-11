import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { MeshStandardMaterial, type Group, type Mesh } from 'three'
import type { AgvStatus } from '../domain/types'
import { simulation } from '../runtime'
import { matchesAgvFilter } from '../store/filters'
import { useFactoryStore } from '../store/useFactoryStore'
import { Dimmable } from './Dimmable'
import { AGV_DECK_Y, AGV_LIFT_STROKE, liftAmount } from './agvVisual'
import { Selectable } from './Selectable'
import { AGV_STATUS_COLOR, COLORS } from './theme'

const LENGTH = 1.7
const WIDTH = 1.15

function AgvModel({ index }: { index: number }) {
  const body = useRef<Group>(null)
  const deck = useRef<Mesh>(null)
  const beacon = useRef<Mesh>(null)
  // 양쪽 LED가 같은 재질을 공유해 상태 색이 함께 바뀐다
  const ledMaterial = useMemo(
    () => new MeshStandardMaterial({ color: COLORS.primary, emissive: COLORS.primary, emissiveIntensity: 1.2, toneMapped: false }),
    [],
  )
  useEffect(() => () => ledMaterial.dispose(), [ledMaterial])
  const ledStatus = useRef<AgvStatus | null>(null)

  useFrame(({ clock }) => {
    const agv = simulation.state.agvs[index]
    const pose = simulation.path.pose(agv.s)
    if (body.current) {
      body.current.position.set(pose.x, 0, pose.z)
      body.current.rotation.y = -pose.heading
    }
    if (deck.current) deck.current.position.y = AGV_DECK_Y - 0.03 + liftAmount(agv) * AGV_LIFT_STROKE
    if (beacon.current) {
      beacon.current.rotation.y = clock.elapsedTime * 6
      beacon.current.visible = agv.status === 'moving' || agv.status === 'queued'
    }
    if (ledStatus.current !== agv.status) {
      ledStatus.current = agv.status
      ledMaterial.color.set(AGV_STATUS_COLOR[agv.status])
      ledMaterial.emissive.set(AGV_STATUS_COLOR[agv.status])
    }
  })

  const id = simulation.state.agvs[index].id
  const isDimmed = () => {
    const { listTab, agvFilter } = useFactoryStore.getState()
    return listTab === 'agvs' && !matchesAgvFilter(simulation.state.agvs[index].status, agvFilter)
  }
  return (
    <group ref={body}>
      <Selectable id={id}>
        <Dimmable isDimmed={isDimmed}>
          {/* 섀시 */}
          <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[LENGTH, 0.3, WIDTH]} />
            <meshStandardMaterial color={COLORS.accent} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[LENGTH + 0.08, 0.1, WIDTH + 0.06]} />
            <meshStandardMaterial color={COLORS.charcoal} />
          </mesh>
          {/* 측면 상태 LED */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[0, 0.24, side * (WIDTH / 2 + 0.005)]} material={ledMaterial}>
              <boxGeometry args={[LENGTH * 0.7, 0.06, 0.01]} />
            </mesh>
          ))}
          {/* 전면 라이다 */}
          <mesh position={[LENGTH / 2 - 0.1, 0.42, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.12, 12]} />
            <meshStandardMaterial color={COLORS.charcoal} />
          </mesh>
          {/* 리프트 상판 */}
          <mesh ref={deck} position={[0, AGV_DECK_Y - 0.03, 0]} castShadow>
            <boxGeometry args={[1.15, 0.06, 1.0]} />
            <meshStandardMaterial color={COLORS.steelDark} />
          </mesh>
          {/* 경광등 */}
          <mesh position={[-LENGTH / 2 + 0.15, 0.45, WIDTH / 2 - 0.15]}>
            <cylinderGeometry args={[0.025, 0.025, 0.2, 6]} />
            <meshStandardMaterial color={COLORS.charcoal} />
          </mesh>
          <mesh ref={beacon} position={[-LENGTH / 2 + 0.15, 0.6, WIDTH / 2 - 0.15]}>
            <boxGeometry args={[0.14, 0.1, 0.06]} />
            <meshStandardMaterial color="#ffb020" emissive="#ffb020" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </Dimmable>
      </Selectable>
    </group>
  )
}

export function Agvs() {
  return (
    <>
      {simulation.state.agvs.map((agv, i) => (
        <AgvModel key={agv.id} index={i} />
      ))}
    </>
  )
}
