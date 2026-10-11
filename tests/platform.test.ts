import { describe, expect, it } from 'vitest'
import { factoryLayout } from '../src/data/factoryLayout'
import { SENSOR_CATALOG } from '../src/data/sensorCatalog'
import { AlarmEngine, evaluateLevel } from '../src/platform/alarms'
import { MessageBus } from '../src/platform/bus'
import { DataProcessor, linearTrend } from '../src/platform/processor'
import { FactorySimulation } from '../src/sim/engine'
import { VirtualPlant } from '../src/sim/virtualPlant'

const vibration = SENSOR_CATALOG.cnc.find((s) => s.tag === 'vibration')!
const airPressure = SENSOR_CATALOG.packaging.find((s) => s.tag === 'airPressure')!

function createPipeline(seed: number) {
  const simulation = new FactorySimulation(factoryLayout, { seed })
  const bus = new MessageBus()
  return { simulation, bus, plant: new VirtualPlant(simulation, bus), processor: new DataProcessor(factoryLayout, bus) }
}

describe('알람 판정', () => {
  it('히스테리시스: 발생한 알람은 임계치보다 조금 더 내려가야 해제된다', () => {
    expect(evaluateLevel(4.6, vibration.limits!, 0)).toBe(1)
    expect(evaluateLevel(4.45, vibration.limits!, 0)).toBe(0)
    expect(evaluateLevel(4.45, vibration.limits!, 1)).toBe(1)
    expect(evaluateLevel(4.3, vibration.limits!, 1)).toBe(0)
    expect(evaluateLevel(6.1, vibration.limits!, 1)).toBe(2)
  })

  it('낮을수록 위험한 센서(공압)도 같은 규칙을 따른다', () => {
    expect(evaluateLevel(5.3, airPressure.limits!, 0)).toBe(1)
    expect(evaluateLevel(4.9, airPressure.limits!, 0)).toBe(2)
    expect(evaluateLevel(5.6, airPressure.limits!, 1)).toBe(0)
  })

  it('디바운스: 3초 이상 지속돼야 알람이 발생하고, 해제 후 기록에 남는다', () => {
    const engine = new AlarmEngine()
    engine.evaluate(0, 'X', '설비 X', vibration, 5)
    engine.evaluate(2, 'X', '설비 X', vibration, 5)
    expect(engine.records()).toHaveLength(0)
    engine.evaluate(3, 'X', '설비 X', vibration, 5)
    expect(engine.records()).toHaveLength(1)
    expect(engine.levelOf('X')).toBe(1)
    engine.evaluate(4, 'X', '설비 X', vibration, 2)
    expect(engine.levelOf('X')).toBe(0)
    expect(engine.records()[0].clearedAt).toBe(4)
  })

  it('위험 등급으로 격상되면 확인 상태가 다시 미확인이 된다', () => {
    const engine = new AlarmEngine()
    for (let t = 0; t <= 3; t++) engine.evaluate(t, 'X', '설비 X', vibration, 5)
    engine.acknowledge(engine.records()[0].id)
    for (let t = 4; t <= 7; t++) engine.evaluate(t, 'X', '설비 X', vibration, 6.5)
    expect(engine.records()[0].level).toBe('crit')
    expect(engine.records()[0].acknowledged).toBe(false)
  })
})

describe('추세 계산', () => {
  it('직선 데이터의 기울기와 끝점 추정값을 구한다', () => {
    const points: [number, number][] = Array.from({ length: 10 }, (_, i) => [i, 2 + 0.5 * i])
    const trend = linearTrend(points)!
    expect(trend.slope).toBeCloseTo(0.5)
    expect(trend.fitted).toBeCloseTo(6.5)
  })
})

