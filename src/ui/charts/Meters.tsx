import type { OeeBreakdown } from '../../platform/processor'
import { percent } from '../labels'
import { CHART, STATUS } from './chartTheme'

function Meter({ value, color, track = CHART.track }: { value: number; color: string; track?: string }) {
  return (
    <div className="meter-track" style={{ background: track }}>
      <div className="meter-fill" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  )
}

/** OEE와 세 구성 요소(가용성·성능·품질) */
export function OeeBlock({ oee, note }: { oee: OeeBreakdown; note?: string }) {
  const parts: [string, number][] = [
    ['가용성', oee.availability],
    ['성능', oee.performance],
    ['품질', oee.quality],
  ]
  return (
    <div className="oee-block">
      <div className="oee-head">
        <span className="oee-value">{percent(oee.oee)}</span>
        <span className="muted small">OEE = 가용성 × 성능 × 품질</span>
      </div>
      {parts.map(([label, value]) => (
        <div key={label} className="oee-row">
          <span>{label}</span>
          <Meter value={value} color={CHART.series} />
          <b>{percent(value)}</b>
        </div>
      ))}
      {note && <p className="muted small">{note}</p>}
    </div>
  )
}

/** 예지 보전: 건강도 미터(심각도에 따라 색 변화)와 위험 임계치 도달 예상 */
export function HealthBlock({ health, etaSeconds, tagLabel }: { health: number | null; etaSeconds: number | null; tagLabel: string }) {
  if (health === null) return <p className="muted small">추세 판단에 필요한 가동 데이터를 모으는 중입니다.</p>
  const color = health >= 0.5 ? CHART.series : health >= 0.25 ? STATUS.warn : STATUS.crit
  return (
    <div className="health-block">
      <div className="oee-row">
        <span>건강도</span>
        <Meter value={health} color={color} />
        <b>{percent(health, 0)}</b>
      </div>
      <p className="small">
        {etaSeconds === null ? (
          <span className="muted">{tagLabel} 악화 추세 없음 (최근 5분 기준)</span>
        ) : (
          <>
            <span style={{ color: etaSeconds < 600 ? STATUS.crit : STATUS.warn }}>▲</span> {tagLabel} 추세상 약{' '}
            <b>{Math.max(1, Math.round(etaSeconds / 60))}분</b> 후 위험 임계치 도달 예상
          </>
        )}
      </p>
    </div>
  )
}
