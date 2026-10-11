import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { MeshStandardMaterial } from 'three'
import { simulation } from '../../runtime'
import { dimFactor } from '../Dimmable'
import { COLORS } from '../theme'

const LAMPS = [
  { color: '#ef4444', active: (s: string) => s === 'down' },
  { color: '#f5b301', active: (s: string) => s === 'idle' || s === 'blocked' },
  { color: '#22b573', active: (s: string) => s === 'processing' },
]

/** 설비 상태 표시등(안돈): 위부터 적색-황색-녹색. 고장 시 적색 점멸 */
export function StackLight({ stationId, position }: { stationId: string; position: [number, number, number] }) {
  const mats = useRef<(MeshStandardMaterial | null)[]>([])

  useFrame(({ clock }) => {
    const status = simulation.state.stations[stationId].status
    const blink = Math.sin(clock.elapsedTime * 10) > 0
    LAMPS.forEach((lamp, i) => {
      const mat = mats.current[i]
      if (!mat) return
      const on = lamp.active(status) && (status !== 'down' || blink)
      mat.emissiveIntensity = on ? 2.2 : 0.05
      mat.opacity = (on ? 1 : 0.55) * dimFactor(mat)
    })
  })

  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.8, 8]} />
        <meshStandardMaterial color={COLORS.steelDark} />
      </mesh>
      {LAMPS.map((lamp, i) => (
        <mesh key={lamp.color} position={[0, 2.3 - i * 0.22, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 12]} />
          <meshStandardMaterial
            ref={(m) => {
              mats.current[i] = m
            }}
            color={lamp.color}
            emissive={lamp.color}
            emissiveIntensity={0.05}
            transparent
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[0, 2.46, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
        <meshStandardMaterial color={COLORS.charcoal} />
      </mesh>
    </group>
  )
}
