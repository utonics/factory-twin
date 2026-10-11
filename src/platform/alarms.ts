import type { SensorSpec } from '../data/sensorCatalog'

export type AlarmLevel = 'warn' | 'crit'

export interface AlarmRecord {
  id: number
  assetId: string
  assetName: string
  /** 센서 태그, 설비 고장은 'fault' */
  tag: string
  label: string
  level: AlarmLevel
  value: number | null
  unit: string
  /** 값 표시 소수 자릿수 */
  digits: number
  raisedAt: number
  clearedAt: number | null
  acknowledged: boolean
}

/** 경고 상태가 이 시간(초) 이상 이어져야 알람을 올린다(순간 튐 무시) */
export const ALARM_DEBOUNCE = 3
/** 해제 시 임계치에서 이만큼(비율) 더 벗어나야 해제(경계에서 깜빡임 방지) */
export const ALARM_HYSTERESIS = 0.03
const HISTORY_LIMIT = 80

type Rank = 0 | 1 | 2
type AlarmMeta = Pick<AlarmRecord, 'assetId' | 'assetName' | 'tag' | 'label' | 'unit' | 'digits'>

/** 히스테리시스를 적용한 목표 등급 */
export function evaluateLevel(value: number, limits: NonNullable<SensorSpec['limits']>, current: Rank): Rank {
  const sign = limits.direction === 'high' ? 1 : -1
  const v = value * sign
  const warn = limits.warn * sign
  const crit = limits.crit * sign
  const margin = (threshold: number) => Math.abs(threshold) * ALARM_HYSTERESIS
  if (v >= crit || (current >= 2 && v > crit - margin(crit))) return 2
  if (v >= warn || (current >= 1 && v > warn - margin(warn))) return 1
  return 0
}

interface Track {
  rank: Rank
  /** 현재 등급보다 높은 값이 이어진 구간. rank는 그 구간에서 본 가장 낮은 목표 등급 */
  pending: { rank: Rank; since: number } | null
  alarm: AlarmRecord | null
}

/** 센서 임계치·설비 고장 알람의 발생·격상·해제·확인을 관리한다 */
export class AlarmEngine {
  /** 자산별 추적 상태(태그 → Track) */
  private readonly tracks = new Map<string, Map<string, Track>>()
  private readonly history: AlarmRecord[] = []
  private nextId = 1

  private track(assetId: string, tag: string): Track {
    let byTag = this.tracks.get(assetId)
    if (!byTag) {
      byTag = new Map()
      this.tracks.set(assetId, byTag)
    }
    let t = byTag.get(tag)
    if (!t) {
      t = { rank: 0, pending: null, alarm: null }
      byTag.set(tag, t)
    }
    return t
  }

  evaluate(ts: number, assetId: string, assetName: string, spec: SensorSpec, value: number): void {
    if (!spec.limits) return
    const t = this.track(assetId, spec.tag)
    const target = evaluateLevel(value, spec.limits, t.rank)
    if (target > t.rank) {
      // 경고·위험 구간을 오가도 '경고 이상'이 이어지면 대기 시간을 이어서 센다
      if (!t.pending) t.pending = { rank: target, since: ts }
      else if (target < t.pending.rank) t.pending.rank = target
      if (ts - t.pending.since >= ALARM_DEBOUNCE) {
        this.setRank(t, t.pending.rank, ts, { assetId, assetName, tag: spec.tag, label: spec.label, unit: spec.unit, digits: spec.digits })
        t.pending = null
      }
    } else {
      t.pending = null
      if (target < t.rank) this.setRank(t, target, ts, null)
    }
    if (t.alarm) t.alarm.value = value
  }

  /** 판단에서 제외한 샘플(예: 정지 중 진동)이 끼면 연속성이 끊긴 것으로 보고 대기를 초기화 */
  interrupt(assetId: string, tag: string): void {
    const t = this.tracks.get(assetId)?.get(tag)
    if (t) t.pending = null
  }

  /** 설비 고장은 디바운스 없이 즉시 위험 등급 */
  setFault(ts: number, assetId: string, assetName: string, active: boolean): void {
    const t = this.track(assetId, 'fault')
    this.setRank(t, active ? 2 : 0, ts, { assetId, assetName, tag: 'fault', label: '설비 고장', unit: '', digits: 0 })
  }

  private setRank(t: Track, rank: Rank, ts: number, meta: AlarmMeta | null): void {
    if (rank === t.rank) return
    t.rank = rank
    if (rank === 0) {
      if (t.alarm) t.alarm.clearedAt = ts
      t.alarm = null
      return
    }
    const level: AlarmLevel = rank === 2 ? 'crit' : 'warn'
    if (t.alarm) {
      t.alarm.level = level
      // 격상되면 다시 확인이 필요
      if (level === 'crit') t.alarm.acknowledged = false
      return
    }
    if (!meta) return
    t.alarm = { id: this.nextId++, ...meta, level, value: null, raisedAt: ts, clearedAt: null, acknowledged: false }
    this.history.unshift(t.alarm)
    if (this.history.length > HISTORY_LIMIT) this.history.length = HISTORY_LIMIT
  }

  acknowledge(id: number): void {
    const alarm = this.history.find((a) => a.id === id)
    if (alarm) alarm.acknowledged = true
  }

  /** 자산의 현재 최고 알람 등급 */
  levelOf(assetId: string): Rank {
    let rank: Rank = 0
    const byTag = this.tracks.get(assetId)
    if (byTag) for (const t of byTag.values()) if (t.rank > rank) rank = t.rank
    return rank
  }

  records(): AlarmRecord[] {
    return this.history
  }
}
