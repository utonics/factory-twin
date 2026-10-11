import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, MeshBasicMaterial } from 'three'
import { useFactoryStore } from '../store/useFactoryStore'
import { locateSelection, selectionFrame, type SelectionFrame } from './selectionGeometry'
import { COLORS } from './theme'

function corners({ w, d }: SelectionFrame): [number, number, number][][] {
  const arm = Math.min(w, d) * 0.28
  const y = 0.06
  const hx = w / 2
  const hz = d / 2
  return [
    [[-hx + arm, y, -hz], [-hx, y, -hz], [-hx, y, -hz + arm]],
    [[hx - arm, y, -hz], [hx, y, -hz], [hx, y, -hz + arm]],
    [[hx - arm, y, hz], [hx, y, hz], [hx, y, hz - arm]],
    [[-hx + arm, y, hz], [-hx, y, hz], [-hx, y, hz - arm]],
  ]
}

export function SelectionMarker() {
  const selectedId = useFactoryStore((s) => s.selectedId)
  const group = useRef<Group>(null)
  const glow = useRef<MeshBasicMaterial>(null)
  const frame = useMemo(() => (selectedId ? selectionFrame(selectedId) : null), [selectedId])

  useFrame(({ clock }) => {
    if (!selectedId || !group.current) return
    const loc = locateSelection(selectedId)
    if (!loc) return
    group.current.position.set(loc.x, 0, loc.z)
    group.current.rotation.y = loc.rotY
    if (glow.current) glow.current.opacity = 0.12 + Math.sin(clock.elapsedTime * 4) * 0.05
  })

  if (!selectedId || !frame) return null
  return (
    <group ref={group}>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[frame.w, frame.d]} />
        <meshBasicMaterial ref={glow} color={COLORS.primary} transparent opacity={0.14} depthWrite={false} />
      </mesh>
      {corners(frame).map((pts, i) => (
        <Line key={i} points={pts} color={COLORS.primary} lineWidth={3} />
      ))}
    </group>
  )
}
