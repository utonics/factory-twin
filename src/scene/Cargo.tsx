import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Object3D, type InstancedMesh } from 'three'
import type { CargoKind } from '../domain/types'
import { simulation } from '../runtime'
import { AGV_DECK_Y, AGV_LIFT_STROKE, displayedCargo, liftAmount } from './agvVisual'
import { COLORS } from './theme'

const PALLET_CAPACITY = 64
const BOX_CAPACITY = PALLET_CAPACITY * 8
const PALLET_H = 0.14
const BOX = 0.46

interface PalletInstance {
  x: number
  y: number
  z: number
  rotY: number
  units: number
  kind: CargoKind
}

/**
 * 시뮬레이션 상태에서 화면에 놓일 팔레트(투입·배출 버퍼, AGV 적재물, 출하 적치장)를 계산.
 * 매 프레임 호출되므로 객체를 새로 만들지 않고 pool을 재사용하며, 채운 개수를 돌려준다.
 */
function collectPallets(pool: PalletInstance[]): number {
  let count = 0
  const { state, layout, path } = simulation
  const push = (x: number, z: number, units: number, kind: CargoKind, y = 0, rotY = 0) => {
    const p = pool[count] ?? (pool[count] = { x: 0, y: 0, z: 0, rotY: 0, units: 0, kind })
    p.x = x
    p.y = y
    p.z = z
    p.rotY = rotY
    p.units = units
    p.kind = kind
    count++
  }

  for (const spec of layout.lines) {
    const line = state.lines[spec.id]
    const inX = spec.xStart - 2.2
    // 투입 버퍼: 팔레트 단위로 나눠 3칸에 적치
    let remaining = line.inputUnits
    for (let slot = 0; remaining > 0; slot++) {
      const units = Math.min(spec.palletSize, remaining)
      push(inX, spec.z + (slot - 1) * 1.25, units, 'raw')
      remaining -= units
    }
    push(spec.xEnd + 1.6, spec.z, line.palletFill, 'finished')
    for (let i = 0; i < line.readyPallets; i++) push(spec.xEnd + 3.3, spec.z + (i === 0 ? -0.95 : 0.95), spec.palletSize, 'finished')
  }

  const pickup = layout.warehouse.pickup
  push(pickup.x, pickup.z, 8, 'raw')

  for (const agv of state.agvs) {
    const kind = displayedCargo(agv)
    if (!kind) continue
    const pose = path.pose(agv.s)
    push(pose.x, pose.z, 8, kind, AGV_DECK_Y + liftAmount(agv) * AGV_LIFT_STROKE, -pose.heading)
  }

  const { stagingOrigin } = layout.shipping
  for (let i = 0; i < state.shipping.staged; i++) {
    push(stagingOrigin.x + (i % 5) * 1.5, stagingOrigin.z + Math.floor(i / 5) * 1.5, 8, 'finished')
  }
  return count
}

export function Cargo() {
  const pallets = useRef<InstancedMesh>(null)
  const rawBoxes = useRef<InstancedMesh>(null)
  const finishedBoxes = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const pool = useMemo<PalletInstance[]>(() => [], [])
  const geometries = useMemo(() => ({ pallet: new BoxGeometry(1.1, PALLET_H, 1.1), box: new BoxGeometry(BOX, BOX, BOX) }), [])
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries])

  useFrame(() => {
    if (!pallets.current || !rawBoxes.current || !finishedBoxes.current) return
    const count = Math.min(collectPallets(pool), PALLET_CAPACITY)
    let p = 0
    let raw = 0
    let fin = 0
    for (let k = 0; k < count; k++) {
      const pallet = pool[k]
      dummy.position.set(pallet.x, pallet.y + PALLET_H / 2, pallet.z)
      dummy.rotation.set(0, pallet.rotY, 0)
      dummy.updateMatrix()
      pallets.current.setMatrixAt(p++, dummy.matrix)
      const cos = Math.cos(pallet.rotY)
      const sin = Math.sin(pallet.rotY)
      for (let u = 0; u < pallet.units; u++) {
        const layer = Math.floor(u / 4)
        const lx = (u % 2 === 0 ? -1 : 1) * 0.27
        const lz = (u % 4 < 2 ? -1 : 1) * 0.27
        dummy.position.set(pallet.x + lx * cos + lz * sin, pallet.y + PALLET_H + BOX / 2 + layer * BOX, pallet.z - lx * sin + lz * cos)
        dummy.updateMatrix()
        if (pallet.kind === 'raw' && raw < BOX_CAPACITY) rawBoxes.current.setMatrixAt(raw++, dummy.matrix)
        if (pallet.kind === 'finished' && fin < BOX_CAPACITY) finishedBoxes.current.setMatrixAt(fin++, dummy.matrix)
      }
    }
    pallets.current.count = p
    rawBoxes.current.count = raw
    finishedBoxes.current.count = fin
    pallets.current.instanceMatrix.needsUpdate = true
    rawBoxes.current.instanceMatrix.needsUpdate = true
    finishedBoxes.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={pallets} args={[geometries.pallet, undefined, PALLET_CAPACITY]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial color={COLORS.pallet} />
      </instancedMesh>
      <instancedMesh ref={rawBoxes} args={[geometries.box, undefined, BOX_CAPACITY]} castShadow frustumCulled={false}>
        <meshStandardMaterial color={COLORS.rawPart} />
      </instancedMesh>
      <instancedMesh ref={finishedBoxes} args={[geometries.box, undefined, BOX_CAPACITY]} castShadow frustumCulled={false}>
        <meshStandardMaterial color={COLORS.cardboard} />
      </instancedMesh>
    </>
  )
}
