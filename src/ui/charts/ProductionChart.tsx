import { useState } from 'react'
import { BUCKET_COUNT, BUCKET_SECONDS } from '../../platform/processor'
import { formatClock } from '../labels'
import { CHART } from './chartTheme'

const WIDTH = 300
const HEIGHT = 84
const BAR_MAX = 18
const RADIUS = 4

interface ProductionChartProps {
  buckets: { start: number; good: number; ng: number }[]
  now: number
}

function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, h, w / 2)
  // 위쪽만 둥글게, 바닥은 직각
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

/** 5분 단위 양품 생산량(단일 계열 컬럼, 최근 1시간 12칸). 진행 중인 구간은 옅게 표시 */
export function ProductionChart({ buckets, now }: ProductionChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  if (buckets.length === 0) return <p className="muted small">집계 데이터가 아직 없습니다.</p>
  const max = Math.max(1, ...buckets.map((b) => b.good))
  // 데이터가 적어도 칸 너비를 고정해 막대가 벌어지지 않게 한다
  const slot = WIDTH / BUCKET_COUNT
  const barW = Math.min(BAR_MAX, slot - 4)
  const last = buckets.length - 1
  const hovered = hover !== null ? buckets[hover] : null

  return (
    <div className="production-chart">
      <div className="chart-box">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="5분 단위 양품 생산량">
          <line x1={0} x2={WIDTH} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke={CHART.grid} strokeWidth={1} />
          {buckets.map((b, i) => {
            const h = (b.good / max) * (HEIGHT - 6)
            const x = i * slot + (slot - barW) / 2
            return (
              <g key={b.start} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                <rect x={i * slot} y={0} width={slot} height={HEIGHT} fill="transparent" />
                {h > 0 && <path d={columnPath(x, HEIGHT - h, barW, h)} fill={i === last ? CHART.seriesMuted : CHART.series} opacity={hover === null || hover === i ? 1 : 0.55} />}
              </g>
            )
          })}
        </svg>
        {hovered && hover !== null && (
          <div className="chart-tooltip" style={{ left: `${Math.min(72, Math.max(28, ((hover + 0.5) / BUCKET_COUNT) * 100))}%` }}>
            {formatClock(hovered.start).slice(0, 5)}~{formatClock(Math.min(now, hovered.start + BUCKET_SECONDS)).slice(0, 5)}
            {hover === last ? ' (진행 중)' : ''} · 양품 <b>{hovered.good}</b> · 불량 <b>{hovered.ng}</b>
          </div>
        )}
      </div>
      <div className="chart-axis">
        <span>{formatClock(buckets[0].start).slice(0, 5)}</span>
        <span>최대 {max}개/5분</span>
        <span>{formatClock(buckets[0].start + BUCKET_COUNT * BUCKET_SECONDS).slice(0, 5)}</span>
      </div>
    </div>
  )
}
