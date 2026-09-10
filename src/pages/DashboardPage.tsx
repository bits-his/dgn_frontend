import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, RefreshCw, X } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '@/lib/api'
import { Card } from '@/components/ui'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/lib/auth'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

type AlertTop = {
  id: number
  severity: string
  title: string
  message: string
  linkPath: string | null
}

type KpiCard = {
  id: string
  label: string
  value: number | null
  unit: string
  tone: string
  href: string
  formula: string
  permission?: string
}

type MachineRow = {
  machineId: number
  machineName: string
  produced: number
  good: number
  rejectPercent: number
  downtimeMinutes: number
  oeePercent: number | null
  lastProduct: string | null
  lastOperator: string | null
}

type Dashboard = {
  periodLabel: string
  range: { preset: string; from: string; to: string; label: string }
  production: {
    unitsProduced: number
    unitsGood: number
    unitsReject: number
    rejectPercent: number
    avgOeePercent: number | null
    processYieldPercent: number
    downtimeMinutes: number
    outputPerHour: number | null
    byStage: { stage: string; yieldPercent: number; inputKg: number; usableKg: number }[]
  }
  sales: { saleCount: number; revenue: number }
  spend: { approvedExpenses: number; wagesOutstanding: number }
  money: { cashIn: number; cashOut: number; netCash: number; receivables: number }
  costTruth: {
    overheadAllocated: boolean
    marginRestatement: {
      restatedMargin: number
      restatedMarginPercent: number
      recordedMarginPercent: number
    }
  }
  priceVsCost: Array<{
    productId: number
    productName: string
    marginPerUnit: number | null
  }>
  receivables: {
    rows: { saleNumber: string; customerName: string | null; balanceDue: number; ageDays: number }[]
  }
  inventory: { rawKg: number; wipKg: number; fgUnits: number; lowStockCount: number }
  trend: Array<{
    periodKey: string
    shortLabel: string
    revenue: number
    unitsProduced: number
    closed: boolean
  }>
  alerts: {
    total: number
    unacknowledged: number
    bySeverity: Record<string, number>
    top: AlertTop[]
  }
  kpis: KpiCard[]
  machines: MachineRow[]
  materialFlow: {
    receivedKg: number
    sortedKg: number | null
    crushedKg: number | null
    washedKg: number | null
    driedKg: number
    producedUnits: number
  }
  quality: { openHolds: number; checksInRange: number; passRatePercent: number | null }
  series: Array<{
    businessDate: string
    unitsProduced: number
    unitsGood: number
    unitsReject: number
    driedKg: number
  }>
  activity: Array<{ at: string; title: string; linkPath: string }>
  operators: Array<{
    operatorName: string
    downtimeMinutes: number
    events: number
    good: number
    rejectPercent: number
  }>
  compare: Record<
    string,
    { delta: number | null; improved: boolean | null }
  > | null
}

type DrillPayload = {
  formula?: string
  message?: string
  linkPath?: string
  rows: Array<Record<string, unknown>>
  byProduct?: Array<{ name: string; value: number }>
  byMachine?: Array<{ name: string; value: number }>
}

const RANGE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_year', label: 'This year' },
]

const CHART = {
  ink: '#14191f',
  muted: '#64748b',
  grid: '#e8edf2',
  accent: '#d97706',
  teal: '#0f766e',
  red: '#b91c1c',
  slate: '#475569',
}

const COMPARE_KEYS: Record<string, string> = {
  scrap_in: 'scrapInKg',
  dried: 'driedKg',
  units_good: 'unitsGood',
  reject_rate: 'rejectPercent',
  avg_oee: 'avgOeePercent',
  downtime: 'downtimeMinutes',
  process_yield: 'processYieldPercent',
}