describe('데이터 파이프라인', () => {
  it('처리기 집계가 공장 실제 수치와 일치한다', () => {
    const { simulation, plant, processor } = createPipeline(3)
    plant.step(3600)
    const snapshot = processor.snapshot(null)
    for (const line of factoryLayout.lines) {
      expect(snapshot.lines[line.id].good).toBe(simulation.state.lines[line.id].completed)
      expect(snapshot.lines[line.id].ng).toBe(simulation.state.lines[line.id].rejected)
    }
  })

  it('OEE 지표는 0~1 범위이고 라인 OEE = A × P × Q 이다', () => {
    const { plant, processor } = createPipeline(4)
    plant.step(3600)
    const snapshot = processor.snapshot(null)
    for (const line of Object.values(snapshot.lines)) {
      for (const v of [line.oee, line.availability, line.performance, line.quality]) {
        expect(v).toBeGreaterThan(0)
        expect(v).toBeLessThanOrEqual(1)
      }
      expect(line.oee).toBeCloseTo(line.availability * line.performance * line.quality, 6)
    }
  })

  it('센서 텔레메트리가 1초마다 모든 자산에서 수집된다', () => {
    const { plant, processor } = createPipeline(5)
    plant.step(120)
    const assets = factoryLayout.lines.reduce((n, l) => n + l.stations.length, 0) + factoryLayout.agv.fleet.length
    const snapshot = processor.snapshot('L1-CNC')
    expect(snapshot.messagesPerMinute).toBeGreaterThanOrEqual(assets * 60)
    for (const s of snapshot.selectedSeries!.series) expect(s.points.length).toBeGreaterThanOrEqual(119)
  })

  it('마모로 인한 고장의 상당수는 고장 직전에 센서 알람이 먼저 발생한다', () => {
    const simulation = new FactorySimulation(factoryLayout, { seed: 6 })
    const bus = new MessageBus()
    const processor = new DataProcessor(factoryLayout, bus)
    let faults = 0
    let precededBySensorAlarm = 0
    // 가상 공장보다 먼저 구독해, 고장 이벤트가 처리기에 전달되기 전의 알람 상태를 본다
    simulation.subscribe((event) => {
      if (event.type !== 'stationState' || event.state !== 'down') return
      faults++
      const active = processor.alarms.records().some((a) => a.assetId === event.stationId && a.tag !== 'fault' && a.clearedAt === null)
      if (active) precededBySensorAlarm++
    })
    new VirtualPlant(simulation, bus).step(7200)
    expect(faults).toBeGreaterThan(10)
    expect(precededBySensorAlarm / faults).toBeGreaterThan(0.3)
  })
})

describe('출하 오더·도크·재고', () => {
  it('완료 오더의 출하 팔레트 합이 오더 수량과 같고, 납기 준수율이 계산된다', () => {
    const { simulation, plant, processor } = createPipeline(2)
    let shippedToOrders = 0
    simulation.subscribe((e) => {
      if (e.type === 'orderShipped') shippedToOrders += e.pallets
    })
    plant.step(7200)
    const { orders } = processor.snapshot(null)
    expect(orders.completed).toBeGreaterThan(10)
    expect(orders.onTimeRate).not.toBeNull()
    expect(orders.onTimeRate!).toBeGreaterThan(0)
    expect(orders.onTimeRate!).toBeLessThanOrEqual(1)
    // 오더에 배정된 팔레트는 실제 출하량을 넘을 수 없다
    expect(shippedToOrders).toBeLessThanOrEqual(simulation.state.shipping.shippedPallets)
    for (const o of orders.list) expect(o.shipped).toBeLessThanOrEqual(o.pallets)
  })

  it('도크 사용·운행 트럭 수가 트럭 상태와 일치한다', () => {
    const { simulation, plant, processor } = createPipeline(3)
    for (let i = 0; i < 60; i++) {
      plant.step(30)
      const { logistics } = processor.snapshot(null)
      const trucks = simulation.state.shipping.trucks
      expect(logistics.docksInUse).toBe(trucks.filter((t) => t.status === 'docked').length)
      expect(logistics.activeTrucks).toBe(trucks.filter((t) => t.status !== 'away').length)
    }
  })

  it('창고 재고는 0~용량 범위를 지키고, 부족하면 긴급 발주로 회복된다', () => {
    const { simulation, plant } = createPipeline(4)
    let expedited = false
    simulation.subscribe((e) => {
      if (e.type === 'materialReceived' && e.expedited) expedited = true
    })
    for (let i = 0; i < 720; i++) {
      plant.step(10)
      const { stock } = simulation.state.warehouse
      expect(stock).toBeGreaterThanOrEqual(0)
      expect(stock).toBeLessThanOrEqual(factoryLayout.warehouse.capacity)
    }
    expect(expedited).toBe(true)
  })
})
