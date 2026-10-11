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
/** 조작 중 카메라가 이만큼(m) 넘게 움직여야 '직접 이동한 시점'으로 본다 */
const USER_MOVE_THRESHOLD = 0.5

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
  /** 사용자 조작이 시작된 시점의 카메라 상태(실제로 움직였는지 판단용) */
  const interaction = useRef<{ position: Vector3; target: Vector3 } | null>(null)

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
      onChange={() => {
        clampTarget()
        // 조작 중 카메라가 실제로 움직였을 때만 구역 선택 해제(같은 구역을 다시 고를 수 있게).
        // 입력 시작(start)만으로는 해제하지 않아, 움직임 없는 start 이벤트에 선택이 풀리지 않는다
        const c = controls.current
        const start = interaction.current
        if (!c || !start) return
        if (camera.position.distanceTo(start.position) > USER_MOVE_THRESHOLD || c.target.distanceTo(start.target) > USER_MOVE_THRESHOLD) {
          interaction.current = null
          useFactoryStore.getState().clearArea()
        }
      }}
      onStart={() => {
        // 사용자가 조작을 시작하면 진행 중인 구역 이동을 멈춘다
        flight.current = null
        const c = controls.current
        if (c) interaction.current = { position: camera.position.clone(), target: c.target.clone() }
      }}
      onEnd={() => {
        interaction.current = null
      }}
    />
  )
}
