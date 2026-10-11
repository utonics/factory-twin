import { MapControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ComponentRef } from 'react'
import type { Vector3 } from 'three'
import { simulation } from '../runtime'
import { useFactoryStore } from '../store/useFactoryStore'
import { areaCamera, AREAS } from './areas'

const HOME = areaCamera(AREAS[0])
export const HOME_POSITION = HOME.position
const HOME_TARGET = HOME.target
const MIN_DISTANCE = 12
const MAX_DISTANCE = 140
const MARGIN = 6

type Controls = ComponentRef<typeof MapControls>

/**
 * 전략 게임식 카메라: 좌클릭 드래그 이동, 휠 줌, 우클릭 드래그 회전.
 * 시점 중심은 공장 부지 밖으로 나가지 못한다.
 */
export function CameraRig() {
  const controls = useRef<Controls>(null)
  const camera = useThree((s) => s.camera)
  const command = useFactoryStore((s) => s.cameraCommand)
  const flight = useRef<{ position: Vector3; target: Vector3 } | null>(null)

  useEffect(() => {
    const c = controls.current
    if (!command || !c) return
    if (command.type === 'focus') {
      // 구역 선택: 해당 구역 시점으로 부드럽게 이동
      const area = AREAS.find((a) => a.id === command.areaId) ?? AREAS[0]
      flight.current = areaCamera(area)
      return
    }
    const offset = camera.position.clone().sub(c.target)
    const distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, offset.length() * (command.type === 'zoomIn' ? 0.7 : 1.4)))
    flight.current = { position: c.target.clone().add(offset.setLength(distance)), target: c.target.clone() }
  }, [command, camera])

  useFrame((_, delta) => {
    const c = controls.current
    const f = flight.current
    if (!c || !f) return
    const k = 1 - Math.exp(-delta * 6)
    camera.position.lerp(f.position, k)
    c.target.lerp(f.target, k)
    c.update()
    if (camera.position.distanceTo(f.position) < 0.05) flight.current = null
  })

  const clampTarget = () => {
    const c = controls.current
    if (!c) return
    const { floor } = simulation.layout
    const tx = Math.min(floor.maxX + MARGIN, Math.max(floor.minX - MARGIN, c.target.x))
    const tz = Math.min(floor.maxZ + MARGIN, Math.max(floor.minZ - MARGIN, c.target.z))
    const dx = tx - c.target.x
    const dz = tz - c.target.z
    if (dx === 0 && dz === 0 && c.target.y === 0) return
    c.target.set(tx, 0, tz)
    camera.position.x += dx
    camera.position.z += dz
  }

  return (
    <MapControls
      ref={controls}
      makeDefault
      target={HOME_TARGET}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      minPolarAngle={0.25}
      maxPolarAngle={1.2}
      enableDamping
      dampingFactor={0.12}
      screenSpacePanning={false}
      onChange={clampTarget}
      onStart={() => {
        // 사용자가 직접 움직이면 진행 중인 이동을 멈추고 구역 선택을 해제(같은 구역을 다시 고를 수 있게)
        flight.current = null
        useFactoryStore.getState().clearArea()
      }}
    />
  )
}
