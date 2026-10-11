import type { AlarmRecord } from '../platform/alarms'
import type { OrderView } from '../platform/processor'
import { AGV_FILTERS, matchesAgvFilter, matchesStationFilter, STATION_FILTERS } from '../store/filters'
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

function FilterChips<T extends string>({ options, value, onChange, counts }: { options: [T, string][]; value: T; onChange: (v: T) => void; counts: Record<string, number> }) {
  return (
    <div className="filter-row" role="group" aria-label="상태 필터">
      {options.map(([id, label]) => (
        <button key={id} type="button" className={value === id ? 'active' : ''} onClick={() => onChange(id)} aria-pressed={value === id}>
          {label} <span>{counts[id] ?? 0}</span>
        </button>
      ))}
    </div>
  )
}

function OrderRow({ order, now }: { order: OrderView; now: number }) {
  const done = order.completedAt !== null
  const status = done ? (order.late ? '지연 출하' : '출하 완료') : order.late ? '납기 지연' : order.shipped > 0 ? '부분 출하' : '출하 대기'
  const color = order.late ? STATUS.crit : done ? STATUS.good : '#2f5bea'
  const slack = order.dueAt - now
  return (
    <div className={`row order ${done ? 'is-cleared' : ''}`}>
      <span className="row-id">
        <b>
          {order.id} · {order.customer}
        </b>
        <small>
          납기 {formatClock(order.dueAt).slice(0, 5)}
          {done ? ` · 완료 ${formatClock(order.completedAt!).slice(0, 5)}` : slack >= 0 ? ` · ${Math.ceil(slack / 60)}분 남음` : ` · ${Math.ceil(-slack / 60)}분 초과`}
        </small>
      </span>
      <StatusChip label={status} color={color} />
      <span className="row-meter">
        <Bar value={order.shipped / order.pallets} color="#2f5bea" />
        <small>
          {order.shipped}/{order.pallets}
        </small>
      </span>
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
  const { alarms, activeAlarmCount, orders, time } = useFactoryStore((s) => s.analytics)
  const selectedId = useFactoryStore((s) => s.selectedId)
  const select = useFactoryStore((s) => s.select)
  const stationFilter = useFactoryStore((s) => s.stationFilter)
  const setStationFilter = useFactoryStore((s) => s.setStationFilter)
  const agvFilter = useFactoryStore((s) => s.agvFilter)
  const setAgvFilter = useFactoryStore((s) => s.setAgvFilter)
  const delayedOnly = useFactoryStore((s) => s.delayedOnly)
  const setDelayedOnly = useFactoryStore((s) => s.setDelayedOnly)
  const activeAlarms = activeAlarmCount.warn + activeAlarmCount.crit
  const running = stations.filter((s) => s.status === 'processing').length
  const busyAgvs = agvs.filter((a) => a.status !== 'charging').length

  const stationCounts = Object.fromEntries(STATION_FILTERS.map(([id]) => [id, stations.filter((s) => matchesStationFilter(s.status, id)).length]))
  const agvCounts = Object.fromEntries(AGV_FILTERS.map(([id]) => [id, agvs.filter((a) => matchesAgvFilter(a.status, id)).length]))
  const visibleStations = stations.filter((s) => matchesStationFilter(s.status, stationFilter))
  const visibleAgvs = agvs.filter((a) => matchesAgvFilter(a.status, agvFilter))
  const lateOrders = orders.list.filter((o) => o.late)
  const visibleOrders = delayedOnly ? lateOrders : orders.list

  return (
    <section className="asset-list card">
      <div className="tabs">
        <button type="button" className={tab === 'stations' ? 'active' : ''} onClick={() => setTab('stations')}>
          설비 <b>{running}/{stations.length}</b>
        </button>
        <button type="button" className={tab === 'agvs' ? 'active' : ''} onClick={() => setTab('agvs')}>
          AGV <b>{busyAgvs}/{agvs.length}</b>
        </button>
        <button type="button" className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          오더 <b className={orders.overdueOpen > 0 ? 'is-crit' : ''}>{orders.open}</b>
        </button>
        <button type="button" className={tab === 'alarms' ? 'active' : ''} onClick={() => setTab('alarms')}>
          알람 <b className={activeAlarmCount.crit > 0 ? 'is-crit' : ''}>{activeAlarms}</b>
        </button>
        <button type="button" className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>
          이벤트
        </button>
      </div>
      {tab === 'stations' && <FilterChips options={STATION_FILTERS} value={stationFilter} onChange={setStationFilter} counts={stationCounts} />}
      {tab === 'agvs' && <FilterChips options={AGV_FILTERS} value={agvFilter} onChange={setAgvFilter} counts={agvCounts} />}
      {tab === 'orders' && (
        <FilterChips
          options={[
            ['all', '전체'],
            ['late', '지연만'],
          ]}
          value={delayedOnly ? 'late' : 'all'}
          onChange={(v) => setDelayedOnly(v === 'late')}
          counts={{ all: orders.list.length, late: lateOrders.length }}
        />
      )}
      <div className="rows">
        {tab === 'stations' && visibleStations.length === 0 && <p className="muted empty">해당 상태의 설비가 없습니다.</p>}
        {tab === 'stations' &&
          visibleStations.map((s) => (
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
        {tab === 'agvs' && visibleAgvs.length === 0 && <p className="muted empty">해당 상태의 AGV가 없습니다.</p>}
        {tab === 'agvs' &&
          visibleAgvs.map((a) => (
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
        {tab === 'orders' &&
          (visibleOrders.length === 0 ? (
            <p className="muted empty">{delayedOnly ? '납기 지연 오더가 없습니다.' : '오더가 없습니다.'}</p>
          ) : (
            visibleOrders.map((o) => <OrderRow key={o.id} order={o} now={time} />)
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
