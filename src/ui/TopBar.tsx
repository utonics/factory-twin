import { simulation } from '../runtime'
import { AREAS, type AreaId } from '../scene/areas'
import { useFactoryStore } from '../store/useFactoryStore'
import { BellIcon, CubeIcon, PauseIcon, PlayIcon } from './icons'
import { formatClock } from './labels'

const SPEEDS = [1, 2, 5, 10]

export function TopBar() {
  const time = useFactoryStore((s) => s.snapshot.time)
  const kpis = useFactoryStore((s) => s.snapshot.kpis)
  const speed = useFactoryStore((s) => s.speed)
  const paused = useFactoryStore((s) => s.paused)
  const setSpeed = useFactoryStore((s) => s.setSpeed)
  const togglePause = useFactoryStore((s) => s.togglePause)
  const { activeAlarmCount, messagesPerMinute } = useFactoryStore((s) => s.analytics)
  const setListTab = useFactoryStore((s) => s.setListTab)
  const area = useFactoryStore((s) => s.area)
  const setArea = useFactoryStore((s) => s.setArea)
  const activeAlarms = activeAlarmCount.warn + activeAlarmCount.crit

  return (
    <header className="topbar card">
      <div className="brand">
        <span className="brand-mark">
          <CubeIcon />
        </span>
        <span className="brand-name">FactoryTwin</span>
      </div>
      <div className="site-chip">
        <span className="site-code">F-01</span>
        <div>
          <strong>{simulation.layout.name}</strong>
          <small>
            {simulation.layout.lines.length}개 라인 · 설비 {kpis.totalStations}대 · AGV {kpis.totalAgvs}대
          </small>
        </div>
        <label className="area-select">
          <span>구역</span>
          <select value={area ?? ''} onChange={(e) => setArea(e.target.value as AreaId)} aria-label="구역 선택(카메라 이동)">
            <option value="" disabled hidden>
              직접 이동한 시점
            </option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="topbar-spacer" />
      <div className="data-pill" title="가상 센서·설비 이벤트 메시지 수신량(시뮬레이션 시간 기준)">
        가상 센서 수집 <b>{Math.round(messagesPerMinute).toLocaleString()}</b>건/분
      </div>
      <button
        type="button"
        className="bell"
        onClick={() => setListTab('alarms')}
        aria-label={`활성 알람 ${activeAlarms}건, 미확인 ${activeAlarmCount.unacknowledged}건`}
      >
        <BellIcon />
        {activeAlarms > 0 && <span className={`bell-badge ${activeAlarmCount.crit > 0 ? 'is-crit' : ''}`}>{activeAlarms}</span>}
      </button>
      <div className={`live-pill ${paused ? 'is-paused' : ''}`} title="현재는 시뮬레이션 데이터로 동작합니다">
        <span className="live-dot" />
        시뮬레이션 <b>{formatClock(time)}</b>
      </div>
      <div className="speed-control" role="group" aria-label="재생 속도">
        <button type="button" className={paused ? 'active' : ''} onClick={togglePause} aria-label={paused ? '재생' : '일시정지'}>
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        {SPEEDS.map((s) => (
          <button key={s} type="button" className={!paused && speed === s ? 'active' : ''} onClick={() => setSpeed(s)}>
            {s}x
          </button>
        ))}
      </div>
    </header>
  )
}
