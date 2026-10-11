import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import type { LineSpec, StationSpec } from '../domain/types'
import { BELT_Y, COLORS, sceneDelta } from './theme'
import { Selectable } from './Selectable'
import { CncMachine } from './stations/CncMachine'
import { InspectionStation } from './stations/InspectionStation'
import { PackagingMachine } from './stations/PackagingMachine'
import { RobotCell } from './stations/RobotCell'
import { StackLight } from './stations/StackLight'

const BELT_WIDTH = 1.0
const BELT_TILE = 0.5

function createBeltTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = COLORS.belt
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#4a515c'
  ctx.fillRect(0, 0, 10, 64)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  return texture
}

function StationModel({ spec }: { spec: StationSpec }) {
  switch (spec.kind) {
    case 'cnc':
      return <CncMachine spec={spec} />
    case 'robot':
      return <RobotCell spec={spec} />
    case 'inspection':
      return <InspectionStation spec={spec} />
    case 'packaging':
      return <PackagingMachine spec={spec} />
  }
}

function Conveyor({ line }: { line: LineSpec }) {
  const length = line.xEnd - line.xStart
  const centerX = (line.xStart + line.xEnd) / 2
  const texture = useMemo(() => {
    const t = createBeltTexture()
    t.repeat.set(length / BELT_TILE, 1)
    return t
  }, [length])
  useEffect(() => () => texture.dispose(), [texture])

  useFrame((_, delta) => {
    // 벨트 무늬를 이송 방향(+x)으로 흘려 보낸다
    texture.offset.x -= (sceneDelta(delta) * line.conveyorSpeed) / BELT_TILE
  })

  const legs = useMemo(() => {
    const xs: number[] = []
    for (let x = line.xStart + 0.4; x < line.xEnd; x += 1.6) xs.push(x)
    return xs
  }, [line.xStart, line.xEnd])

  return (
    <group position={[centerX, 0, 0]}>
      <mesh position={[0, BELT_Y - 0.04, 0]} receiveShadow>
        <boxGeometry args={[length, 0.08, BELT_WIDTH]} />
        <meshStandardMaterial color={COLORS.belt} />
      </mesh>
      <mesh position={[0, BELT_Y + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[length, BELT_WIDTH]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, BELT_Y + 0.02, side * (BELT_WIDTH / 2 + 0.05)]} castShadow>
          <boxGeometry args={[length, 0.16, 0.1]} />
          <meshStandardMaterial color={COLORS.steel} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {legs.map((x) =>
        [-1, 1].map((side) => (
          <mesh key={`${x}:${side}`} position={[x - centerX, (BELT_Y - 0.08) / 2, side * 0.45]} castShadow>
            <boxGeometry args={[0.08, BELT_Y - 0.08, 0.08]} />
            <meshStandardMaterial color={COLORS.steelDark} />
          </mesh>
        )),
      )}
    </group>
  )
}

export function ProductionLine({ line }: { line: LineSpec }) {
  return (
    <group position={[0, 0, line.z]}>
      <Conveyor line={line} />
      {line.stations.map((spec) => (
        <Selectable key={spec.id} id={spec.id} position={[spec.x, 0, 0]}>
          <StationModel spec={spec} />
          <StackLight stationId={spec.id} position={[1.3, 0, -1.15]} />
        </Selectable>
      ))}
      {/* 투입·배출 영역(클릭 시 라인 정보) */}
      <Selectable id={line.id} position={[line.xStart - 2.2, 0, 0]}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.0, 4.0]} />
          <meshStandardMaterial color={COLORS.primary} transparent opacity={0.12} />
        </mesh>
      </Selectable>
      <Selectable id={line.id} position={[line.xEnd + 2.4, 0, 0]}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.4, 3.6]} />
          <meshStandardMaterial color={COLORS.primary} transparent opacity={0.12} />
        </mesh>
      </Selectable>
      {/* 배출단 팔레타이저 프레임 */}
      <group position={[line.xEnd + 1.5, 0, 0]}>
        {[-0.8, 0.8].map((z) => (
          <mesh key={z} position={[0, 1.4, z]} castShadow>
            <boxGeometry args={[0.12, 2.8, 0.12]} />
            <meshStandardMaterial color={COLORS.primary} />
          </mesh>
        ))}
        <mesh position={[0, 2.8, 0]} castShadow>
          <boxGeometry args={[0.2, 0.18, 1.8]} />
          <meshStandardMaterial color={COLORS.primary} />
        </mesh>
      </group>
    </group>
  )
}
