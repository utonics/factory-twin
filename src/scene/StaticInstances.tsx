import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Object3D, type InstancedMesh } from 'three'

export interface InstanceTransform {
  position: [number, number, number]
  scale?: number
}

interface StaticInstancesProps {
  instances: InstanceTransform[]
  /** 모든 인스턴스에 같은 회전 적용 */
  rotation?: [number, number, number]
  castShadow?: boolean
  receiveShadow?: boolean
  /** geometry와 material */
  children: ReactNode
}

/** 움직이지 않는 반복 메시를 InstancedMesh 하나로 그린다(그리기 호출 1회) */
export function StaticInstances({ instances, rotation, castShadow = false, receiveShadow = false, children }: StaticInstancesProps) {
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const target = mesh.current
    if (!target) return
    const dummy = new Object3D()
    if (rotation) dummy.rotation.set(...rotation)
    instances.forEach((inst, i) => {
      dummy.position.set(...inst.position)
      dummy.scale.setScalar(inst.scale ?? 1)
      dummy.updateMatrix()
      target.setMatrixAt(i, dummy.matrix)
    })
    target.instanceMatrix.needsUpdate = true
    target.computeBoundingSphere()
  }, [instances, rotation])

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, instances.length]} castShadow={castShadow} receiveShadow={receiveShadow}>
      {children}
    </instancedMesh>
  )
}
