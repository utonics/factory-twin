import type { ReactNode } from 'react'
import { useFactoryStore } from '../store/useFactoryStore'
import { CheckIcon, CubeIcon, GaugeIcon, TruckIcon } from './icons'
import { percent } from './labels'

function KpiCard({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: string; sub: string; tone?: 'warn' }) {
  return (
    <div className="kpi card">
      <span className={`kpi-icon ${tone === 'warn' ? 'is-warn' : ''}`}>{icon}</span>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-sub">{sub}</div>
      </div>
    </div>
  )
}

export function KpiCards() {
  const k = useFactoryStore((s) => s.snapshot.kpis)
  const plant = useFactoryStore((s) => s.analytics.plant)
  return (
    <section className="kpis">
      <KpiCard icon={<CubeIcon />} label="생산 완료" value={k.produced.toLocaleString()} sub={`시간당 ${k.throughputPerHour.toFixed(0)}개 · 재공 ${k.wip}개`} />
      <KpiCard
        icon={<CheckIcon />}
        label="OEE (라인 평균)"
        value={percent(plant.oee)}
        sub={`가용 ${percent(plant.availability, 0)} · 성능 ${percent(plant.performance, 0)} · 품질 ${percent(plant.quality, 0)}`}
      />
      <KpiCard
        icon={<GaugeIcon />}
        label="설비 가동"
        value={`${k.runningStations}/${k.totalStations}`}
        sub={k.downStations > 0 ? `고장 ${k.downStations}대 수리 중` : '고장 설비 없음'}
        tone={k.downStations > 0 ? 'warn' : undefined}
      />
      <KpiCard icon={<TruckIcon />} label="출하 팔레트" value={k.shippedPallets.toLocaleString()} sub={`AGV 운반 중 ${k.activeAgvs}/${k.totalAgvs}대`} />
    </section>
  )
}
