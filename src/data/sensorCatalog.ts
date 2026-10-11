import type { StationKind } from '../domain/types'

export type AssetKind = StationKind | 'agv'

export interface SensorSpec {
  tag: string
  label: string
  unit: string
  digits: number
  /** 정상 운전 시 기준값(건강도 계산 기준) */
  nominal: number
  /** 경고·위험 임계치. 'high'는 값이 클수록, 'low'는 작을수록 위험 */
  limits?: { direction: 'high' | 'low'; warn: number; crit: number }
  /** 마모 추세를 대표하는 태그(예지 보전 계산 대상) */
  health?: boolean
  /** 가공 중일 때만 의미 있는 값(정지 중 샘플은 알람·추세 판단에서 제외) */
  whileRunning?: boolean
}

/** 설비 유형별 가상 센서 목록. 데이터 생성·알람·화면이 모두 이 정의를 따른다. */
export const SENSOR_CATALOG: Record<AssetKind, SensorSpec[]> = {
  cnc: [
    { tag: 'vibration', label: '스핀들 진동', unit: 'mm/s', digits: 2, nominal: 1.6, limits: { direction: 'high', warn: 4.5, crit: 6 }, health: true, whileRunning: true },
    { tag: 'spindleTemp', label: '스핀들 온도', unit: '°C', digits: 1, nominal: 48, limits: { direction: 'high', warn: 62, crit: 68 } },
    { tag: 'spindleLoad', label: '스핀들 부하', unit: '%', digits: 0, nominal: 62, limits: { direction: 'high', warn: 85, crit: 95 }, whileRunning: true },
    { tag: 'spindleSpeed', label: '스핀들 회전수', unit: 'rpm', digits: 0, nominal: 8000 },
  ],
  robot: [
    { tag: 'jointTorque', label: '관절 토크', unit: '%', digits: 0, nominal: 55, limits: { direction: 'high', warn: 82, crit: 92 }, health: true, whileRunning: true },
    { tag: 'motorTemp', label: '모터 온도', unit: '°C', digits: 1, nominal: 52, limits: { direction: 'high', warn: 64, crit: 70 } },
    { tag: 'weldCurrent', label: '용접 전류', unit: 'A', digits: 0, nominal: 205 },
  ],
  inspection: [
    { tag: 'lightLevel', label: '조명 광량', unit: '%', digits: 1, nominal: 100, limits: { direction: 'low', warn: 80, crit: 70 }, health: true },
    { tag: 'inspectTime', label: '판정 시간', unit: 'ms', digits: 0, nominal: 420 },
  ],
  packaging: [
    { tag: 'airPressure', label: '공압', unit: 'bar', digits: 2, nominal: 6.1, limits: { direction: 'low', warn: 5.4, crit: 5 }, health: true },
    { tag: 'motorTemp', label: '모터 온도', unit: '°C', digits: 1, nominal: 45, limits: { direction: 'high', warn: 60, crit: 66 } },
  ],
  agv: [
    { tag: 'battery', label: '배터리', unit: '%', digits: 0, nominal: 100, limits: { direction: 'low', warn: 25, crit: 15 }, health: true },
    { tag: 'speed', label: '주행 속도', unit: 'm/s', digits: 2, nominal: 3 },
  ],
}

/** 텔레메트리 샘플링 주기(시뮬레이션 초) */
export const TELEMETRY_INTERVAL = 1
