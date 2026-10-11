import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Group, InstancedMesh, Mesh, type Material } from 'three'
import { dimmableRoots } from './Dimmable'

/**
 * 흐림 필터를 처음 켤 때의 셰이더 컴파일 끊김을 없앤다.
 * 흐림은 재질을 투명으로 바꾸는데, 불투명 재질은 투명용 셰이더가 따로 필요하다.
 * 앱이 뜬 직후 화면에 그리지 않는 임시 그룹에 '투명으로 바꾼 복제 재질'을 담아
 * 메인 장면의 조명·안개 조건으로 미리 비동기 컴파일해 둔다.
 * 이후 실제 재질이 투명으로 바뀌면 같은 조건의 셰이더를 캐시에서 바로 쓴다.
 */
export function ShaderWarmup() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    // 같은 커밋의 다른 컴포넌트(흐림 그룹 등록)가 끝난 뒤 실행
    const timer = setTimeout(() => {
      const warmup = new Group()
      const seen = new Set<Material>()
      for (const root of dimmableRoots) {
        root.traverse((obj) => {
          const mesh = obj as Mesh
          if (!mesh.isMesh) return
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            if (material.transparent || seen.has(material)) continue
            seen.add(material)
            const ghost = material.clone()
            ghost.transparent = true
            ghost.depthWrite = false
            // 인스턴싱 여부도 셰이더 조건에 포함되므로 같은 종류의 메시로 만든다
            warmup.add((mesh as InstancedMesh).isInstancedMesh ? new InstancedMesh(mesh.geometry, ghost, 1) : new Mesh(mesh.geometry, ghost))
          }
        })
      }
      // 복제 재질은 해제(dispose)하지 않는다. 해제하면 사용 횟수가 0이 되어 미리 만든 셰이더도 함께 삭제된다
      void gl.compileAsync(warmup, camera, scene)
    }, 0)
    return () => clearTimeout(timer)
  }, [gl, scene, camera])

  return null
}
