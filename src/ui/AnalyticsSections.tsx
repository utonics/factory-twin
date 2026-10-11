import { SENSOR_CATALOG } from '../data/sensorCatalog'
import { useFactoryStore } from '../store/useFactoryStore'
import { ProductionChart } from './charts/ProductionChart'
import { HealthBlock, OeeBlock } from './charts/Meters'
import { SensorChart } from './charts/SensorChart'
import { CHART } from './charts/chartTheme'
import { formatDuration } from './labels'

/** 자산의 센서·계측 시계열(최근 10분). AGV·창고 패널에서도 쓴다. */
export function SensorSeriesSection({ assetId, title = '센서 추이' }: { assetId: string; title?: string }) {
  const { selectedSeries, time } = useFactoryStore((s) => s.analytics)
  if (!selectedSeries || selectedSeries.assetId !== assetId) return null
  return (
    <section className="panel-section">
      <h4>{title} · 최근 10분</h4>
      {selectedSeries.series.map((s) => (
        <SensorChart key={s.spec.tag} spec={s.spec} points={s.points} now={time} />
      ))}
    </section>
  )
}

export function StationAnalyticsSection({ stationId }: { stationId: string }) {
  const analytics = useFactoryStore((s) => s.analytics.stations[stationId])
  const kind = useFactoryStore((s) => s.snapshot.stations.find((st) => st.id === stationId)?.kind)
  if (!analytics || !kind) return null
  const healthTag = SENSOR_CATALOG[kind].find((s) => s.health)
  return (
    <>
      <section className="panel-section">
        <h4>설비 OEE · 근무 시작 이후</h4>
        <OeeBlock oee={analytics.oee} note="자재 대기·후공정 정체 시간은 성능 손실로 집계됩니다." />
      </section>
      <section className="panel-section">
        <h4>예지 보전 · {healthTag?.label} 기준</h4>
        <HealthBlock health={analytics.health} etaSeconds={analytics.etaSeconds} tagLabel={healthTag?.label ?? ''} />
      </section>
      <SensorSeriesSection assetId={stationId} />
    </>
  )
}

export function LineAnalyticsSection({ lineId }: { lineId: string }) {
  const line = useFactoryStore((s) => s.analytics.lines[lineId])
  const now = useFactoryStore((s) => s.analytics.time)
  if (!line) return null
  const maxDefect = Math.max(1, ...line.defects.map((d) => d.count))
  return (
    <>
      <section className="panel-section">
        <h4>라인 OEE · 병목 설비 기준</h4>
        <OeeBlock oee={line} />
        {line.leadTimeAvg !== null && <p className="muted small">평균 리드타임(투입→팔레트) {formatDuration(line.leadTimeAvg)} · 최근 50개</p>}
      </section>
      <section className="panel-section">
        <h4>양품 생산량 · 5분 단위</h4>
        <ProductionChart buckets={line.buckets} now={now} />
      </section>
      <section className="panel-section">
        <h4>불량 유형 · 누적 {line.ng}건</h4>
        <ul className="pareto">
          {line.defects.map((d) => (
            <li key={d.type}>
              <span>{d.type}</span>
              <span className="pareto-bar">
                <span style={{ width: `${(d.count / maxDefect) * 100}%`, background: CHART.series }} />
              </span>
              <b>{d.count}</b>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
