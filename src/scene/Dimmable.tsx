import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type { Group, Material, Mesh } from 'three'

const DIM_OPACITY = 0.15

interface Saved {
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

function setDimmed(root: Group, dimmed: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of materials) {
      if (dimmed) {
        m.userData.dimSaved = { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite } satisfies Saved
        m.transparent = true
        m.depthWrite = false
        m.opacity *= DIM_OPACITY
      } else if (m.userData.dimSaved) {
        Object.assign(m, m.userData.dimSaved as Saved)
        delete m.userData.dimSaved
      } else {
        continue
      }
      // 불투명 재질은 알파를 무시하도록(OPAQUE) 컴파일되므로 셰이더를 다시 만들어야 투명도가 반영된다
      m.needsUpdate = true
    }
  })
}

/** 필터에 맞지 않는 객체를 흐리게 그린다. 판정은 매 프레임 하되 바뀔 때만 재질을 바꾼다. */
export function Dimmable({ isDimmed, children }: { isDimmed: () => boolean; children: ReactNode }) {
  const group = useRef<Group>(null)
  const current = useRef(false)

  useFrame(() => {
    const next = isDimmed()
    if (!group.current || next === current.current) return
    current.current = next
    setDimmed(group.current, next)
  })

  return <group ref={group}>{children}</group>
}
