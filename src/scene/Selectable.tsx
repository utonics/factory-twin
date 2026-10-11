import type { ThreeEvent } from '@react-three/fiber'
import type { ReactNode } from 'react'
import { useFactoryStore } from '../store/useFactoryStore'

/** 드래그(카메라 이동)와 구분하기 위한 클릭 허용 이동량(px) */
const CLICK_TOLERANCE = 5

interface SelectableProps {
  id: string
  children: ReactNode
  position?: [number, number, number]
}

export function Selectable({ id, children, position }: SelectableProps) {
  const select = useFactoryStore((s) => s.select)

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > CLICK_TOLERANCE) return
    select(id)
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    document.body.style.cursor = ''
  }

  return (
    <group position={position} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
      {children}
    </group>
  )
}
