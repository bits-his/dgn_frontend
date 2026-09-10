import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  RefreshCw,
  X,
  DollarSign,
  TrendingUp,
  Factory,
  Gauge,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '@/lib/api'
import { Card } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/lib/auth'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { StaffDashboard } from '@/components/dashboard/StaffDashboard'

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
    shortLabel: string
    revenue: number
    unitsProduced: number
  }>
  series: Array<{
    businessDate: string
    unitsGood: number
    unitsReject: number
    driedKg: number
  }>
  machines: MachineRow[]
  materialFlow: {
    receivedKg: number
    sortedKg: number
    crushedKg: number
    washedKg: number
    driedKg: number
  }
  quality: {
    openHolds: number
    passRatePercent: number | null
    checksInRange: number
  }
  alerts: {
    total: number
    unacknowledged: number
    bySeverity: Record<string, number>
    top: AlertTop[]
  }
  kpis: KpiCard[]
  compare?: Record<string, { current: number; prior: number; delta: number; improved: boolean | null }>
  activity?: Array<{ at: string; title: string; linkPath: string }>
  operatorShift?: Array<{ operatorName: string; unitsProduced: number; shiftName?: string }>
}

type DrillPayload = {
  kpi: string
  title: string
  valueFormatted: string
  formula: string
  interpretation: string
  linkPath: string
  chart?: { label: string; value: number }[]
  rows?: Record<string, unknown>[]
  message?: string
}

const RANGE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_year', label: 'Year to date' },
]

const CHART = {
  teal: '#0f766e',
  red: '#dc2626',
  accent: '#b45309',
  slate: '#475569',
  muted: '#64748b',
  grid: '#e2e8f0',
}

const COMPARE_KEYS: Record<string, string> = {
  revenue: 'revenue',
  units_produced: 'unitsProduced',
  oee: 'oee',
  process_yield: 'yield',
  true_margin: 'margin',
  open_holds: 'holds',
  receivables: 'receivables',
  cash_flow: 'cashFlow',
}

function shortDate(yyyymmdd: string) {
  if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd || ''
  const m = yyyymmdd.slice(4, 6)
  const d = yyyymmdd.slice(6, 8)
  return `${d}/${m}`
}

