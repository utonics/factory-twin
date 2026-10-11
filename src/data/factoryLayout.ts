import type { FactoryLayout, LineSpec, StationSpec } from '../domain/types'

// 좌표계: x = 동(+)/서(-), z = 남(+)/북(-), 단위 m.
// 흐름: 서쪽 자재창고 → AGV → 생산라인(서→동) → AGV → 동쪽 출하 도크.

function makeLine(id: string, name: string, z: number, seedOffset: number): LineSpec {
  const station = (
    suffix: string,
    stationName: string,
    kind: StationSpec['kind'],
    x: number,
    cycleTime: number,
    mtbf: number,
    mttr: number,
    wearRate: number,
    ngRate?: number,
  ): StationSpec => ({
    id: `${id}-${suffix}`,
    lineId: id,
    name: stationName,
    kind,
    x,
    cycleTime: cycleTime + seedOffset,
    cycleJitter: 0.12,
    mtbf,
    mttr,
    wearRate,
    ngRate,
  })

  return {
    id,
    name,
    z,
    xStart: -19,
    xEnd: 21,
    stations: [
      // 마모율: 1/마모율 = 마모가 1.0에 도달하는 가공 시간(초)
      station('CNC', 'CNC 가공기', 'cnc', -12, 6.5, 900, 25, 1 / 1300),
      station('RBT', '용접 로봇 셀', 'robot', -3, 7, 1100, 20, 1 / 1800),
      station('VIS', '비전 검사기', 'inspection', 6, 4.5, 2400, 15, 1 / 2600, 0.04),
      station('PKG', '자동 포장기', 'packaging', 14, 5.5, 1500, 18, 1 / 1700),
    ],
    conveyorSpeed: 1.1,
    itemSpacing: 1.25,
    stationLength: 3,
    inputCapacity: 24,
    palletSize: 8,
    outputSlots: 2,
  }
}

export const factoryLayout: FactoryLayout = {
  name: '스마트 팩토리 1공장',
  floor: { minX: -46, maxX: 46, minZ: -28, maxZ: 28 },
  lines: [makeLine('L1', '1라인', -8, 0), makeLine('L2', '2라인', 8, 0.4)],
  agv: {
    // 반시계 방향 단방향 순환 경로: 서측(북상) → 북측(동진) → 동측(남하) → 남측(서진)
    corners: [
      { x: -24, z: 20 },
      { x: -24, z: -20 },
      { x: 26, z: -20 },
      { x: 26, z: 20 },
    ],
    cornerRadius: 3,
    speed: 3,
    accel: 2,
    safeGap: 2.6,
    stops: [
      { id: 'ST-WH', kind: 'warehouse', name: '자재창고 출고장', point: { x: -24, z: 14 } },
      { id: 'ST-L2-IN', kind: 'lineInput', name: '2라인 투입구', lineId: 'L2', point: { x: -24, z: 8 } },
      { id: 'ST-L1-IN', kind: 'lineInput', name: '1라인 투입구', lineId: 'L1', point: { x: -24, z: -8 } },
      { id: 'ST-L1-OUT', kind: 'lineOutput', name: '1라인 배출구', lineId: 'L1', point: { x: 26, z: -8 } },
      { id: 'ST-L2-OUT', kind: 'lineOutput', name: '2라인 배출구', lineId: 'L2', point: { x: 26, z: 8 } },
      { id: 'ST-SHIP', kind: 'shipping', name: '출하 적치장', point: { x: 26, z: 15 } },
      { id: 'ST-PARK', kind: 'park', name: '충전 스테이션', point: { x: 2, z: 20 } },
    ],
    fleet: [
      { id: 'AGV-01', name: 'AGV-01', startAt: 0.02 },
      { id: 'AGV-02', name: 'AGV-02', startAt: 0.22 },
      { id: 'AGV-03', name: 'AGV-03', startAt: 0.42 },
      { id: 'AGV-04', name: 'AGV-04', startAt: 0.62 },
      { id: 'AGV-05', name: 'AGV-05', startAt: 0.82 },
    ],
  },
  warehouse: { minX: -42, maxX: -28, minZ: -20, maxZ: 20, pickup: { x: -26.4, z: 14 }, capacity: 140, initialStock: 70 },
  shipping: {
    stagingOrigin: { x: 29.5, z: 11 },
    stagingCapacity: 10,
    truckCapacity: 6,
    dockX: 40,
    docks: [
      { id: 'DOCK-1', name: '1번 도크', z: 12.4 },
      { id: 'DOCK-2', name: '2번 도크', z: 17.6 },
    ],
  },
}
