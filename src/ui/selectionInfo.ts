import type { FactorySnapshot } from '../sim/snapshot'
import { AGV_STATUS_COLOR, STATION_STATUS_COLOR } from '../scene/theme'
import {
  AGV_STATUS_LABEL,
  formatDuration,
  ITEM_STAGE_LABEL,
  percent,
  STATION_KIND_LABEL,
  STATION_STATUS_LABEL,
  TRUCK_STATUS_LABEL,
} from './labels'

export interface SelectionInfo {
  kindLabel: string
  title: string
  subtitle: string
  statusLabel: string
  statusColor: string
  /** 진행 막대(라벨, 0~1) */
  meter: { label: string; value: number; color: string } | null
  rows: [string, string][]
}

const TRUCK_COLOR = { away: '#94a3b8', arriving: '#2f5bea', docked: '#22b573', departing: '#2f5bea' } as const

/** 선택된 객체의 상세 정보를 스냅샷에서 뽑아 패널·라벨 공용 형태로 만든다 */
export function selectionInfo(snapshot: FactorySnapshot, id: string): SelectionInfo | null {
  const station = snapshot.stations.find((s) => s.id === id)
  if (station) {
    return {
      kindLabel: `설비 · ${station.lineName}`,
      title: station.name,
      subtitle: `${station.id} · ${STATION_KIND_LABEL[station.kind]}`,
      statusLabel: STATION_STATUS_LABEL[station.status],
      statusColor: STATION_STATUS_COLOR[station.status],
      meter:
        station.status === 'down'
          ? { label: `수리 중 · 잔여 ${formatDuration(station.repairRemaining)}`, value: 1, color: STATION_STATUS_COLOR.down }
          : { label: '사이클 진행률', value: station.progress, color: STATION_STATUS_COLOR.processing },
      rows: [
        ['작업 중 제품', station.itemStage ? ITEM_STAGE_LABEL[station.itemStage] : '없음'],
        ['사이클 타임', `${station.currentCycleTime.toFixed(1)}초 (기준 ${station.cycleTime.toFixed(1)}초)`],
        ['처리 수량', `${station.processed.toLocaleString()}개`],
        ...(station.kind === 'inspection' ? ([['불량 판정', `${station.ngCount}개`]] as [string, string][]) : []),
        ['가동률', percent(station.utilization)],
        ['고장 횟수', `${station.faultCount}회`],
        ['현재 상태 지속', formatDuration(snapshot.time - station.statusSince)],
      ],
    }
  }

  const agv = snapshot.agvs.find((a) => a.id === id)
  if (agv) {
    return {
      kindLabel: 'AGV · 자율 운반차',
      title: agv.name,
      subtitle: agv.task,
      statusLabel: AGV_STATUS_LABEL[agv.status],
      statusColor: AGV_STATUS_COLOR[agv.status],
      meter: { label: `배터리 ${agv.battery.toFixed(0)}%`, value: agv.battery / 100, color: agv.battery < 30 ? '#ef4444' : '#22b573' },
      rows: [
        ['적재물', agv.cargo === 'raw' ? '원자재 팔레트' : agv.cargo === 'finished' ? '완제품 팔레트' : '없음'],
        ['현재 위치', agv.stopName ?? '주행로'],
        ['속도', `${(agv.speed * 3.6).toFixed(1)} km/h`],
        ['운반 완료', `${agv.deliveries}회`],
        ['누적 주행', `${(agv.odometer / 1000).toFixed(2)} km`],
      ],
    }
  }

  if (id === 'TRUCK') {
    const t = snapshot.truck
    return {
      kindLabel: '출하 트럭',
      title: t.status === 'away' ? '다음 트럭 대기' : t.id,
      subtitle: t.status === 'away' ? '배차 대기 중' : t.plate,
      statusLabel: TRUCK_STATUS_LABEL[t.status],
      statusColor: TRUCK_COLOR[t.status],
      meter: { label: `상차 ${t.load}/${t.capacity} 팔레트`, value: t.load / t.capacity, color: '#2f5bea' },
      rows: [
        ['적치장 대기', `${t.staged}/${t.stagingCapacity} 팔레트`],
        ['누적 출하', `${t.shippedPallets} 팔레트`],
        ['출발 트럭', `${t.trucksDispatched}대`],
      ],
    }
  }

  const line = snapshot.lines.find((l) => l.id === id)
  if (line) {
    const down = snapshot.stations.filter((s) => s.lineId === id && s.status === 'down').length
    return {
      kindLabel: '생산 라인',
      title: line.name,
      subtitle: `${line.id} · ${snapshot.stations.filter((s) => s.lineId === id).length}개 공정`,
      statusLabel: down > 0 ? `고장 ${down}대` : '정상 가동',
      statusColor: down > 0 ? STATION_STATUS_COLOR.down : STATION_STATUS_COLOR.processing,
      meter: { label: `팔레트 적재 ${line.palletFill}/${line.palletSize}`, value: line.palletFill / line.palletSize, color: '#2f5bea' },
      rows: [
        ['투입 대기 자재', `${line.inputUnits}개 (+운반 중 ${line.inboundUnits}개)`],
        ['투입 누계', `${line.started.toLocaleString()}개`],
        ['생산 완료', `${line.completed.toLocaleString()}개`],
        ['불량', `${line.rejected}개`],
        ['출하 대기 팔레트', `${line.readyPallets}개`],
      ],
    }
  }
  return null
}
