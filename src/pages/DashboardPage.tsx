import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  RefreshCw,
  X,
  DollarSign,
  Factory,
  Recycle,
  PackageCheck,
} from 'lucide-react'
import {
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/lib/auth'
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
  inventory: {
    rawKg: number
    boughtKg?: number
    availableKg?: number
    wasteKg?: number
    wipKg: number
    fgUnits: number
    lowStockCount: number
  }
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
    wasteKg?: number
    availableKg?: number
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

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const canExec = hasPermission(user, 'dashboard.executive')
  const canSales = hasPermission(user, 'sales.view')
  const canExpense = hasPermission(user, 'expense.view')
  const canCosts = hasPermission(user, 'costs.view')

  const [rangePreset, setRangePreset] = useState('this_week')
  const compare = false
  const [viewMode, setViewMode] = useState<'executive' | 'staff'>('executive')
  const [drillKpi, setDrillKpi] = useState<string | null>(null)
  const [activeKpiModal, setActiveKpiModal] = useState<
    'raw_material' | 'production' | 'finished_goods' | 'sales' | null
  >(null)

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
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

              {/* Compact KPI scorecards */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
                {/* Card 1: Raw Material */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKpiModal('raw_material')}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveKpiModal('raw_material')}
                  className="cursor-pointer rounded-xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-2.5 sm:p-3 shadow-xs transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 group select-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                      Raw Material
                    </span>
                    <div className="flex size-5 sm:size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
                      <Recycle className="size-3 sm:size-3.5" />
                    </div>
                  </div>
                  <p className="mt-1 text-base sm:text-xl font-bold tracking-tight text-foreground tabular-nums truncate">
                    {fmt(d.materialFlow.receivedKg || 0)}{' '}
                    <span className="text-[10px] font-normal text-muted-foreground">kg</span>
                  </p>
                  <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>Quantity</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {fmt(d.materialFlow.receivedKg || 0)} kg
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Qty available</span>
                      <span className="font-semibold tabular-nums text-emerald-600">
                        {fmt(
                          d.materialFlow.availableKg != null
                            ? d.materialFlow.availableKg
                            : d.inventory.rawKg || 0,
                        )}{' '}
                        kg
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Production */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKpiModal('production')}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveKpiModal('production')}
                  className="cursor-pointer rounded-xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-2.5 sm:p-3 shadow-xs transition-all hover:border-indigo-500 hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 group select-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors truncate">
                      Production
                    </span>
                    <div className="flex size-5 sm:size-6 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 shrink-0">
                      <Factory className="size-3 sm:size-3.5" />
                    </div>
                  </div>
                  <p className="mt-1 text-base sm:text-xl font-bold tracking-tight text-foreground tabular-nums truncate">
                    {fmt(d.production.unitsProduced, 0)}{' '}
                    <span className="text-[10px] font-normal text-muted-foreground">units</span>
                  </p>
                  <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>Good</span>
                      <span className="font-semibold tabular-nums text-emerald-600">
                        {fmt(d.production.unitsGood, 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Reject</span>
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          d.production.rejectPercent > 5 ? 'text-red-600' : 'text-foreground',
                        )}
                      >
                        {d.production.rejectPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Finished Goods */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKpiModal('finished_goods')}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveKpiModal('finished_goods')}
                  className="cursor-pointer rounded-xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-2.5 sm:p-3 shadow-xs transition-all hover:border-teal-500 hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 group select-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors truncate">
                      Finished Goods
                    </span>
                    <div className="flex size-5 sm:size-6 items-center justify-center rounded-md bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400 shrink-0">
                      <PackageCheck className="size-3 sm:size-3.5" />
                    </div>
                  </div>
                  <p className="mt-1 text-base sm:text-xl font-bold tracking-tight text-foreground tabular-nums truncate">
                    {fmt(d.inventory.fgUnits, 0)}{' '}
                    <span className="text-[10px] font-normal text-muted-foreground">in stock</span>
                  </p>
                  <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>Pass rate</span>
                      <span className="font-semibold tabular-nums text-teal-600">
                        {d.quality.passRatePercent != null ? `${d.quality.passRatePercent}%` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Low stock</span>
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          d.inventory.lowStockCount > 0 ? 'text-amber-600' : 'text-foreground',
                        )}
                      >
                        {d.inventory.lowStockCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Sales */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKpiModal('sales')}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveKpiModal('sales')}
                  className="cursor-pointer rounded-xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-2.5 sm:p-3 shadow-xs transition-all hover:border-amber-500 hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 group select-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors truncate">
                      Sales
                    </span>
                    <div className="flex size-5 sm:size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
                      <DollarSign className="size-3 sm:size-3.5" />
                    </div>
                  </div>
                  <p className="mt-1 text-base sm:text-xl font-bold tracking-tight text-foreground tabular-nums truncate">
                    ₦{fmt(d.sales.revenue, 0)}
                  </p>
                  <div className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>Orders</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {d.sales.saleCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Receivables</span>
                      <span className="font-semibold tabular-nums text-amber-600">
                        ₦{fmt(d.money.receivables)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Machine performance under KPI cards */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/60 pt-4 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    Machine Performance
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    OEE, output, reject rate, and downtime for {d.periodLabel}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                  <Link to="/machines">All machines →</Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Avg OEE</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-indigo-600">
                    {d.production.avgOeePercent != null ? `${d.production.avgOeePercent}%` : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Output / hr</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                    {d.production.outputPerHour != null ? fmt(d.production.outputPerHour, 0) : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Downtime</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-600">
                    {fmt(d.production.downtimeMinutes || 0, 0)}{' '}
                    <span className="text-xs font-normal text-muted-foreground">min</span>
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reject</p>
                  <p
                    className={cn(
                      'mt-0.5 text-lg font-bold tabular-nums',
                      d.production.rejectPercent > 5 ? 'text-red-600' : 'text-foreground',
                    )}
                  >
                    {d.production.rejectPercent}%
                  </p>
                </div>
              </div>

              {d.machines && d.machines.length > 0 ? (
                <Card className="!overflow-hidden !p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Machine</th>
                          <th className="py-2.5 px-3 text-right">Produced</th>
                          <th className="py-2.5 px-3 text-right">Good</th>
                          <th className="py-2.5 px-3 text-right">Reject %</th>
                          <th className="py-2.5 px-3 text-right">Downtime</th>
                          <th className="py-2.5 px-3 text-right">OEE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {d.machines.map((m) => (
                          <tr key={m.machineId} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                            <td className="py-2.5 px-3 font-semibold text-foreground">
                              <div>{m.machineName}</div>
                              {(m.lastProduct || m.lastOperator) && (
                                <div className="text-[10px] font-normal text-muted-foreground mt-0.5">
                                  {[m.lastProduct, m.lastOperator].filter(Boolean).join(' · ')}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(m.produced, 0)}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-600">
                              {fmt(m.good, 0)}
                            </td>
                            <td
                              className={cn(
                                'py-2.5 px-3 text-right font-mono tabular-nums',
                                m.rejectPercent > 5 && 'text-red-600 font-semibold',
                              )}
                            >
                              {m.rejectPercent}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                              {fmt(m.downtimeMinutes || 0, 0)} min
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-indigo-600">
                              {m.oeePercent != null ? `${m.oeePercent}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <Card className="p-4 text-xs text-muted-foreground">
                  No machine runs recorded for this period.
                </Card>
              )}

              {d.operatorShift && d.operatorShift.length > 0 && (
                <Card className="!overflow-hidden !p-0">
                  <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                    <h3 className="text-xs font-semibold text-foreground">Operator / shift output</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2 px-3">Operator</th>
                          <th className="py-2 px-3">Shift</th>
                          <th className="py-2 px-3 text-right">Units</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {d.operatorShift.map((o, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-medium">{o.operatorName}</td>
                            <td className="py-2 px-3 text-muted-foreground">{o.shiftName || '—'}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">
                              {fmt(o.unitsProduced, 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>

            {/* Financial truth & margins */}
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

          </>
        )}

        {/* Full Details Modal for the 4 Top KPI Cards */}
        <Dialog open={!!activeKpiModal} onOpenChange={(open) => !open && setActiveKpiModal(null)}>
          <DialogContent className="max-w-5xl w-[min(96vw,64rem)] max-h-[92vh] overflow-y-auto p-6 sm:p-8">
            {activeKpiModal === 'raw_material' && d && (
              <div className="space-y-6">
                <DialogHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      <Recycle className="size-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                        Raw Material
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        Quantity bought, waste, and qty still available for {d.periodLabel}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Quantity</span>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                      {fmt(d.materialFlow.receivedKg || 0)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">kg</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground">Initial quantity from scrap buying</span>
                  </div>
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty available</span>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {fmt(
                        d.materialFlow.availableKg != null
                          ? d.materialFlow.availableKg
                          : d.inventory.rawKg || 0,
                      )}{' '}
                      <span className="text-xs font-normal text-muted-foreground">kg</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground">Quantity minus waste</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Waste</span>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                      {fmt(d.materialFlow.wasteKg || 0)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">kg</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground">Lost in crushing, washing, drying</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sorted</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {fmt(d.materialFlow.sortedKg || 0)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">kg</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">WIP</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {fmt(d.inventory.wipKg || 0)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">kg</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60 col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dried ready</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {fmt(d.materialFlow.driedKg || 0)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">kg</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Recycling flow breakdown
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Stage</th>
                          <th className="py-2.5 px-3 text-right">Throughput</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {[
                          { stage: 'Inbound (scrap buy)', kg: d.materialFlow.receivedKg },
                          { stage: 'Waste', kg: d.materialFlow.wasteKg },
                          { stage: 'Qty available', kg: d.materialFlow.availableKg },
                          { stage: 'Sorting', kg: d.materialFlow.sortedKg },
                          { stage: 'Crushing', kg: d.materialFlow.crushedKg },
                          { stage: 'Washing', kg: d.materialFlow.washedKg },
                          { stage: 'Drying', kg: d.materialFlow.driedKg },
                        ].map((row) => (
                          <tr key={row.stage} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                            <td className="py-2.5 px-3 font-semibold text-foreground">{row.stage}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {fmt(row.kg || 0)} kg
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {d.production.byStage && d.production.byStage.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Stage yield (input → usable)
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Stage</th>
                            <th className="py-2.5 px-3 text-right">Input</th>
                            <th className="py-2.5 px-3 text-right">Usable</th>
                            <th className="py-2.5 px-3 text-right">Yield</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {d.production.byStage.map((s, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                              <td className="py-2.5 px-3 font-semibold text-foreground capitalize">{s.stage}</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(s.inputKg || 0)} kg</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(s.usableKg || 0)} kg</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-emerald-600">
                                {s.yieldPercent}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-muted-foreground">Quick actions:</span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/receiving" onClick={() => setActiveKpiModal(null)}>Scrap Buying →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/inventory" onClick={() => setActiveKpiModal(null)}>Inventory →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/batches" onClick={() => setActiveKpiModal(null)}>Batches →</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeKpiModal === 'production' && d && (
              <div className="space-y-6">
                <DialogHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                      <Factory className="size-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                        Production &amp; Machine Performance
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        Overall factory throughput, quality pass/reject distribution, and equipment uptime for {d.periodLabel}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Units Produced</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {fmt(d.production.unitsProduced, 0)}
                    </p>
                    <span className="text-[11px] text-muted-foreground">Total finished units</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Good Quality</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600">
                      {fmt(d.production.unitsGood, 0)}
                    </p>
                    <span className="text-[11px] text-emerald-600 font-medium">Passed inspection</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reject Rate</span>
                    <p className={cn("mt-1 text-xl font-bold tabular-nums", d.production.rejectPercent > 5 ? 'text-red-600' : 'text-foreground')}>
                      {d.production.rejectPercent}%
                    </p>
                    <span className="text-[11px] text-muted-foreground">{fmt(d.production.unitsReject, 0)} units scrap</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Downtime</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-amber-600">
                      {fmt(d.production.downtimeMinutes || 0)} <span className="text-xs font-normal text-muted-foreground">min</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground">Unscheduled stops</span>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <span className="text-xs text-muted-foreground">Overall Process Yield</span>
                      <p className="text-lg font-bold text-indigo-600 mt-0.5 tabular-nums">
                        {d.production.processYieldPercent}%
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Average Machine OEE</span>
                      <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">
                        {d.production.avgOeePercent != null ? `${d.production.avgOeePercent}%` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Output Throughput</span>
                      <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">
                        {d.production.outputPerHour != null ? `${d.production.outputPerHour}/hr` : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {d.production.byStage && d.production.byStage.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Stage conversion &amp; yield
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Stage</th>
                            <th className="py-2.5 px-3 text-right">Input Kg</th>
                            <th className="py-2.5 px-3 text-right">Usable Kg</th>
                            <th className="py-2.5 px-3 text-right">Yield %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {d.production.byStage.map((s, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                              <td className="py-2.5 px-3 font-semibold text-foreground capitalize">{s.stage}</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(s.inputKg || 0)} kg</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(s.usableKg || 0)} kg</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-indigo-600">
                                {s.yieldPercent}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {d.machines && d.machines.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Machine performance
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Machine</th>
                            <th className="py-2.5 px-3 text-right">Produced</th>
                            <th className="py-2.5 px-3 text-right">Good</th>
                            <th className="py-2.5 px-3 text-right">Reject %</th>
                            <th className="py-2.5 px-3 text-right">Downtime</th>
                            <th className="py-2.5 px-3 text-right">OEE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {d.machines.map((m) => (
                            <tr key={m.machineId} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                              <td className="py-2.5 px-3 font-semibold text-foreground">
                                <div>{m.machineName}</div>
                                {(m.lastProduct || m.lastOperator) && (
                                  <div className="text-[10px] font-normal text-muted-foreground mt-0.5">
                                    {[m.lastProduct, m.lastOperator].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(m.produced, 0)}</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-600">{fmt(m.good, 0)}</td>
                              <td className={cn('py-2.5 px-3 text-right font-mono tabular-nums', m.rejectPercent > 5 && 'text-red-600 font-semibold')}>
                                {m.rejectPercent}%
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                {fmt(m.downtimeMinutes || 0)} min
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-indigo-600">
                                {m.oeePercent != null ? `${m.oeePercent}%` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {d.operatorShift && d.operatorShift.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Operator / shift output
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Operator</th>
                            <th className="py-2.5 px-3">Shift</th>
                            <th className="py-2.5 px-3 text-right">Units</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {d.operatorShift.map((o, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                              <td className="py-2.5 px-3 font-semibold text-foreground">{o.operatorName}</td>
                              <td className="py-2.5 px-3 text-muted-foreground">{o.shiftName || '—'}</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(o.unitsProduced, 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-muted-foreground">Quick actions:</span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/production" onClick={() => setActiveKpiModal(null)}>Production Runs →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/machines" onClick={() => setActiveKpiModal(null)}>Machines &amp; OEE →</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeKpiModal === 'finished_goods' && d && (
              <div className="space-y-6">
                <DialogHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400">
                      <PackageCheck className="size-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                        Finished Goods &amp; Quality
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        Finished stock in store, inspection pass rates, and open QC holds for {d.periodLabel}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">FG In Stock</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-teal-600">
                      {fmt(d.inventory.fgUnits, 0)} <span className="text-xs font-normal text-muted-foreground">units</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground">Warehouse inventory</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">QC Pass Rate</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {d.quality.passRatePercent != null ? `${d.quality.passRatePercent}%` : '—'}
                    </p>
                    <span className="text-[11px] text-emerald-600 font-medium">Batch quality score</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Open Holds</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {d.quality.openHolds || 0}
                    </p>
                    <span className="text-[11px] text-muted-foreground">Pending inspection</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Low Stock SKUs</span>
                    <p className={cn("mt-1 text-xl font-bold tabular-nums", d.inventory.lowStockCount > 0 ? 'text-amber-600' : 'text-foreground')}>
                      {d.inventory.lowStockCount || 0}
                    </p>
                    <span className="text-[11px] text-muted-foreground">Below reorder point</span>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                      <span className="text-xs text-muted-foreground">QC checks</span>
                      <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">
                        {fmt(d.quality.checksInRange || 0, 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Good units</span>
                      <p className="text-lg font-bold text-emerald-600 mt-0.5 tabular-nums">
                        {fmt(d.production.unitsGood, 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Rejects</span>
                      <p className={cn('text-lg font-bold mt-0.5 tabular-nums', d.production.unitsReject > 0 ? 'text-red-600' : 'text-foreground')}>
                        {fmt(d.production.unitsReject, 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">WIP stock</span>
                      <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">
                        {fmt(d.inventory.wipKg || 0)} kg
                      </p>
                    </div>
                  </div>
                </div>

                {d.priceVsCost && d.priceVsCost.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Unit margins by finished product
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-3 text-right">Margin / unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {d.priceVsCost.map((p, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                              <td className="py-2.5 px-3 font-semibold text-foreground">{p.productName}</td>
                              <td className={cn(
                                'py-2.5 px-3 text-right font-mono font-bold tabular-nums',
                                p.marginPerUnit != null && p.marginPerUnit < 0 ? 'text-red-600' : 'text-emerald-600',
                              )}>
                                {p.marginPerUnit != null ? `₦${fmt(p.marginPerUnit, 2)}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {d.costTruth?.marginRestatement && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Margin restatement
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <span className="text-[11px] text-muted-foreground">Recorded</span>
                        <p className="text-base font-bold tabular-nums text-foreground">
                          {d.costTruth.marginRestatement.recordedMarginPercent}%
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">Restated</span>
                        <p className="text-base font-bold tabular-nums text-teal-600">
                          {d.costTruth.marginRestatement.restatedMarginPercent}%
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground">Restated ₦</span>
                        <p className="text-base font-bold tabular-nums text-foreground">
                          ₦{fmt(d.costTruth.marginRestatement.restatedMargin)}
                        </p>
                      </div>
                    </div>
                    {!d.costTruth.overheadAllocated && (
                      <p className="text-[11px] text-amber-600">Overhead not fully allocated in this period.</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-muted-foreground">Quick actions:</span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/production-store?tab=finished_goods" onClick={() => setActiveKpiModal(null)}>FG Store →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/qc" onClick={() => setActiveKpiModal(null)}>Quality Control →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/inventory" onClick={() => setActiveKpiModal(null)}>Inventory →</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeKpiModal === 'sales' && d && (
              <div className="space-y-6">
                <DialogHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      <DollarSign className="size-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                        Sales &amp; Financial Commercials
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        Revenue, cash, spend, and receivables for {d.periodLabel}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Gross Revenue</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      ₦{fmt(d.sales.revenue, 0)}
                    </p>
                    <span className="text-[11px] text-emerald-600 font-medium">Billed sales volume</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sales Orders</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {d.sales.saleCount || 0}
                    </p>
                    <span className="text-[11px] text-muted-foreground">Orders registered</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Receivables Due</span>
                    <p className="mt-1 text-xl font-bold tabular-nums text-amber-600">
                      ₦{fmt(d.money.receivables || 0)}
                    </p>
                    <span className="text-[11px] text-muted-foreground">Customer balances</span>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Net Cash Flow</span>
                    <p className={cn("mt-1 text-xl font-bold tabular-nums", d.money.netCash >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      ₦{fmt(d.money.netCash || 0)}
                    </p>
                    <span className="text-[11px] text-muted-foreground">In − out</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Cash &amp; spend breakdown
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <span className="text-xs text-muted-foreground">Cash in</span>
                      <p className="text-base font-bold text-emerald-600 tabular-nums mt-0.5">
                        ₦{fmt(d.money.cashIn || 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <span className="text-xs text-muted-foreground">Cash out</span>
                      <p className="text-base font-bold text-red-600 tabular-nums mt-0.5">
                        ₦{fmt(d.money.cashOut || 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <span className="text-xs text-muted-foreground">Approved expenses</span>
                      <p className="text-base font-bold text-foreground tabular-nums mt-0.5">
                        ₦{fmt(d.spend.approvedExpenses || 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <span className="text-xs text-muted-foreground">Wages outstanding</span>
                      <p className="text-base font-bold text-amber-600 tabular-nums mt-0.5">
                        ₦{fmt(d.spend.wagesOutstanding || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {d.receivables && d.receivables.rows && d.receivables.rows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Customer receivables ({d.receivables.rows.length})
                      </h4>
                      <Link
                        to="/distributors"
                        onClick={() => setActiveKpiModal(null)}
                        className="text-xs font-semibold text-teal-600 hover:underline"
                      >
                        All accounts →
                      </Link>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 max-h-64">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold sticky top-0">
                          <tr>
                            <th className="py-2.5 px-3">Customer</th>
                            <th className="py-2.5 px-3">Sale #</th>
                            <th className="py-2.5 px-3 text-right">Balance Due</th>
                            <th className="py-2.5 px-3 text-right">Age</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {d.receivables.rows.map((r, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                              <td className="py-2.5 px-3 font-semibold text-foreground">{r.customerName || 'Walk-in'}</td>
                              <td className="py-2.5 px-3 font-mono text-muted-foreground">{r.saleNumber}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-amber-600">
                                ₦{fmt(r.balanceDue)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                {r.ageDays}d
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {d.trend && d.trend.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Revenue trend
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Period</th>
                            <th className="py-2.5 px-3 text-right">Revenue</th>
                            <th className="py-2.5 px-3 text-right">Units produced</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {d.trend.map((t, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                              <td className="py-2.5 px-3 font-semibold text-foreground">{t.shortLabel}</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">₦{fmt(t.revenue)}</td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmt(t.unitsProduced, 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-muted-foreground">Quick actions:</span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/sales" onClick={() => setActiveKpiModal(null)}>Sales Orders →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/distributors" onClick={() => setActiveKpiModal(null)}>Distributor Ledgers →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" asChild>
                      <Link to="/expenses" onClick={() => setActiveKpiModal(null)}>Cash &amp; Expenses →</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