function fmt(n: number | null | undefined, decimals = 1) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `₦${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function formatMinutes(mins: number) {
  if (!mins) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

function formatKpiValue(kpi: KpiCard) {
  if (kpi.value == null) return '—'
  if (kpi.unit === 'NGN') return money(kpi.value)
  if (kpi.unit === '%') return `${kpi.value}%`
  if (kpi.unit === 'min') return formatMinutes(kpi.value)
  return fmt(kpi.value)
}

function toneDot(tone: string) {
  switch (tone) {
    case 'good':
      return 'bg-emerald-500'
    case 'danger':
      return 'bg-red-500'
    case 'warning':
      return 'bg-amber-500'
    default:
      return 'bg-zinc-400'
  }
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/95 p-3 text-xs shadow-md backdrop-blur-xs dark:border-zinc-800 dark:bg-zinc-950">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{label}</p>
      <div className="mt-1 space-y-1">
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-3 text-zinc-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}:
            </span>
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {Number(p.value).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
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
  const [viewMode, setViewMode] = useState<'executive' | 'staff'>('executive')
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

  const flowChart = useMemo(() => {
    if (!d) return []
    return [
      { name: 'Inbound', kg: d.materialFlow.receivedKg || 0 },
      { name: 'Sorted', kg: d.materialFlow.sortedKg || 0 },
      { name: 'Crushed', kg: d.materialFlow.crushedKg || 0 },
      { name: 'Washed', kg: d.materialFlow.washedKg || 0 },
      { name: 'Dried', kg: d.materialFlow.driedKg || 0 },
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

  const roleInfo = user?.roleCode ? (
    {
      OPERATOR: 'Machine Operator',
      PROD_SUPERVISOR: 'Production Supervisor',
      STOREKEEPER: 'Storekeeper',
      INVENTORY_OFFICER: 'Inventory Officer',
      QC_OFFICER: 'Quality Control Officer',
      SALES_OFFICER: 'Sales Officer',
      FINANCE_OFFICER: 'Finance Officer',
      MAINTENANCE_OFFICER: 'Maintenance Officer',
      FACTORY_MANAGER: 'Factory Manager',
      MANAGEMENT: 'Management',
      ADMIN: 'System Administrator',
    } as Record<string, string>
  )[user.roleCode] : null
  const roleLabel = roleInfo || user?.roleCode || 'Staff'
  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Non-executive staff or executive toggling to staff view
  if (!canExec || viewMode === 'staff') {
    return (
      <PageLayout
        title={`Hello, ${user?.firstname || user?.username || 'Staff'}`}
        description={`${roleLabel} · Operations Workspace · ${todayStr}`}
        actions={
          canExec ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold shrink-0"
              onClick={() => setViewMode('executive')}
            >
              Executive View
            </Button>
          ) : null
        }
      >
        <StaffDashboard />
      </PageLayout>
    )
  }

  const restated = d?.costTruth.marginRestatement
  const critical = d?.alerts.bySeverity?.CRITICAL || 0

  return (
    <PageLayout
      title="Executive Command Centre"
      description={d ? `${d.range.label} · Strategic Factory Intelligence` : 'Strategic Factory Intelligence'}
      actions={
        <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setViewMode('staff')}
            className="h-8 text-xs font-semibold shrink-0"
          >
            Staff View
          </Button>
          <Select value={rangePreset} onValueChange={(val) => setRangePreset(val)}>
            <SelectTrigger className="h-8 w-28 sm:w-36 text-xs bg-white dark:bg-zinc-900 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.id} value={o.id} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={compare ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCompare((v) => !v)}
            className="h-8 text-xs font-medium shrink-0"
          >
            Compare
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 relative shrink-0" asChild>
            <Link to="/alerts">
              <Bell className="h-4 w-4" />
              {(d?.alerts.unacknowledged || 0) > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {d!.alerts.unacknowledged}
                </span>
              ) : null}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => dash.refetch()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', dash.isFetching && 'animate-spin')} />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {dash.isError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load executive dashboard.
          </p>
        )}

        {dash.isLoading && !d && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/80 dark:bg-zinc-900" />
            ))}
          </div>
        )}

        {d && (
          <>
            {/* Critical Alerts Banner */}
            {d.alerts.total > 0 && (
              <div
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xs',
                  critical > 0
                    ? 'border-red-200 bg-red-50/70 text-red-900'
                    : 'border-amber-200 bg-amber-50/60 text-amber-900',
                )}
              >
                <span
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white shrink-0',
                    critical > 0 ? 'bg-red-600' : 'bg-amber-600',
                  )}
                >
                  {critical > 0 ? `${critical} Critical` : `${d.alerts.total} Alerts`}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm">
                  {d.alerts.top.slice(0, 3).map((a) => (
                    <Link
                      key={a.id}
                      to={a.linkPath || '/alerts'}
                      className="truncate font-medium hover:underline hover:text-[var(--accent-strong)]"
                    >
                      {a.title}
                    </Link>
                  ))}
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs font-semibold shrink-0" asChild>
                  <Link to="/alerts">View all ({d.alerts.total}) →</Link>
                </Button>
              </div>
            )}

            {/* 1. OPERATIONAL KPIS (AT THE TOP) */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Operational KPIs</h2>
                  <p className="text-xs text-muted-foreground">Strategic factory pulse &amp; drivers · Click any card to drill down</p>
                </div>
                <div className="flex items-center gap-2">
                  {compare && (
                    <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1 dark:bg-teal-950 dark:border-teal-800 dark:text-teal-300">
                      Comparing vs prior period
                    </span>
                  )}
                </div>
              </div>

              {/* 4 Elevated Hero Scorecards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Card 1: Revenue & Cash */}
                <div className="rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-4 shadow-xs dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Gross Turnover</span>
                    <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      <DollarSign className="size-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
                    ₦{fmt(d.sales.revenue, 0)}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{d.sales.saleCount} sales orders</span>
                    <span className="font-medium text-amber-600">₦{fmt(d.money.receivables)} due</span>
                  </div>
                </div>

                {/* Card 2: True Restated Margin */}
                <div className="rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-4 shadow-xs dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">True Net Margin</span>
                    <div className="flex size-7 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400">
                      <TrendingUp className="size-4" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
                      {restated ? `${restated.restatedMarginPercent}%` : '—'}
                    </p>
                    {restated && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ({money(restated.restatedMargin)})
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Recorded: {restated?.recordedMarginPercent ?? '—'}%</span>
                    <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                      {d.costTruth.overheadAllocated ? 'Overhead closed' : 'Overhead open'}
                    </span>
                  </div>
                </div>

                {/* Card 3: Total Production */}
                <div className="rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-4 shadow-xs dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Production Output</span>
                    <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                      <Factory className="size-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
                    {fmt(d.production.unitsProduced, 0)} <span className="text-xs font-normal text-muted-foreground">units</span>
                  </p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="text-emerald-600 font-medium">{fmt(d.production.unitsGood, 0)} good</span>
                    <span className={d.production.rejectPercent > 5 ? 'text-red-600 font-medium' : ''}>
                      {d.production.rejectPercent}% reject
                    </span>
                  </div>
                </div>

                {/* Card 4: Factory OEE */}
                <div className="rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-4 shadow-xs dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Plant OEE &amp; Uptime</span>
                    <div className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      <Gauge className="size-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
                    {d.production.avgOeePercent != null ? `${d.production.avgOeePercent}%` : '—'}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Yield: {d.production.processYieldPercent}%</span>
                    <span className="text-amber-600">{formatMinutes(d.production.downtimeMinutes || 0)} down</span>
                  </div>
                </div>
              </div>

              {/* KPI Matrix Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                {kpis.map((kpi) => {
                  const c = d.compare?.[COMPARE_KEYS[kpi.id]]
                  return (
                    <button
                      key={kpi.id}
                      type="button"
                      onClick={() => setDrillKpi(kpi.id)}
                      className="group rounded-xl border border-zinc-200/80 bg-white p-3 text-left shadow-2xs transition hover:border-[var(--accent)] hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={cn('size-2 rounded-full shrink-0', toneDot(kpi.tone))} />
                        <span className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {kpi.label}
                        </span>
                      </div>
                      <p className="mt-1.5 text-lg font-bold tracking-tight text-foreground tabular-nums truncate">
                        {formatKpiValue(kpi)}
                      </p>
                      {compare && c?.delta != null ? (
                        <p
                          className={cn(
                            'mt-0.5 text-xs font-semibold tabular-nums',
                            c.improved === true
                              ? 'text-teal-700'
                              : c.improved === false
                                ? 'text-red-700'
                                : 'text-zinc-500',
                          )}
                        >
                          {c.delta > 0 ? '+' : ''}
                          {fmt(c.delta)} vs prior
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[10px] text-zinc-400 truncate">{kpi.formula}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. PRODUCTION & OPERATIONS (UNDERNEATH, NOT TABS, MINIMAL) */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/60 pt-4 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Production &amp; Machine Operations</h2>
                  <p className="text-xs text-muted-foreground">Output throughput, stage conversion yields, and active machine performance</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                    <Link to="/production">Open Production →</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                    <Link to="/machines">View All Machines ({d.machines.length}) →</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {/* Production Velocity Mini Card */}
                <Card className="xl:col-span-2 p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold tracking-tight text-foreground">Production Velocity</h3>
                      <p className="text-xs text-muted-foreground">Good vs reject units trend</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">{d.production.processYieldPercent}% Yield</span>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-4 text-xs">
                    <Metric label="Good Units" value={fmt(d.production.unitsGood, 0)} />
                    <Metric label="Reject Rate" value={`${d.production.rejectPercent}%`} danger={d.production.rejectPercent > 5} />
                    <Metric label="OEE" value={d.production.avgOeePercent != null ? `${d.production.avgOeePercent}%` : '—'} />
                    <Metric label="Downtime" value={formatMinutes(d.production.downtimeMinutes || 0)} />
                  </div>
                  <div className="h-48">
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
                          <XAxis dataKey="label" tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="Good" stroke={CHART.teal} fill="url(#goodFill)" strokeWidth={2} />
                          <Area type="monotone" dataKey="Reject" stroke={CHART.red} fill="transparent" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart />
                    )}
                  </div>
                </Card>

                {/* Stage Conversion Yields Mini Card */}
                <Card className="p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold tracking-tight text-foreground">Stage Conversion Yields</h3>
                    <div className="space-y-2.5 divide-y divide-zinc-100 dark:divide-zinc-800">
                      {d.production.byStage?.map((s) => (
                        <div key={s.stage} className="pt-2 first:pt-0">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="uppercase text-foreground">{s.stage}</span>
                            <span className={cn('tabular-nums', s.yieldPercent < 90 ? 'text-amber-600' : 'text-emerald-600')}>
                              {s.yieldPercent}% yield
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Input: {fmt(s.inputKg)} kg</span>
                            <span>Usable: {fmt(s.usableKg)} kg</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-3 w-full h-7 text-xs font-semibold text-primary" asChild>
                    <Link to="/production">View Stage Details →</Link>
                  </Button>
                </Card>
              </div>

              {/* Minimal Active Machine Roster */}
              <Card className="p-0 overflow-hidden">
                <div className="border-b border-zinc-200/80 px-4 py-2.5 sm:px-5 flex items-center justify-between dark:border-zinc-800">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Active Machine Roster</h3>
                    <p className="text-xs text-muted-foreground">Efficiency &amp; operator status</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-primary" asChild>
                    <Link to="/machines">View All ({d.machines.length}) →</Link>
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50/70 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                        <th className="px-4 py-2 font-semibold">Machine</th>
                        <th className="px-3 py-2 font-semibold text-right">OEE</th>
                        <th className="px-3 py-2 font-semibold text-right">Produced</th>
                        <th className="px-3 py-2 font-semibold text-right">Good</th>
                        <th className="px-3 py-2 font-semibold text-right">Reject %</th>
                        <th className="px-3 py-2 font-semibold text-right">Downtime</th>
                        <th className="px-4 py-2 font-semibold">Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {d.machines.slice(0, 4).map((m) => (
                        <tr key={m.machineId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                          <td className="px-4 py-2.5 font-medium text-foreground">{m.machineName}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">
                            {m.oeePercent != null ? `${m.oeePercent}%` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{fmt(m.produced, 0)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 font-medium">{fmt(m.good, 0)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                            <span className={m.rejectPercent > 5 ? 'text-red-600' : 'text-zinc-600'}>
                              {m.rejectPercent}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500">
                            {formatMinutes(m.downtimeMinutes)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">
                            {m.lastOperator || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {d.machines.length > 4 && (
                  <div className="border-t border-zinc-100 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground dark:border-zinc-800">
                    <span>Showing top 4 of {d.machines.length} active machines</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs font-semibold text-primary" asChild>
                      <Link to="/machines">View all {d.machines.length} machines →</Link>
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            {/* 3. MATERIAL FLOW & STOCK BALANCE (MINIMAL) */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/60 pt-4 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Material Flow &amp; Store Balance</h2>
                  <p className="text-xs text-muted-foreground">Volume throughput across all processing stages (kg)</p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                  <Link to="/inventory">View Inventory Store →</Link>
                </Button>
              </div>

              <Card className="p-4 sm:p-5">
                <div className="h-40">
                  {flowChart.some((x) => x.kg > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={flowChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke={CHART.grid} vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="kg" name="Volume (kg)" fill={CHART.slate} radius={[6, 6, 0, 0]} maxBarSize={44} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">Finished Goods Store</p>
                    <p className="mt-0.5 font-bold text-sm text-foreground tabular-nums">{fmt(d.inventory.fgUnits, 0)} units</p>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">Work In Progress (WIP)</p>
                    <p className="mt-0.5 font-bold text-sm text-foreground tabular-nums">{fmt(d.inventory.wipKg)} kg</p>
                  </div>
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">Low Stock Flags</p>
                    <p className={cn('mt-0.5 font-bold text-sm tabular-nums', (d.inventory.lowStockCount || 0) > 0 ? 'text-red-600' : 'text-foreground')}>
                      {d.inventory.lowStockCount || 0} items
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* 4. FINANCIAL TRUTH & MARGINS (UNDERNEATH, NOT TABS, MINIMAL) */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/60 pt-4 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Financial Truth &amp; Cash Flow</h2>
                  <p className="text-xs text-muted-foreground">True net margins, liquidity movements, and customer credit exposure</p>
                </div>
                <div className="flex items-center gap-2">
                  {canCosts && (
                    <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                      <Link to="/costs">Cost Intelligence →</Link>
                    </Button>
                  )}
                  {canSales && (
                    <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                      <Link to="/distributors">Distributors &amp; Receivables →</Link>
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {/* Margin Restatement Card */}
                <Card className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">Margin Restatement</h3>
                    {canCosts && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs font-semibold text-primary" asChild>
                        <Link to="/costs">Details →</Link>
                      </Button>
                    )}
                  </div>
                  {restated ? (
                    <div className="space-y-2.5">
                      <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 dark:bg-teal-950 dark:border-teal-800">
                        <p className="text-xs font-semibold uppercase text-teal-800 dark:text-teal-300">True Net Margin</p>
                        <p className="mt-0.5 text-2xl font-bold text-teal-900 tabular-nums dark:text-teal-100">
                          {money(restated.restatedMargin)}
                        </p>
                        <p className="text-xs text-teal-700 font-medium mt-0.5">
                          {restated.restatedMarginPercent}% after full overhead allocation
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs py-1 border-b border-zinc-100 dark:border-zinc-800">
                        <span className="text-muted-foreground">Recorded Gross Margin</span>
                        <span className="font-semibold tabular-nums text-foreground">{restated.recordedMarginPercent}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs py-1">
                        <span className="text-muted-foreground">Overhead Absorption</span>
                        <span className="font-semibold text-foreground">
                          {d.costTruth.overheadAllocated ? 'Allocated' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Restatement not available for period.</p>
                  )}
                </Card>

                {/* Cash Flow Card */}
                <Card className="p-4 sm:p-5">
                  <h3 className="mb-3 text-sm font-semibold tracking-tight text-foreground">Cash Flow &amp; Liabilities</h3>
                  <div className="space-y-2.5">
                    <BigStat label="Cash Inflow" value={money(d.money.cashIn)} />
                    <BigStat label="Cash Outflow" value={money(d.money.cashOut)} />
                    <BigStat label="Net Cash Movement" value={money(d.money.netCash)} danger={d.money.netCash < 0} />
                    <BigStat label="Wages Outstanding" value={money(d.spend.wagesOutstanding)} danger={d.spend.wagesOutstanding > 0} />
                  </div>
                </Card>

                {/* Revenue Trend Mini Chart */}
                <Card className="p-4 sm:p-5">
                  <h3 className="mb-2 text-sm font-semibold tracking-tight text-foreground">6-Month Turnover Trend</h3>
                  <div className="h-40">
                    {trendChart.some((t) => t.Revenue > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <CartesianGrid stroke={CHART.grid} vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip formatter={(v) => money(Number(v))} />
                          <Bar dataKey="Revenue" fill={CHART.accent} radius={[6, 6, 0, 0]} maxBarSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart />
                    )}
                  </div>
                </Card>
              </div>

              {/* Minimal Receivables Aging Table */}
              {canSales && (d.receivables.rows || []).length > 0 && (
                <Card className="p-0 overflow-hidden">
                  <div className="border-b border-zinc-200/80 px-4 py-2.5 sm:px-5 flex items-center justify-between dark:border-zinc-800">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Outstanding Customer Receivables</h3>
                      <p className="text-xs text-muted-foreground">Unpaid sales balances with overdue age</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-primary" asChild>
                      <Link to="/distributors">View All Receivables →</Link>
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-100 bg-zinc-50/70 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                          <th className="px-4 py-2 font-semibold">Sale #</th>
                          <th className="px-4 py-2 font-semibold">Customer / Distributor</th>
                          <th className="px-4 py-2 font-semibold text-right">Balance Due</th>
                          <th className="px-4 py-2 font-semibold text-right">Age (Days)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {d.receivables.rows.slice(0, 4).map((r) => (
                          <tr key={r.saleNumber} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                            <td className="px-4 py-2.5 font-semibold text-xs text-[var(--accent-strong)]">
                              <Link to={`/sales/${r.saleNumber}`} className="hover:underline">
                                {r.saleNumber}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5 text-foreground">{r.customerName || '—'}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                              {money(r.balanceDue)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', r.ageDays > 30 ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-700')}>
                                {r.ageDays}d
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {d.receivables.rows.length > 4 && (
                    <div className="border-t border-zinc-100 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground dark:border-zinc-800">
                      <span>Showing 4 of {d.receivables.rows.length} overdue customer balances</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs font-semibold text-primary" asChild>
                        <Link to="/distributors">View all {d.receivables.rows.length} balances →</Link>
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* 5. QUALITY & INVENTORY SUMMARY (UNDERNEATH, NOT TABS, MINIMAL) */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/60 pt-4 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Quality &amp; Inventory Health</h2>
                  <p className="text-xs text-muted-foreground">Inspection pass rates, quarantine holds, stock levels and floor activity logs</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                    <Link to="/qc">View Quality →</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                    <Link to="/inventory">View Inventory →</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* QC Health Card */}
                <Card className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">Quality Control Health</h3>
                    <Button variant="ghost" size="sm" className="h-6 text-xs font-semibold text-primary" asChild>
                      <Link to="/qc">Open QC →</Link>
                    </Button>
                  </div>
                  <div className="space-y-2.5">
                    <BigStat
                      label="Pass Rate"
                      value={d.quality.passRatePercent != null ? `${d.quality.passRatePercent}%` : '—'}
                    />
                    <BigStat
                      label="Open Quarantine / Holds"
                      value={String(d.quality.openHolds)}
                      danger={d.quality.openHolds > 0}
                    />
                    <BigStat label="Inspections Completed" value={String(d.quality.checksInRange)} />
                  </div>
                </Card>

                {/* Inventory Summary Card */}
                <Card className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">Inventory Summary</h3>
                    <Button variant="ghost" size="sm" className="h-6 text-xs font-semibold text-primary" asChild>
                      <Link to="/inventory">Inventory →</Link>
                    </Button>
                  </div>
                  <div className="space-y-2.5">
                    <BigStat label="Finished Goods" value={`${fmt(d.inventory.fgUnits, 0)} units`} />
                    <BigStat label="Work In Progress (WIP)" value={`${fmt(d.inventory.wipKg)} kg`} />
                    <BigStat label="Raw Material (Yard)" value={`${fmt(d.inventory.rawKg)} kg`} />
                    <BigStat label="Low Stock Items" value={String(d.inventory.lowStockCount)} danger={d.inventory.lowStockCount > 0} />
                  </div>
                </Card>

                {/* Floor Activity Card */}
                <Card className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground">Floor Activity Log</h3>
                    <Button variant="ghost" size="sm" className="h-6 text-xs font-semibold text-primary" asChild>
                      <Link to="/staff">Staff Directory →</Link>
                    </Button>
                  </div>
                  <div className="max-h-52 overflow-y-auto space-y-2">
                    {d.activity?.slice(0, 4).map((act, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0 text-xs dark:border-zinc-800">
                        <Link to={act.linkPath} className="truncate font-medium text-foreground hover:text-[var(--accent-strong)]">
                          {act.title}
                        </Link>
                        <span className="text-[10px] text-zinc-400 tabular-nums shrink-0 ml-2">
                          {formatDateTime(act.at)}
                        </span>
                      </div>
                    ))}
                    {(!d.activity || d.activity.length === 0) && (
                      <p className="text-xs text-muted-foreground">No recent floor activity logs.</p>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* Drilldown Drawer */}
        {drillKpi && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs">
            <div className="h-full w-full max-w-md overflow-y-auto border-l border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-foreground">
                    {drill.data?.title || drillKpi}
                  </h3>
                  <p className="text-xs text-muted-foreground">{drill.data?.formula}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setDrillKpi(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              {drill.isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading breakdown…</div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period Value</span>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-foreground tabular-nums">
                      {drill.data?.valueFormatted}
                    </p>
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {drill.data?.interpretation}
                    </p>
                  </div>

                  {drill.data?.chart && drill.data.chart.length > 0 && (
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={drill.data.chart} layout="vertical" margin={{ left: 24, right: 8 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={80} />
                          <Tooltip />
                          <Bar dataKey="value" name="Qty" fill={CHART.teal} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Contributors</h4>
                    {(drill.data?.rows || []).slice(0, 15).map((row, i) => {
                      const link = String(row.linkPath || '')
                      const title = String(row.batchNumber || row.productName || row.machineName || `#${i + 1}`)
                      const sub = [
                        row.productName && row.batchNumber ? String(row.productName) : null,
                        row.machineName ? String(row.machineName) : null,
                        row.qtyGood != null ? `${fmt(Number(row.qtyGood), 0)} good` : null,
                      ].filter(Boolean).join(' · ')

                      return (
                        <div key={i} className="border-b border-zinc-100 py-2.5 text-xs dark:border-zinc-800 last:border-0">
                          {link ? (
                            <Link to={link} onClick={() => setDrillKpi(null)} className="font-semibold text-foreground hover:text-[var(--accent-strong)] hover:underline">
                              {title}
                            </Link>
                          ) : (
                            <p className="font-semibold text-foreground">{title}</p>
                          )}
                          {sub && <p className="text-muted-foreground mt-0.5">{sub}</p>}
                        </div>
                      )
                    })}
                  </div>

                  <Button className="w-full mt-4" asChild onClick={() => setDrillKpi(null)}>
                    <Link to={drill.data?.linkPath || kpis.find((k) => k.id === drillKpi)?.href || '/'}>
                      Open Full Module
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={cn('text-sm font-semibold tabular-nums', danger ? 'text-red-600' : 'text-foreground')}>{value}</p>
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
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', danger ? 'text-red-600' : 'text-foreground')}>{value}</span>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No data available</div>
  )
}
