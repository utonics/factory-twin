import { factoryLayout } from './data/factoryLayout'
import { MessageBus } from './platform/bus'
import { DataProcessor } from './platform/processor'
import { FactorySimulation } from './sim/engine'
import { VirtualPlant } from './sim/virtualPlant'

// 앱 전체가 공유하는 구성:
//   시뮬레이터(설비 동작) → 가상 공장(센서·이벤트 발행) → 메시지 버스 → 데이터 처리기
// 3D 장면은 시뮬레이터 상태를 직접 읽어 움직임을 그리고,
// 분석 화면(OEE·알람·센서 추이)은 처리기 결과만 읽는다.

export const simulation = new FactorySimulation(factoryLayout)
export const bus = new MessageBus()
export const plant = new VirtualPlant(simulation, bus)
export const processor = new DataProcessor(factoryLayout, bus)

// 화면이 처음부터 가동 중인 상태(데이터 이력 포함)로 보이도록 미리 진행
plant.step(240)
