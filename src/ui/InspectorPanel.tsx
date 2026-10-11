import { simulation } from '../runtime'
import { useFactoryStore } from '../store/useFactoryStore'
import { LineAnalyticsSection, SensorSeriesSection, StationAnalyticsSection } from './AnalyticsSections'
import { CloseIcon, HomeIcon, MinusIcon, PlusIcon } from './icons'
import { formatClock } from './labels'
import { selectionInfo } from './selectionInfo'

export function CameraToolbar() {
  const send = useFactoryStore((s) => s.sendCameraCommand)
  const setArea = useFactoryStore((s) => s.setArea)
  return (
    <div className="camera-toolbar card">
      <button type="button" onClick={() => send({ type: 'zoomIn' })} aria-label="확대">
        <PlusIcon />
      </button>
      <button type="button" onClick={() => send({ type: 'zoomOut' })} aria-label="축소">
        <MinusIcon />
      </button>
      <button type="button" onClick={() => setArea('all')} aria-label="전체 공장 시점">
        <HomeIcon />
      </button>
    </div>
  )
}

const { layout } = simulation
const STATION_IDS = new Set(layout.lines.flatMap((l) => l.stations.map((s) => s.id)))
const AGV_IDS = new Set(layout.agv.fleet.map((a) => a.id))
const LINE_IDS = new Set(layout.lines.map((l) => l.id))

function AnalyticsFor({ id }: { id: string }) {
  if (STATION_IDS.has(id)) return <StationAnalyticsSection stationId={id} />
  if (AGV_IDS.has(id)) return <SensorSeriesSection assetId={id} />
  if (id === 'WH') return <SensorSeriesSection assetId={id} title="재고 추이" />
  if (LINE_IDS.has(id)) return <LineAnalyticsSection lineId={id} />
  return null
}

export function InspectorPanel() {
  const selectedId = useFactoryStore((s) => s.selectedId)
  const snapshot = useFactoryStore((s) => s.snapshot)
  const select = useFactoryStore((s) => s.select)
  const info = selectedId ? selectionInfo(snapshot, selectedId) : null

  if (!selectedId || !info) {
    return (
      <div className="inspector card is-empty">
        <div className="eyebrow">상세 정보</div>
        <p>설비, AGV, 자재창고, 출하 도크, 라인 투입·배출 구역을 클릭하면 실시간 상태와 데이터가 표시됩니다.</p>
        <p className="muted">좌클릭 드래그 이동 · 우클릭 드래그 회전 · 휠 확대/축소</p>
      </div>
    )
  }

  return (
    <div className="inspector card">
      <div className="inspector-head">
        <div>
          <div className="eyebrow">{info.kindLabel}</div>
          <h2>{info.title}</h2>
          <div className="muted">{info.subtitle}</div>
        </div>
        <button type="button" className="icon-btn" onClick={() => select(null)} aria-label="닫기">
          <CloseIcon />
        </button>
      </div>
      <div className="status-row">
        <span className="status-chip" style={{ color: info.statusColor, background: `${info.statusColor}1f` }}>
          {info.statusLabel}
        </span>
        <span className="muted">갱신 {formatClock(snapshot.time)}</span>
      </div>
      {info.meter && (
        <div className="meter">
          <div className="meter-label">{info.meter.label}</div>
          <div className="meter-track">
            <div className="meter-fill" style={{ width: `${Math.round(info.meter.value * 100)}%`, background: info.meter.color }} />
          </div>
        </div>
      )}
      <dl className="kv">
        {info.rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <AnalyticsFor id={selectedId} />
    </div>
  )
}
