import { useState, type PointerEvent } from 'react'
import type { SensorSpec } from '../../data/sensorCatalog'
import { evaluateLevel } from '../../platform/alarms'
import { formatClock } from '../labels'
import { CHART, STATUS } from './chartTheme'

const WIDTH = 300
const HEIGHT = 64
const PAD_Y = 6
const WINDOW = 600

interface SensorChartProps {
  spec: SensorSpec
  points: [number, number][]
  now: number
}

/** 센서 1개의 최근 10분 추이(단일 계열 라인 + 임계치 기준선 + 호버 툴팁) */
export function SensorChart({ spec, points, now }: SensorChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const latest = points[points.length - 1]
  const level = latest && spec.limits ? evaluateLevel(latest[1], spec.limits, 0) : 0

  const values = points.map((p) => p[1])
  const thresholds = spec.limits ? [spec.limits.warn, spec.limits.crit] : []
  let min = Math.min(...values, ...thresholds)
  let max = Math.max(...values, ...thresholds)
  if (!Number.isFinite(min) || max - min < 1e-6) {
    min = (min || 0) - 1
    max = (max || 0) + 1
  }
  const span = max - min
  const x = (t: number) => ((t - (now - WINDOW)) / WINDOW) * WIDTH
  const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (HEIGHT - PAD_Y * 2)

  const line = points.map(([t, v], i) => `${i === 0 ? 'M' : 'L'}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const area = points.length > 1 ? `${line}L${x(points[points.length - 1][0]).toFixed(1)},${HEIGHT}L${x(points[0][0]).toFixed(1)},${HEIGHT}Z` : ''

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (points.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const t = now - WINDOW + ((e.clientX - rect.left) / rect.width) * WINDOW
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i][0] - t) < Math.abs(points[best][0] - t)) best = i
    setHover(best)
  }

  const hovered = hover !== null ? points[hover] : null
  const fmt = (v: number) => `${v.toFixed(spec.digits)} ${spec.unit}`

  return (
    <div className="sensor-chart">
      <div className="sensor-head">
        <span>{spec.label}</span>
        <span className="sensor-value">
          {level > 0 && (
            <span className="level-tag" style={{ color: level === 2 ? STATUS.crit : STATUS.warn }}>
              {level === 2 ? '▲ 위험' : '▲ 경고'}
            </span>
          )}
          <b>{latest ? latest[1].toFixed(spec.digits) : '-'}</b> {spec.unit}
        </span>
      </div>
      <div className="chart-box">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`${spec.label} 최근 10분 추이`}>
          <line x1={0} x2={WIDTH} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke={CHART.grid} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {spec.limits && (
            <>
              <line x1={0} x2={WIDTH} y1={y(spec.limits.warn)} y2={y(spec.limits.warn)} stroke={STATUS.warn} strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <line x1={0} x2={WIDTH} y1={y(spec.limits.crit)} y2={y(spec.limits.crit)} stroke={STATUS.crit} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </>
          )}
          {area && <path d={area} fill={CHART.series} opacity={0.1} />}
          <path d={line} fill="none" stroke={CHART.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hovered && <line x1={x(hovered[0])} x2={x(hovered[0])} y1={0} y2={HEIGHT} stroke={CHART.crosshair} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* 점 표식은 비율 왜곡을 피하려고 HTML로 겹쳐 그린다 */}
        {latest && !hovered && <span className="chart-dot" style={{ left: `${(x(latest[0]) / WIDTH) * 100}%`, top: y(latest[1]) }} />}
        {hovered && (
          <>
            <span className="chart-dot" style={{ left: `${(x(hovered[0]) / WIDTH) * 100}%`, top: y(hovered[1]) }} />
            <div className="chart-tooltip" style={{ left: `${Math.min(70, Math.max(30, (x(hovered[0]) / WIDTH) * 100))}%` }}>
              {formatClock(hovered[0])} · <b>{fmt(hovered[1])}</b>
            </div>
          </>
        )}
      </div>
      <div className="chart-axis">
        <span>10분 전</span>
        {spec.limits && (
          <span>
            경고 {spec.limits.warn} · 위험 {spec.limits.crit}
          </span>
        )}
        <span>현재</span>
      </div>
    </div>
  )
}