function money(n: number | null | undefined) {
  if (n == null) return '—'
  return `₦${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function fmt(n: number | null | undefined, digits = 1) {
  if (n == null) return '—'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits })
}

function formatMinutes(min: number) {
  if (!min) return '0m'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function formatKpiValue(kpi: KpiCard) {
  if (kpi.value == null) return '—'
  if (kpi.unit === 'NGN') return money(kpi.value)
  if (kpi.unit === '%') return `${fmt(kpi.value, 1)}%`
  if (kpi.unit === 'min') return formatMinutes(Number(kpi.value))
  if (kpi.unit === 'kg') return `${fmt(kpi.value)} kg`
  if (kpi.unit === 'units') return fmt(kpi.value, 0)
  return fmt(kpi.value)
}

function toneDot(tone: string) {
  if (tone === 'good') return 'bg-teal-600'
  if (tone === 'watch') return 'bg-amber-500'
  if (tone === 'critical') return 'bg-red-600'
  return 'bg-slate-300'
}

function shortDate(yyMMdd: string) {
  if (!/^\d{6}$/.test(yyMMdd)) return yyMMdd
  return `${yyMMdd.slice(4, 6)}/${yyMMdd.slice(2, 4)}`
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1 font-semibold text-[var(--ink)]">{label}</p> : null}
      {payload.map((p) => (
        <p key={p.name} className="tabular-nums text-[var(--ink-muted)]">
          <span style={{ color: p.color }}>●</span> {p.name}: {fmt(p.value, 0)}
        </p>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const canExec = hasPermission(user, 'dashboard.executive')
  const canSales = hasPermission(user, 'sales.view')
  const canExpense = hasPermission(user, 'expense.view')
  const canCosts = hasPermission(user, 'costs.view')

  const [rangePreset, setRangePreset] = useState('this_month')
  const [compare, setCompare] = useState(false)
  const [floorTab, setFloorTab] = useState<'activity' | 'operators' | 'receivables'>('activity')
  const [drillKpi, setDrillKpi] = useState<string | null>(null)

  const dash = useQuery({
    queryKey: ['executive-dashboard', rangePreset, compare],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/executive', {
        params: { rangePreset, compare: compare ? '1' : undefined },
      })
      return data.data as Dashboard
    },
    enabled: canExec,
    refetchInterval: 60_000,
  })

  const drill = useQuery({
    queryKey: ['dashboard-drill', drillKpi, rangePreset],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/drill', {
        params: { kpi: drillKpi, rangePreset },
      })
      return data.data as DrillPayload
    },
    enabled: canExec && !!drillKpi,
  })

  const kpis = useMemo(() => {
    return (dash.data?.kpis || []).filter((k) => {
      if (k.permission === 'sales.view' && !canSales) return false
      if (k.permission === 'expense.view' && !canExpense && !canCosts) return false
      return true
    })
  }, [dash.data?.kpis, canSales, canExpense, canCosts])

  const d = dash.data

  const seriesData = useMemo(
    () =>
      (d?.series || []).map((s) => ({
        label: shortDate(s.businessDate),
        Good: s.unitsGood,
        Reject: s.unitsReject,
        Dried: s.driedKg,
      })),
    [d?.series],
  )

  const qualityPie = useMemo(() => {
    if (!d) return []
    const good = d.production.unitsGood || 0
    const reject = d.production.unitsReject || 0
    if (good + reject <= 0) return []
    return [
      { name: 'Good', value: good },
      { name: 'Reject', value: reject },
    ]
  }, [d])

  const machineChart = useMemo(
    () =>
      (d?.machines || []).slice(0, 6).map((m) => ({
        name: m.machineName.replace(/ machine$/i, ''),
        OEE: m.oeePercent ?? 0,
        Downtime: m.downtimeMinutes,
      })),
    [d?.machines],
  )

  const flowChart = useMemo(() => {
    if (!d) return []
    return [
      { name: 'In', kg: d.materialFlow.receivedKg || 0 },
      { name: 'Sort', kg: d.materialFlow.sortedKg || 0 },
      { name: 'Crush', kg: d.materialFlow.crushedKg || 0 },
      { name: 'Wash', kg: d.materialFlow.washedKg || 0 },
      { name: 'Dry', kg: d.materialFlow.driedKg || 0 },
    ]
  }, [d])

  const trendChart = useMemo(
    () =>
      (d?.trend || []).map((t) => ({
        name: t.shortLabel,
        Revenue: t.revenue,
        Units: t.unitsProduced,
      })),
    [d?.trend],
  )

  if (!canExec) {
    return (
      <div className="py-12 text-center text-sm text-[var(--ink-muted)]">
        No access on this account.
      </div>
    )
  }

  const restated = d?.costTruth.marginRestatement
  const critical = d?.alerts.bySeverity?.CRITICAL || 0

  return (
    <div className="space-y-3 pb-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {d ? (
          <span className="mr-auto text-sm tabular-nums text-[var(--ink-muted)]">{d.range.label}</span>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="dgn-input !py-2 w-36"
            value={rangePreset}
            onChange={(e) => setRangePreset(e.target.value)}
          >
            {RANGE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCompare((v) => !v)}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
              compare
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                : 'border-[var(--line)] bg-white text-[var(--ink-muted)]',
            )}
          >
            Compare
          </button>
          <Link to="/alerts" className="dgn-btn dgn-btn-ghost !py-2 relative">
            <Bell className="h-4 w-4" />
            {(d?.alerts.unacknowledged || 0) > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {d!.alerts.unacknowledged}
              </span>
            ) : null}
          </Link>
          <button type="button" className="dgn-btn dgn-btn-ghost !py-2" onClick={() => dash.refetch()}>
            <RefreshCw className={cn('h-4 w-4', dash.isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {dash.isError && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Could not load dashboard.</p>
      )}

      {dash.isLoading && !d && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/80" />
          ))}
        </div>
      )}

      {d && (
        <>
          {/* Alerts — compact */}
          {d.alerts.total > 0 && (
            <div
              className={cn(
                'flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2',
                critical > 0 ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/50',
              )}
            >
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white',
                  critical > 0 ? 'bg-red-600' : 'bg-amber-500 text-[#1a1205]',
                )}
              >
                {critical > 0 ? `${critical} critical` : `${d.alerts.total} alerts`}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
                {d.alerts.top.slice(0, 3).map((a) => (
                  <Link
                    key={a.id}
                    to={a.linkPath || '/alerts'}
                    className="truncate font-medium hover:text-[var(--accent-strong)]"
                  >
                    {a.title}
                  </Link>
                ))}
              </div>
              <Link to="/alerts" className="shrink-0 text-xs font-semibold text-[var(--accent-strong)]">
                All →
              </Link>
            </div>
          )}

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
            {kpis.map((kpi) => {
              const c = d.compare?.[COMPARE_KEYS[kpi.id]]
              return (
                <button
                  key={kpi.id}
                  type="button"
                  onClick={() => setDrillKpi(kpi.id)}
                  className="group rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-left shadow-[var(--shadow)] transition hover:border-[var(--accent)]"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('size-1.5 rounded-full', toneDot(kpi.tone))} />
                    <span className="truncate text-[11px] font-medium text-[var(--ink-faint)]">
                      {kpi.label}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">
                    {formatKpiValue(kpi)}
                  </p>
                  {compare && c?.delta != null ? (
                    <p
                      className={cn(
                        'mt-1 text-[11px] font-medium tabular-nums',
                        c.improved === true
                          ? 'text-teal-700'
                          : c.improved === false
                            ? 'text-red-700'
                            : 'text-[var(--ink-faint)]',
                      )}
                    >
                      {c.delta > 0 ? '+' : ''}
                      {fmt(c.delta)}
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>

          {/* Charts row */}
          <div className="grid gap-2.5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <div className="mb-1.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">Output</h2>
                <Link to="/production" className="text-xs font-medium text-[var(--accent-strong)]">
                  Production →
                </Link>
              </div>
              <div className="mb-2 flex flex-wrap gap-3 text-xs">
                <Metric label="Good" value={fmt(d.production.unitsGood, 0)} />
                <Metric label="Reject" value={`${d.production.rejectPercent}%`} danger={d.production.rejectPercent > 5} />
                <Metric
                  label="OEE"
                  value={d.production.avgOeePercent != null ? `${d.production.avgOeePercent}%` : '—'}
                />
                <Metric label="Yield" value={`${d.production.processYieldPercent}%`} />
                <Metric label="Downtime" value={formatMinutes(d.production.downtimeMinutes || 0)} />
              </div>
              <div className="h-36">
                {seriesData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={seriesData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="goodFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART.teal} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={CHART.teal} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: CHART.muted, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="Good"
                        stroke={CHART.teal}
                        fill="url(#goodFill)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="Reject"
                        stroke={CHART.red}
                        fill="transparent"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold tracking-tight">Good vs reject</h2>
              <div className="h-36">
                {qualityPie.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={qualityPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        <Cell fill={CHART.teal} />
                        <Cell fill={CHART.red} />
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
              <div className="mt-1 flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-teal-700" /> Good
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-red-700" /> Reject
                </span>
              </div>
            </Card>
          </div>

          {/* Machines + material */}
          <div className="grid gap-2.5 lg:grid-cols-2">
            <Card>
              <div className="mb-1.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">Machine OEE</h2>
                <Link to="/machines" className="text-xs font-medium text-[var(--accent-strong)]">
                  All →
                </Link>
              </div>
              <div className="h-32">
                {machineChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={machineChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: CHART.muted, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: CHART.muted, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="OEE" fill={CHART.accent} radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
              {d.machines.length > 0 && (
                <ul className="mt-3 divide-y divide-[var(--line)]">
                  {d.machines.slice(0, 4).map((m) => (
                    <li key={m.machineId} className="flex items-center justify-between py-2 text-sm">
                      <span className="truncate font-medium">{m.machineName}</span>
                      <span className="tabular-nums text-[var(--ink-muted)]">
                        {m.oeePercent != null ? `${m.oeePercent}%` : '—'}
                        {m.downtimeMinutes > 0 ? ` · ${formatMinutes(m.downtimeMinutes)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold tracking-tight">Material flow (kg)</h2>
              <div className="h-32">
                {flowChart.some((x) => x.kg > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={flowChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: CHART.muted, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="kg" name="kg" fill={CHART.slate} radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-3">
                <div className="rounded-xl bg-zinc-50 py-2">
                  <p className="text-[var(--ink-faint)]">FG</p>
                  <p className="font-semibold tabular-nums">{fmt(d.inventory.fgUnits, 0)}</p>
                </div>
                <div className="rounded-xl bg-zinc-50 py-2">
                  <p className="text-[var(--ink-faint)]">WIP</p>
                  <p className="font-semibold tabular-nums">{fmt(d.inventory.wipKg)} kg</p>
                </div>
                <div className="rounded-xl bg-zinc-50 py-2">
                  <p className="text-[var(--ink-faint)]">Low stock</p>
                  <p
                    className={cn(
                      'font-semibold tabular-nums',
                      (d.inventory.lowStockCount || 0) > 0 ? 'text-red-700' : '',
                    )}
                  >
                    {d.inventory.lowStockCount || 0}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Quality + money + trend */}
          <div className="grid gap-2.5 lg:grid-cols-3">
            <Card>
              <div className="mb-1.5 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">Quality</h2>
                <Link to="/qc" className="text-xs font-medium text-[var(--accent-strong)]">
                  QC →
                </Link>
              </div>
              <div className="space-y-3">
                <BigStat
                  label="Holds"
                  value={String(d.quality.openHolds)}
                  danger={d.quality.openHolds > 0}
                />
                <BigStat
                  label="Pass rate"
                  value={
                    d.quality.passRatePercent != null ? `${d.quality.passRatePercent}%` : '—'
                  }
                />
                <BigStat label="Checks" value={String(d.quality.checksInRange)} />
              </div>
            </Card>

            {(canCosts || canSales || canExpense) && (
              <Card>
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-tight">{d.periodLabel}</h2>
                  {canCosts ? (
                    <Link to="/costs" className="text-xs font-medium text-[var(--accent-strong)]">
                      Costs →
                    </Link>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {canCosts && restated ? (
                    <BigStat
                      label="True margin"
                      value={`${money(restated.restatedMargin)} · ${restated.restatedMarginPercent}%`}
                      danger={restated.restatedMargin < 0}
                    />
                  ) : null}
                  {canSales ? <BigStat label="Cash in" value={money(d.money.cashIn)} /> : null}
                  {(canSales || canExpense) && (
                    <BigStat
                      label="Net cash"
                      value={money(d.money.netCash)}
                      danger={d.money.netCash < 0}
                    />
                  )}
                  {canSales ? (
                    <BigStat
                      label="Receivables"
                      value={money(d.money.receivables)}
                      danger={d.money.receivables > 0}
                    />
                  ) : null}
                  {!d.costTruth.overheadAllocated && canCosts ? (
                    <Link
                      to="/costs/overhead"
                      className="block rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
                    >
                      Close month →
                    </Link>
                  ) : null}
                </div>
              </Card>
            )}

            <Card>
              <h2 className="mb-3 text-sm font-semibold tracking-tight">6-month revenue</h2>
              <div className="h-28">
                {trendChart.some((t) => t.Revenue > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: CHART.muted, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v) => money(Number(v))}
                        contentStyle={{
                          borderRadius: 8,
                          border: '1px solid #d7dee6',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="Revenue" fill={CHART.accent} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </div>
            </Card>
          </div>

          {/* Floor */}
          <Card className="!p-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
              <h2 className="text-sm font-semibold tracking-tight">Floor</h2>
              <div className="inline-flex rounded-lg bg-zinc-100 p-0.5">
                {(
                  [
                    ['activity', 'Activity'],
                    ['operators', 'Operators'],
                    ...(canSales ? ([['receivables', 'Owed']] as const) : []),
                  ] as Array<['activity' | 'operators' | 'receivables', string]>
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFloorTab(id)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                      floorTab === id ? 'bg-white shadow-sm' : 'text-[var(--ink-muted)]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto px-4 sm:px-5">
              {floorTab === 'activity' &&
                (d.activity?.length ? (
                  d.activity.map((row, i) => (
                    <Link
                      key={`${row.at}-${i}`}
                      to={row.linkPath}
                      className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-1.5 text-sm last:border-0 hover:text-[var(--accent-strong)]"
                    >
                      <span className="min-w-0 truncate font-medium">{row.title}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-[var(--ink-faint)]">
                        {formatDateTime(row.at)}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="py-8 text-sm text-[var(--ink-muted)]">No activity yet.</p>
                ))}

              {floorTab === 'operators' &&
                (d.operators?.length ? (
                  d.operators.map((op) => (
                    <div
                      key={op.operatorName}
                      className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-1.5 text-sm last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{op.operatorName}</p>
                        <p className="text-[11px] text-[var(--ink-faint)]">
                          {fmt(op.good, 0)} good
                          {op.events ? ` · ${op.events} stops` : ''}
                        </p>
                      </div>
                      <p
                        className={cn(
                          'tabular-nums',
                          op.downtimeMinutes > 0 ? 'font-semibold text-red-700' : 'text-[var(--ink-muted)]',
                        )}
                      >
                        {formatMinutes(op.downtimeMinutes)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-sm text-[var(--ink-muted)]">No operator data.</p>
                ))}

              {floorTab === 'receivables' &&
                canSales &&
                (d.receivables.rows?.length ? (
                  d.receivables.rows.slice(0, 12).map((row) => (
                    <Link
                      key={row.saleNumber}
                      to={`/sales/${row.saleNumber}`}
                      className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-1.5 text-sm last:border-0 hover:underline"
                    >
                      <span>
                        {row.customerName || row.saleNumber}
                        <span className="ml-2 text-[11px] text-[var(--ink-faint)]">{row.ageDays}d</span>
                      </span>
                      <span className="font-semibold tabular-nums">{money(row.balanceDue)}</span>
                    </Link>
                  ))
                ) : (
                  <p className="py-8 text-sm text-[var(--ink-muted)]">Nothing outstanding.</p>
                ))}
            </div>
          </Card>
        </>
      )}

      {/* Drill sheet */}
      {drillKpi && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
          onClick={() => setDrillKpi(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">
                {kpis.find((k) => k.id === drillKpi)?.label || drillKpi}
              </h2>
              <button type="button" className="rounded-lg p-1 hover:bg-zinc-100" onClick={() => setDrillKpi(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {drill.isLoading && <p className="mt-6 text-sm text-[var(--ink-muted)]">Loading…</p>}

            {drill.data?.byProduct?.length ? (
              <div className="mt-5 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={drill.data.byProduct.slice(0, 6)}
                    layout="vertical"
                    margin={{ left: 4, right: 8 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      tick={{ fontSize: 11, fill: CHART.muted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Good" fill={CHART.teal} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}

            {(drill.data?.rows || []).slice(0, 15).map((row, i) => {
              const link = String(row.linkPath || '')
              const title = String(row.batchNumber || row.productName || row.machineName || `#${i + 1}`)
              const sub = [
                row.productName && row.batchNumber ? String(row.productName) : null,
                row.machineName ? String(row.machineName) : null,
                row.qtyGood != null ? `${fmt(Number(row.qtyGood), 0)} good` : null,
              ]
                .filter(Boolean)
                .join(' · ')
              const inner = (
                <>
                  <p className="text-sm font-medium">{title}</p>
                  {sub ? <p className="text-xs text-[var(--ink-muted)]">{sub}</p> : null}
                </>
              )
              return (
                <div key={i} className="border-b border-[var(--line)] py-3">
                  {link ? (
                    <Link to={link} onClick={() => setDrillKpi(null)} className="block hover:text-[var(--accent-strong)]">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </div>
              )
            })}

            {drill.data?.message && !(drill.data.rows || []).length && (
              <p className="mt-4 text-sm text-[var(--ink-muted)]">{drill.data.message}</p>
            )}

            <Link
              to={drill.data?.linkPath || kpis.find((k) => k.id === drillKpi)?.href || '/'}
              className="dgn-btn dgn-btn-secondary mt-5 w-full justify-center"
              onClick={() => setDrillKpi(null)}
            >
              Open page
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  danger,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', danger && 'text-red-700')}>{value}</p>
    </div>
  )
}

function BigStat({
  label,
  value,
  danger,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-[var(--ink-muted)]">{label}</span>
      <span className={cn('text-sm font-semibold tabular-nums', danger && 'text-red-700')}>{value}</span>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-[var(--ink-faint)]">No data</div>
  )
}
