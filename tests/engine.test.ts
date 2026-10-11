import { describe, expect, it } from 'vitest'
import { factoryLayout } from '../src/data/factoryLayout'
import { FactorySimulation } from '../src/sim/engine'

describe('FactorySimulation', () => {
  it('1시간 가동 시 생산·물류·출하가 모두 진행된다', () => {
    const sim = new FactorySimulation(factoryLayout, { seed: 7 })
    sim.step(3600)
    const lines = Object.values(sim.state.lines)
    const completed = lines.reduce((sum, l) => sum + l.completed, 0)

    expect(completed).toBeGreaterThan(400)
    expect(sim.state.shipping.shippedPallets).toBeGreaterThan(30)
    for (const agv of sim.state.agvs) {
      expect(agv.deliveries).toBeGreaterThan(0)
      expect(Number.isFinite(agv.s)).toBe(true)
    }
  })

  it('투입 수량 = 완료 + 불량 + 재공(WIP) 으로 보존된다', () => {
    const sim = new FactorySimulation(factoryLayout, { seed: 11 })
    sim.step(1800)
    for (const spec of factoryLayout.lines) {
      const line = sim.state.lines[spec.id]
      // 불량 판정 제품은 배출 애니메이션 중에도 rejected로 집계되므로 WIP에서 제외
      let wip = 0
      for (const item of sim.state.items.values()) {
        if (item.lineId === spec.id && item.location.type !== 'reject') wip++
      }
      expect(line.started).toBe(line.completed + line.rejected + wip)
      expect(line.inputUnits).toBeGreaterThanOrEqual(0)
      expect(line.inboundUnits).toBeGreaterThanOrEqual(0)
    }
  })

  it('같은 구간의 제품은 최소 간격을 유지한다', () => {
    const sim = new FactorySimulation(factoryLayout, { seed: 3 })
    for (let t = 0; t < 600; t++) {
      sim.step(1)
      for (const spec of factoryLayout.lines) {
        const bySegment = new Map<number, number[]>()
        for (const item of sim.state.items.values()) {
          if (item.lineId !== spec.id || item.location.type !== 'segment') continue
          const list = bySegment.get(item.location.index) ?? []
          list.push(item.x)
          bySegment.set(item.location.index, list)
        }
        for (const xs of bySegment.values()) {
          xs.sort((a, b) => a - b)
          for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(spec.itemSpacing - 1e-6)
        }
      }
    }
  })

  it('본선 AGV끼리 안전 거리를 침범하지 않는다(합류 순간 포함)', () => {
    const sim = new FactorySimulation(factoryLayout, { seed: 5 })
    const minGap = factoryLayout.agv.safeGap * 0.8 - 1e-6
    for (let t = 0; t < 36000; t++) {
      sim.step(0.1)
      // 충전 분기선에 들어간 AGV는 본선을 떠난 상태라 비교에서 제외
      const onLoop = sim.state.agvs.filter((a) => a.track === 'loop')
      for (const a of onLoop) {
        for (const b of onLoop) {
          if (a === b) continue
          expect(sim.path.forwardDistance(a.s, b.s)).toBeGreaterThanOrEqual(minGap)
        }
      }
    }
  })

  it('같은 시드는 같은 결과를 낸다', () => {
    const a = new FactorySimulation(factoryLayout, { seed: 99 })
    const b = new FactorySimulation(factoryLayout, { seed: 99 })
    a.step(900)
    b.step(900)
    expect(a.state.lines).toEqual(b.state.lines)
    expect(a.state.agvs).toEqual(b.state.agvs)
  })
})

describe('AGV 정차', () => {
  it('운반 예약이 장시간 묶이지 않고 배터리가 바닥나지 않는다', () => {
    const sim = new FactorySimulation(factoryLayout, { seed: 1 })
    for (let t = 0; t < 7200; t += 10) {
      sim.step(10)
      for (const agv of sim.state.agvs) expect(agv.battery).toBeGreaterThan(5)
    }
    for (const agv of sim.state.agvs) expect(agv.deliveries).toBeGreaterThan(40)
  })
})

describe('충전 분기선', () => {
  it('충전은 분기선에서만 하고, 한 베이에는 한 대만 들어가며, 충전 후 본선에 다시 합류한다', () => {
    const sim = new FactorySimulation(factoryLayout, { seed: 2 })
    let entered = 0
    let merged = 0
    const track = new Map(sim.state.agvs.map((a) => [a.id, a.track]))
    for (let t = 0; t < 4 * 3600; t++) {
      sim.step(1)
      const bays = new Set<number>()
      for (const a of sim.state.agvs) {
        if (a.status === 'charging') expect(a.track).toBe('spur')
        if (a.bay !== null) {
          expect(bays.has(a.bay)).toBe(false)
          bays.add(a.bay)
        }
        const prev = track.get(a.id)
        if (prev === 'loop' && a.track === 'spur') entered++
        if (prev === 'spur' && a.track === 'loop') merged++
        track.set(a.id, a.track)
      }
    }
    expect(entered).toBeGreaterThan(10)
    expect(merged).toBeGreaterThan(10)
  })

  it('배터리가 바닥나지 않는다', () => {
    const sim = new FactorySimulation(factoryLayout, { seed: 3 })
    for (let t = 0; t < 4 * 3600; t += 5) {
      sim.step(5)
      for (const a of sim.state.agvs) expect(a.battery).toBeGreaterThan(15)
    }
  })
})
