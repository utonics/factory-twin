import { useState } from 'react'
import { STATION_STATUS_COLOR } from '../scene/theme'
import { useFactoryStore } from '../store/useFactoryStore'
import { STATION_STATUS_LABEL, TRUCK_STATUS_LABEL } from './labels'
import { TruckIcon } from './icons'

/** 라인별 공정 흐름(투입 → 4개 공정 → 팔레트)과 출하 트럭 요약 */
export function ProcessFlow() {
  const { lines, stations, truck } = useFactoryStore((s) => s.snapshot)
  const select = useFactoryStore((s) => s.select)
  const [lineId, setLineId] = useState(lines[0]?.id)
  const line = lines.find((l) => l.id === lineId) ?? lines[0]
  const steps = stations.filter((s) => s.lineId === line.id)
  const inputColor = line.inputUnits > 0 ? STATION_STATUS_COLOR.processing : STATION_STATUS_COLOR.idle

  return (
    <section className="process-flow card">
      <div className="flow-main">
        <div className="flow-head">
          <h3>공정 흐름</h3>
          <div className="seg">
            {lines.map((l) => (
              <button type="button" key={l.id} className={l.id === line.id ? 'active' : ''} onClick={() => setLineId(l.id)}>
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <ol className="steps">
          <li onClick={() => select(line.id)}>
            <span className="step-dot" style={{ background: inputColor }} />
            <b>자재 투입</b>
            <small>대기 {line.inputUnits}개</small>
          </li>
          {steps.map((s) => (
            <li key={s.id} onClick={() => select(s.id)} title={STATION_STATUS_LABEL[s.status]}>
              <span className={`step-dot ${s.status === 'down' ? 'blink' : ''}`} style={{ background: STATION_STATUS_COLOR[s.status] }}>
                {s.status === 'processing' && (
                  <svg viewBox="0 0 36 36" className="step-ring">
                    <circle cx="18" cy="18" r="16" pathLength={100} strokeDasharray={`${s.progress * 100} 100`} />
                  </svg>
                )}
              </span>
              <b>{s.name}</b>
              <small>{STATION_STATUS_LABEL[s.status]}</small>
            </li>
          ))}
          <li onClick={() => select(line.id)}>
            <span className="step-dot" style={{ background: '#2f5bea' }} />
            <b>팔레트 적재</b>
            <small>
              {line.palletFill}/{line.palletSize} · 대기 {line.readyPallets}
            </small>
          </li>
        </ol>
      </div>
      <button type="button" className="truck-card" onClick={() => select('TRUCK')}>
        <span className="truck-icon">
          <TruckIcon />
        </span>
        <span>
          <b>{truck.status === 'away' ? '다음 트럭 대기' : truck.id}</b>
          <small>
            {TRUCK_STATUS_LABEL[truck.status]} · 상차 {truck.load}/{truck.capacity}
          </small>
          <small className="muted">적치장 {truck.staged}/{truck.stagingCapacity} 팔레트</small>
        </span>
      </button>
    </section>
  )
}
