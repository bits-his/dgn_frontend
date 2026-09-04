import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Bell, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/lib/auth'

type AlertTop = {
  id: number
  ruleCode: string
  category: string
  severity: string
  title: string
  message: string
  linkPath: string | null
}

type PriceRow = {
  productId: number
  productName: string
  avgSellingPrice: number | null
  loadedUnitCost: number | null
  marginPerUnit: number | null
  marginPercent: number | null
  unitsSold: number
  stockOnHand: number
  overheadIncluded: boolean
}

type Dashboard = {
  periodKey: string
  periodLabel: string
  today: {
    scrapInKg: number
    driedKg: number
    unitsProduced: number
    unitsReject: number
    rejectPercent: number
    salesValue: number
  }
  production: {
    scrapInKg: number
    driedKg: number
    unitsProduced: number
    rejectPercent: number
    avgOeePercent: number | null
    processYieldPercent: number
    byStage: { stage: string; yieldPercent: number; inputKg: number; usableKg: number }[]
  }
  sales: { saleCount: number }
  spend: {
    approvedExpenses: number
    pendingExpenses: number
    pendingExpenseCount: number
    wageBill: number
    wagesPaid: number
    wagesOutstanding: number
    byCategory: { label: string; amount: number }[]
  }
  money: {
    cashIn: number
    cashOut: number
    netCash: number
    receivables: number
  }
  costTruth: {
    overheadAllocated: boolean
    allocationNumber: string | null
    overheadPerKg: number | null
    marginRestatement: {
      revenue: number
      recordedCost: number
      loadedCost: number
      restatedMargin: number
      recordedMarginPercent: number
      restatedMarginPercent: number
      marginOverstatement: number
      affectedLineCount: number
    }
  }
  priceVsCost: PriceRow[]
  receivables: {
    rows: { saleNumber: string; customerName: string | null; balanceDue: number; ageDays: number }[]
  }
  inventory: { rawKg: number; wipKg: number; fgUnits: number }
  trend: {
    periodKey: string
    label: string
    shortLabel: string
    revenue: number
    driedKg: number
    closed: boolean
  }[]
  alerts: {
    total: number
    unacknowledged: number
    bySeverity: Record<string, number>
    top: AlertTop[]
  }
}

