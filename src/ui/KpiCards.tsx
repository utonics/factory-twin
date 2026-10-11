import type { ReactNode } from 'react'
import { useFactoryStore } from '../store/useFactoryStore'
import { AlertIcon, CheckIcon, ClockIcon, CubeIcon, TruckIcon } from './icons'
import { percent } from './labels'

interface KpiCardProps {
  icon: ReactNode
  label: string
  value: string
  sub: string
  tone?: 'warn'
  /** 누르면 관련 목록으로 이동 */
  onClick?: () => void
}

function KpiCard({ icon, label, value, sub, tone, onClick }: KpiCardProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className={`kpi card ${onClick ? 'is-clickable' : ''}`} onClick={onClick}>
      <span className={`kpi-icon ${tone === 'warn' ? 'is-warn' : ''}`}>{icon}</span>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-sub">{sub}</div>
      </div>
    </Tag>
  )
}

export function KpiCards() {
  const k = useFactoryStore((s) => s.snapshot.kpis)
  const warehouse = useFactoryStore((s) => s.snapshot.warehouse)
  const { plant, orders, logistics } = useFactoryStore((s) => s.analytics)
  const setListTab = useFactoryStore((s) => s.setListTab)
  const setDelayedOnly = useFactoryStore((s) => s.setDelayedOnly)
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
        icon={<ClockIcon />}
        label="납기 준수율"
        value={orders.onTimeRate === null ? '-' : percent(orders.onTimeRate)}
        sub={`완료 ${orders.completed}건 · 지연 진행 ${orders.overdueOpen}건`}
        tone={orders.overdueOpen > 0 ? 'warn' : undefined}
        onClick={() => {
          setListTab('orders')
          setDelayedOnly(orders.overdueOpen > 0)
        }}
      />
      <KpiCard
        icon={<TruckIcon />}
        label="도크 사용"
        value={`${logistics.docksInUse}/${logistics.dockCount}`}
        sub={`운행 트럭 ${logistics.activeTrucks}대 · 출하 ${k.shippedPallets}팔레트`}
      />
      <KpiCard
        icon={<AlertIcon />}
        label="재고 부족 알림"
        value={`${logistics.stockAlerts}건`}
        sub={`창고 재고 ${warehouse.stock}/${warehouse.capacity}팔레트`}
        tone={logistics.stockAlerts > 0 ? 'warn' : undefined}
        onClick={() => setListTab('alarms')}
      />
    </section>
  )
}
