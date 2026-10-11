import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { plant, simulation } from '../runtime'
import { useFactoryStore } from '../store/useFactoryStore'
import { Agvs } from './Agvs'
import { AlarmBeacons } from './AlarmBeacons'
import { CameraRig, HOME_POSITION } from './CameraRig'
import { Cargo } from './Cargo'
import { FactoryFloor } from './FactoryFloor'
import { LabelProjector } from './LabelProjector'
import { ProductionLine } from './ProductionLine'
import { Products } from './Products'
import { SelectionMarker } from './SelectionMarker'
import { ShaderWarmup } from './ShaderWarmup'
import { ShippingDock } from './ShippingDock'
import { COLORS } from './theme'
import { Warehouse } from './Warehouse'

const SNAPSHOT_INTERVAL = 0.25

/** 매 프레임 가상 공장(시뮬레이션+센서 데이터 발행)을 진행시키고, UI용 스냅샷은 4Hz로만 갱신한다 */
function SimulationDriver() {
  const elapsed = useRef(0)
  useFrame((_, delta) => {
    const { paused, speed, refreshSnapshot } = useFactoryStore.getState()
    // 일시정지 중에는 데이터가 바뀌지 않으므로 UI 갱신도 건너뛴다(선택·확인 등은 스토어가 즉시 갱신)
    if (paused) return
    plant.step(Math.min(delta, 0.1) * speed)
    elapsed.current += delta
    if (elapsed.current >= SNAPSHOT_INTERVAL) {
      elapsed.current = 0
      refreshSnapshot()
    }
  })
  return null
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c9d3e0', 1.4]} />
      <directionalLight
        position={[30, 55, 25]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
    </>
  )
}

export function FactoryCanvas() {
  const pointerDown = useRef({ x: 0, y: 0 })
  const select = useFactoryStore((s) => s.select)

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: HOME_POSITION.toArray(), fov: 32, near: 0.5, far: 400 }}
      onPointerDown={(e) => (pointerDown.current = { x: e.clientX, y: e.clientY })}
      onPointerMissed={(e) => {
        // 드래그로 카메라를 움직인 경우에는 선택을 유지
        if (Math.hypot(e.clientX - pointerDown.current.x, e.clientY - pointerDown.current.y) < 5) select(null)
      }}
    >
      <color attach="background" args={[COLORS.background]} />
      <fog attach="fog" args={[COLORS.background, 110, 220]} />
      <SimulationDriver />
      <Lights />
      <CameraRig />
      <FactoryFloor />
      <Warehouse />
      {simulation.layout.lines.map((line) => (
        <ProductionLine key={line.id} line={line} />
      ))}
      <Products />
      <Cargo />
      <Agvs />
      <ShippingDock />
      <AlarmBeacons />
      <SelectionMarker />
      <LabelProjector />
      <ShaderWarmup />
    </Canvas>
  )
}