function money(n: number | null | undefined) {
  if (n == null) return '—'
  return `₦${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function money2(n: number | null | undefined) {
  if (n == null) return '—'
  return `₦${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

const SEV: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  WARNING: 'bg-amber-500 text-[#1a1205]',
  INFO: 'bg-slate-600 text-white',
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const canExec = hasPermission(user, 'dashboard.executive')
  const [periodKey, setPeriodKey] = useState('')

  const periods = useQuery({
    queryKey: ['dashboard-periods'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/periods')
      return data.data as { periodKey: string; label: string }[]
    },
    enabled: canExec,
  })

  const dash = useQuery({
    queryKey: ['executive-dashboard', periodKey],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/executive', {
        params: periodKey ? { periodKey } : {},
      })
      return data.data as Dashboard
    },
    enabled: canExec,
    refetchInterval: 60_000,
  })

  if (!canExec) {
    return (
      <div>
        <PageHeader
          eyebrow="Factory"
          title="Management dashboard"
          description="This screen is for the people who have to decide. Your account can still work the floor from Overview."
        />
      </div>
    )
  }

  const d = dash.data
  const restated = d?.costTruth.marginRestatement
  const losingMoney = restated != null && restated.restatedMargin < 0

  return (
    <div>
      <PageHeader
        eyebrow="This morning"
        title="Factory pulse"
        description={
          d
            ? `${d.periodLabel}. Every number here is from the same moment. Tap any of them to see the batches behind it.`
            : 'Pulling the factory together…'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <Field label="">
                <select
                  className="dgn-input"
                  value={periodKey}
                  onChange={(e) => setPeriodKey(e.target.value)}
                >
                  <option value="">This month</option>
                  {(periods.data ?? []).map((p) => (
                    <option key={p.periodKey} value={p.periodKey}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button className="dgn-btn dgn-btn-ghost" onClick={() => dash.refetch()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        }
      />

      {d && (
        <>
          {d.alerts.total > 0 && (
            <Card
              className={
                'mb-6 ' +
                (d.alerts.bySeverity.CRITICAL > 0
                  ? 'border-red-200 bg-red-50/50'
                  : 'border-amber-200 bg-amber-50/50')
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {d.alerts.bySeverity.CRITICAL > 0
                      ? `${d.alerts.bySeverity.CRITICAL} thing${d.alerts.bySeverity.CRITICAL === 1 ? '' : 's'} that cannot wait`
                      : `${d.alerts.total} thing${d.alerts.total === 1 ? '' : 's'} that need a look`}
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    {d.alerts.unacknowledged} not yet acknowledged
                  </p>
                </div>
                <Link to="/alerts" className="dgn-btn dgn-btn-secondary">
                  <Bell className="h-4 w-4" /> All alerts
                </Link>
              </div>
              <div className="mt-4 space-y-2">
                {d.alerts.top.slice(0, 4).map((alert) => (
                  <Link
                    key={alert.id}
                    to={alert.linkPath || '/alerts'}
                    className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-white p-3 hover:border-[var(--accent)]"
                  >
                    <span
                      className={`mt-0.5 shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold ${SEV[alert.severity]}`}
                    >
                      {alert.severity}
                    </span>
                    <span className="min-w-0 text-sm">
                      <span className="font-medium">{alert.title}</span>
                      <span className="mt-0.5 block text-[var(--ink-muted)]">{alert.message}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
            Today
          </h2>
          <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatPill label="Scrap received" value={`${fmt(d.today.scrapInKg)} kg`} />
            <StatPill label="Dried material" value={`${fmt(d.today.driedKg)} kg`} tone="accent" />
            <StatPill
              label="Units moulded"
              value={fmt(d.today.unitsProduced)}
              hint={
                d.today.unitsReject > 0
                  ? `${fmt(d.today.unitsReject)} waste (${d.today.rejectPercent}%)`
                  : 'no waste recorded'
              }
            />
            <StatPill label="Sales taken" value={money(d.today.salesValue)} tone="success" />
          </div>

          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
            {d.periodLabel}
          </h2>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatPill
              label="Cash in"
              value={money(d.money.cashIn)}
              tone="success"
              hint={`${d.sales.saleCount} sale${d.sales.saleCount === 1 ? '' : 's'}`}
            />
            <StatPill
              label="Cash out"
              value={money(d.money.cashOut)}
              hint={`expenses ${money(d.spend.approvedExpenses)} · wages paid ${money(d.spend.wagesPaid)}`}
            />
            <StatPill
              label="Net cash this month"
              value={money(d.money.netCash)}
              tone={d.money.netCash >= 0 ? 'success' : 'danger'}
            />
            <StatPill
              label="Still owed to us"
              value={money(d.money.receivables)}
              tone={d.money.receivables > 0 ? 'danger' : 'default'}
            />
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <Card
              className={
                losingMoney
                  ? 'border-red-200 bg-red-50/40'
                  : d.costTruth.overheadAllocated
                    ? 'border-teal-200 bg-teal-50/30'
                    : 'border-amber-200 bg-amber-50/40'
              }
            >
              <h2 className="text-base font-semibold">
                {losingMoney ? 'Selling at a loss' : 'Are we making money?'}
              </h2>
              {restated && (
                <>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">
                    {money2(restated.restatedMargin)}
                    <span className="ml-2 text-base font-medium text-[var(--ink-muted)]">
                      {restated.restatedMarginPercent}%
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-[var(--ink-muted)]">
                    True margin on {money(restated.revenue)} of sales, using today's fully loaded
                    cost. The books originally showed {restated.recordedMarginPercent}% because{' '}
                    {restated.affectedLineCount} sale
                    {restated.affectedLineCount === 1 ? '' : 's'} froze their cost before overhead
                    was allocated
                    {restated.marginOverstatement > 0
                      ? ` — those figures were ${money(restated.marginOverstatement)} too optimistic`
                      : ''}
                    .
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-[var(--ink-faint)]">Recorded cost</p>
                      <p className="font-semibold">{money2(restated.recordedCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-faint)]">True cost now</p>
                      <p className="font-semibold">{money2(restated.loadedCost)}</p>
                    </div>
                  </div>
                </>
              )}
              {!d.costTruth.overheadAllocated && (
                <p className="mt-4 rounded-xl bg-amber-100/70 p-3 text-sm text-amber-900">
                  {d.periodLabel} has not been closed yet, so overhead is missing from these
                  figures.{' '}
                  <Link to="/costs/overhead" className="font-semibold underline">
                    Close the month
                  </Link>{' '}
                  before trusting the profit.
                </p>
              )}
              {d.costTruth.overheadAllocated && (
                <p className="mt-4 text-xs text-[var(--ink-faint)]">
                  Overhead {money2(d.costTruth.overheadPerKg)}/kg allocated as{' '}
                  {d.costTruth.allocationNumber}.
                </p>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Price versus true cost</h2>
                <Link
                  to="/sales/margins"
                  className="text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                >
                  Margins
                </Link>
              </div>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                What we sell each product for, against what it now costs to make one.
              </p>
              <div className="mt-4 space-y-3">
                {d.priceVsCost.length === 0 && (
                  <p className="text-sm text-[var(--ink-muted)]">No sold products yet.</p>
                )}
                {d.priceVsCost.map((row) => {
                  const loss = (row.marginPerUnit ?? 0) < 0
                  return (
                    <div key={row.productId} className="rounded-xl border border-[var(--line)] p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-medium">{row.productName}</p>
                        <p className={`font-semibold ${loss ? 'text-red-700' : 'text-teal-700'}`}>
                          {row.marginPerUnit == null
                            ? '—'
                            : `${loss ? '' : '+'}${money2(row.marginPerUnit)} / unit`}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ink-muted)]">
                        Sell {money2(row.avgSellingPrice)} · cost {money2(row.loadedUnitCost)}
                        {row.marginPercent != null ? ` · ${row.marginPercent}%` : ''}
                        {row.overheadIncluded ? '' : ' · overhead not in this cost'}
                        {` · ${fmt(row.stockOnHand)} left`}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Production</h2>
                <Link
                  to="/production"
                  className="text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                >
                  Floor
                </Link>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <Fact label="Scrap in" value={`${fmt(d.production.scrapInKg)} kg`} />
                <Fact label="Dried out" value={`${fmt(d.production.driedKg)} kg`} />
                <Fact
                  label="Process yield"
                  value={`${d.production.processYieldPercent}%`}
                  tone={d.production.processYieldPercent < 80 ? 'bad' : 'good'}
                />
                <Fact label="Units moulded" value={fmt(d.production.unitsProduced)} />
                <Fact
                  label="Waste rate"
                  value={`${d.production.rejectPercent}%`}
                  tone={d.production.rejectPercent > 5 ? 'bad' : undefined}
                />
                <Fact
                  label="Average OEE"
                  value={
                    d.production.avgOeePercent != null ? `${d.production.avgOeePercent}%` : '—'
                  }
                />
              </div>
              {d.production.byStage.length > 0 && (
                <div className="mt-4 border-t border-[var(--line)] pt-3">
                  {d.production.byStage.map((s) => (
                    <div key={s.stage} className="flex justify-between text-xs">
                      <span className="text-[var(--ink-muted)]">{s.stage.toLowerCase()}</span>
                      <span>
                        {s.yieldPercent}% · {fmt(s.usableKg)}/{fmt(s.inputKg)} kg
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Where the money went</h2>
                <Link
                  to="/expenses"
                  className="text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                >
                  Expenses
                </Link>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <Fact label="Approved expenses" value={money(d.spend.approvedExpenses)} />
                <Fact
                  label="Waiting for approval"
                  value={money(d.spend.pendingExpenses)}
                  tone={d.spend.pendingExpenseCount > 0 ? 'bad' : undefined}
                />
                <Fact label="Wage bill" value={money(d.spend.wageBill)} />
                <Fact
                  label="Wages still unpaid"
                  value={money(d.spend.wagesOutstanding)}
                  tone={d.spend.wagesOutstanding > 0 ? 'bad' : undefined}
                />
              </div>
              {d.spend.byCategory.slice(0, 4).map((row) => (
                <div key={row.label} className="mt-2 flex justify-between text-xs">
                  <span className="text-[var(--ink-muted)]">{row.label}</span>
                  <span>{money(row.amount)}</span>
                </div>
              ))}
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Stock on the floor</h2>
                <Link
                  to="/inventory"
                  className="text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                >
                  Store
                </Link>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <Fact label="Raw material" value={`${fmt(d.inventory.rawKg)} kg`} />
                <Fact label="Work in progress" value={`${fmt(d.inventory.wipKg)} kg`} />
                <Fact label="Finished goods" value={`${fmt(d.inventory.fgUnits)} pcs`} />
              </div>
              {d.receivables.rows.length > 0 && (
                <div className="mt-4 border-t border-[var(--line)] pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                    Oldest debts
                  </p>
                  {d.receivables.rows.slice(0, 3).map((row) => (
                    <Link
                      key={row.saleNumber}
                      to={`/sales/${row.saleNumber}`}
                      className="flex items-baseline justify-between py-1 text-xs hover:underline"
                    >
                      <span>
                        {row.customerName} · {row.ageDays}d
                      </span>
                      <span className="font-semibold">{money(row.balanceDue)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {d.trend.some((t) => t.revenue > 0 || t.driedKg > 0) && (
            <Card>
              <h2 className="text-base font-semibold">Six months</h2>
              <div className="mt-4 grid grid-cols-6 gap-2">
                {d.trend.map((t) => {
                  const max = Math.max(...d.trend.map((x) => x.revenue || x.driedKg || 1), 1)
                  const h = Math.max(8, ((t.revenue || t.driedKg) / max) * 96)
                  return (
                    <div key={t.periodKey} className="text-center">
                      <div className="flex h-24 items-end justify-center">
                        <div
                          className={`w-7 rounded-t-md ${t.closed ? 'bg-[var(--accent)]' : 'bg-zinc-300'}`}
                          style={{ height: `${h}px` }}
                          title={`${t.label}: ${money(t.revenue)}`}
                        />
                      </div>
                      <p className="mt-2 text-[11px] font-semibold">{t.shortLabel}</p>
                      <p className="text-[10px] text-[var(--ink-faint)]">{money(t.revenue)}</p>
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-xs text-[var(--ink-faint)]">
                Gold bars are months that have been closed. Grey means overhead is still missing.
              </p>
            </Card>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/costs" className="dgn-btn dgn-btn-secondary">
              Cost intelligence <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/sales/margins" className="dgn-btn dgn-btn-secondary">
              Sales margin <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/costs/overhead" className="dgn-btn dgn-btn-secondary">
              Close the month <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}

      {dash.isError && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Could not load the dashboard.
        </p>
      )}
    </div>
  )
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span
        className={
          'font-medium ' +
          (tone === 'good' ? 'text-teal-700' : tone === 'bad' ? 'text-red-700' : '')
        }
      >
        {value}
      </span>
    </div>
  )
}
