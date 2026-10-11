import { useFrame } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import type { Group, Material, Mesh } from 'three'

const DIM_OPACITY = 0.15

interface Saved {
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

/** 흐림 상태면 투명도 배율(매 프레임 투명도를 직접 쓰는 컴포넌트가 곱해서 쓴다) */
export function dimFactor(material: Material): number {
  return material.userData.dimSaved ? DIM_OPACITY : 1
}

function setDimmed(root: Group, dimmed: boolean): void {
  // 여러 메시가 같은 재질을 공유할 수 있으므로 재질 단위로 한 번만 처리
  const materials = new Set<Material>()
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m)
  })
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
