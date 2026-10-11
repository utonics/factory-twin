import type { AlarmRecord } from '../platform/alarms'
import { AGV_STATUS_COLOR, STATION_STATUS_COLOR } from '../scene/theme'
import { useFactoryStore } from '../store/useFactoryStore'
import { STATUS } from './charts/chartTheme'
import { AGV_STATUS_LABEL, formatClock, STATION_STATUS_LABEL } from './labels'

const EVENT_COLOR = { info: '#2f5bea', warn: '#f08c1a', error: '#ef4444' } as const

function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="status-chip small" style={{ color, background: `${color}1f` }}>
      {label}
    </span>
  )
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="mini-bar">
      <div style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  )
}

function AlarmRow({ alarm }: { alarm: AlarmRecord }) {
  const select = useFactoryStore((s) => s.select)
  const acknowledge = useFactoryStore((s) => s.acknowledgeAlarm)
  const active = alarm.clearedAt === null
  const color = alarm.level === 'crit' ? STATUS.crit : STATUS.warn
  const valueText = alarm.value === null ? '' : ` ${alarm.value.toFixed(alarm.unit === 'mm/s' || alarm.unit === 'bar' ? 2 : 1)}${alarm.unit}`
  return (
    <div
      className={`row alarm ${active ? '' : 'is-cleared'}`}
      role="button"
      tabIndex={0}
      onClick={() => select(alarm.assetId)}
      onKeyDown={(e) => e.key === 'Enter' && select(alarm.assetId)}
    >
      <span className="alarm-level" style={{ color: active ? color : undefined }}>
        {alarm.level === 'crit' ? '◆ 위험' : '▲ 경고'}
      </span>
      <span className="row-id">
        <b>
          {alarm.assetName} · {alarm.label}
          {active ? valueText : ''}
        </b>
        <small>
          발생 {formatClock(alarm.raisedAt)}
          {alarm.clearedAt !== null ? ` · 해제 ${formatClock(alarm.clearedAt)}` : ''}
        </small>
      </span>
      {active && !alarm.acknowledged ? (
        <button
          type="button"
          className="ack-btn"
          onClick={(e) => {
            e.stopPropagation()
            acknowledge(alarm.id)
          }}
        >
          확인
        </button>
      ) : (
        <small className="muted">{active ? '확인됨' : '해제'}</small>
      )}
    </div>
  )
}

export function AssetList() {
  const tab = useFactoryStore((s) => s.listTab)
  const setTab = useFactoryStore((s) => s.setListTab)
  const { stations, agvs, events } = useFactoryStore((s) => s.snapshot)
  const { alarms, activeAlarmCount } = useFactoryStore((s) => s.analytics)
  const selectedId = useFactoryStore((s) => s.selectedId)
  const select = useFactoryStore((s) => s.select)
  const activeAlarms = activeAlarmCount.warn + activeAlarmCount.crit
  const running = stations.filter((s) => s.status === 'processing').length
  const busyAgvs = agvs.filter((a) => a.status !== 'charging').length

  return (
    <section className="asset-list card">
      <div className="tabs">
        <button type="button" className={tab === 'stations' ? 'active' : ''} onClick={() => setTab('stations')}>
          설비 <b>{running}/{stations.length}</b>
        </button>
        <button type="button" className={tab === 'agvs' ? 'active' : ''} onClick={() => setTab('agvs')}>
          AGV <b>{busyAgvs}/{agvs.length}</b>
        </button>
        <button type="button" className={tab === 'alarms' ? 'active' : ''} onClick={() => setTab('alarms')}>
          알람 <b className={activeAlarmCount.crit > 0 ? 'is-crit' : ''}>{activeAlarms}</b>
        </button>
        <button type="button" className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>
          이벤트
        </button>
      </div>
      <div className="rows">
        {tab === 'stations' &&
          stations.map((s) => (
            <button type="button" key={s.id} className={`row ${selectedId === s.id ? 'selected' : ''}`} onClick={() => select(s.id)}>
              <span className="row-id">
                <b>{s.name}</b>
                <small>{s.lineName}</small>
              </span>
              <StatusChip label={STATION_STATUS_LABEL[s.status]} color={STATION_STATUS_COLOR[s.status]} />
              <span className="row-meter">
                <Bar value={s.status === 'processing' ? s.progress : 0} color={STATION_STATUS_COLOR.processing} />
                <small>{s.processed.toLocaleString()}개</small>
              </span>
            </button>
          ))}
        {tab === 'agvs' &&
          agvs.map((a) => (
            <button type="button" key={a.id} className={`row ${selectedId === a.id ? 'selected' : ''}`} onClick={() => select(a.id)}>
              <span className="row-id">
                <b>{a.name}</b>
                <small>{a.task}</small>
              </span>
              <StatusChip label={AGV_STATUS_LABEL[a.status]} color={AGV_STATUS_COLOR[a.status]} />
              <span className="row-meter">
                <Bar value={a.battery / 100} color={a.battery < 30 ? '#ef4444' : '#22b573'} />
                <small>{a.battery.toFixed(0)}%</small>
              </span>
            </button>
          ))}
        {tab === 'alarms' &&
          (alarms.length === 0 ? (
            <p className="muted empty">발생한 알람이 없습니다.</p>
          ) : (
            alarms.map((a) => <AlarmRow key={a.id} alarm={a} />)
          ))}
        {tab === 'events' &&
          (events.length === 0 ? (
            <p className="muted empty">아직 기록된 이벤트가 없습니다.</p>
          ) : (
            events.map((e) => (
              <button type="button" key={e.id} className="row event" onClick={() => select(e.sourceId)}>
                <span className="event-dot" style={{ background: EVENT_COLOR[e.level] }} />
                <span className="event-msg">{e.message}</span>
                <small className="muted">{formatClock(e.time)}</small>
              </button>
            ))
          ))}
      </div>
    </section>
  )
}
