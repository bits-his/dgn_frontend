import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Bell,
  RefreshCw,
  X,
  Banknote,
  Factory,
  Recycle,
  PackageCheck,
  Store,
  ChevronDown,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '@/lib/api'
import { Card } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { DateRangePreset } from '@/components/DateRangePreset'
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
import { OutletDashboard } from '@/components/dashboard/OutletDashboard'
import { isOutletScoped } from '@/lib/outlet'
import { dateRangeApiParams, type DateRangeState } from '@/lib/dateRange'
import { formatBusinessDate, formatDate } from '@/lib/dates'
import { fmtDozenPcs } from '@/lib/units'

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

type OperatorRow = {
  rank: number
  operatorId: number | null
  operatorName: string
  good: number
  reject: number
  produced: number
  rejectPercent: number
  qualityPercent: number
  availabilityPercent: number | null
  downtimeMinutes: number
  runtimeMinutes: number
  kgUsable: number
  shifts: number
  score: number
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
    unitsProducedDozen?: number
    unitsProducedPcs?: number
    unitsGoodDozen?: number
    unitsGoodPcs?: number
  }
  sales: {
    saleCount: number
    revenue: number
    factorySaleCount?: number
    shopSaleCount?: number
    factoryRevenue?: number
    shopRevenue?: number
    shopCollected?: number
    shopOutstanding?: number
  }
  spend: { approvedExpenses: number; wagesOutstanding: number }
  money: {
    cashIn: number
    cashOut: number
    netCash: number
    receivables: number
    payables?: number
  }
  customerBalances?: {
    totalReceivable: number
    totalPayable: number
    count: number
    rows: {
      customerId: number
      customerName: string
      customerCode: string | null
      customerType: string | null
      receivable: number
      payable: number
      net: number
    }[]
  }
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
    boughtRawKg?: number
    boughtCrushedKg?: number
    boughtRecycledKg?: number
    boughtRawCost?: number
    boughtCrushedCost?: number
    boughtRecycledCost?: number
    boughtCost?: number
    availableKg?: number
    availableRawScrapKg?: number
    availableCrushedKg?: number
    availableWashedKg?: number
    availableStoreReadyKg?: number
    availableRecycledKg?: number
    availableOtherKg?: number
    availableRawScrapValue?: number
    availableCrushedValue?: number
    availableWashedValue?: number
    availableStoreReadyValue?: number
    availableRecycledValue?: number
    availableOtherValue?: number
    availableMaterialValue?: number
    availableMaterialKg?: number
    wasteKg?: number
    secondGradeKg?: number
    damagedRecrushKg?: number
    wipKg: number
    fgUnits: number
    fgDozen?: number
    fgPcs?: number
    fgValue?: number
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
  operators?: OperatorRow[]
  materialFlow: {
    receivedKg: number
    boughtRawKg?: number
    boughtCrushedKg?: number
    boughtRecycledKg?: number
    boughtRawCost?: number
    boughtCrushedCost?: number
    boughtRecycledCost?: number
    boughtCost?: number
    wasteKg?: number
    secondGradeKg?: number
    availableKg?: number
    availableRawScrapKg?: number
    availableCrushedKg?: number
    availableWashedKg?: number
    availableStoreReadyKg?: number
    availableRecycledKg?: number
    availableOtherKg?: number
    availableRawScrapValue?: number
    availableCrushedValue?: number
    availableWashedValue?: number
    availableStoreReadyValue?: number
    availableRecycledValue?: number
    availableOtherValue?: number
    availableMaterialValue?: number
    availableMaterialKg?: number
    sortedKg?: number | null
    crushedKg?: number | null
    washedKg?: number | null
    driedKg?: number | null
    damagedRecrushKg?: number
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
  scrapPurchases?: Array<{
    id: number
    batchId: number
    batchNumber: string | null
    supplierName: string
    inboundForm: string
    kg: number
    availableKg?: number
    wasteKg?: number
    secondGradeKg?: number
    remainingKg?: number
    crushedKg?: number
    washedKg?: number
    driedKg?: number
    cost: number
    businessDate?: string | null
    receivedAt: string
  }>
  productionOutput?: Array<{
    id: number
    batchId: number
    batchNumber: string | null
    productId: number
    productName: string
    qtyGood: number
    qtyProduced: number
    unitsPerDozen: number
    dozen: number
    pcs: number
  }>
  productionByProduct?: Array<{
    productId: number | null
    productName: string
    qtyGood: number
    qtyProduced: number
    dozen: number
    pcs: number
  }>
  finishedGoodsStock?: Array<{
    productId: number
    productName: string
    productCode?: string
    qtyOnHand: number
    sellingPrice: number
    stockValue: number
    dozen: number
    pcs: number
  }>
  finishedGoodsValue?: number
  factoryShops?: {
    shopCount: number
    transferredQty: number
    transferredValue: number
    remainingQty: number
    remainingValue: number
    soldAtShopQty: number
    shopRetailGenerated: number
    shopRetailCollected: number
    shopRetailOutstanding: number
    transferCount: number
    note?: string
    shops: Array<{
      customerId: number
      customerName: string
      customerCode: string | null
      receivedQty: number
      soldQty: number
      remainingQty: number
      remainingValue: number
      transferredValue: number
      transferCount: number
      retailGenerated: number
      retailCollected: number
      retailOutstanding: number
      retailSaleCount: number
      stock: Array<{
        productId: number
        productName: string
        uom: string
        received: number
        sold: number
        remaining: number
        remainingValue: number
      }>
    }>
    transfers: Array<{
      id: number
      saleNumber: string
      saleType: string
      notASale?: boolean
      businessDate: string | null
      customerId: number
      customerName: string
      customerCode: string | null
      qty: number
      stockValue: number
      lineCount: number
      issuedBy: string | null
      lines?: Array<{
        productId: number
        productName: string | null
        qty: number
        uom: string
        unitPrice: number
        lineValue: number
      }>
    }>
    stock: Array<{
      productId: number
      productName: string
      uom: string
      received: number
      sold: number
      remaining: number
      remainingValue: number
    }>
  }
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

const CHART = {
  teal: '#0f766e',
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

  const [rangeState, setRangeState] = useState<DateRangeState>({ rangePreset: 'this_month' })
  const apiParams = dateRangeApiParams(rangeState)
  const compare = false
  const [viewMode, setViewMode] = useState<'executive' | 'staff'>('executive')
  const [drillKpi, setDrillKpi] = useState<string | null>(null)
  const [activeKpiModal, setActiveKpiModal] = useState<
    'raw_material' | 'production' | 'finished_goods' | 'sales' | 'shops' | null
  >(null)
  const [expandedShopTransferId, setExpandedShopTransferId] = useState<number | null>(null)

  const dash = useQuery({
    queryKey: ['executive-dashboard', apiParams, compare],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/executive', {
        params: { ...apiParams, compare: compare ? '1' : undefined },
      })
      return data.data as Dashboard
    },
    enabled: canExec,
    refetchInterval: 60_000,
  })

  const drill = useQuery({
    queryKey: ['dashboard-drill', drillKpi, apiParams],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/drill', {
        params: { kpi: drillKpi, ...apiParams },
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

  const roleInfo = user?.roleCode ? (
    {
      OPERATOR: 'Machine Operator',
      PROD_SUPERVISOR: 'Production Supervisor',
      STOREKEEPER: 'Storekeeper',
      INVENTORY_OFFICER: 'Inventory Officer',
      QC_OFFICER: 'Quality Control Officer',
      SALES_OFFICER: 'Sales Officer',
      OUTLET_SELLER: 'Shop / distributor seller',
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

  // Shop / internal distributor staff see their outlet book, not the factory workspace
  if (isOutletScoped(user)) {
    return <OutletDashboard />
  }

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
     
          <DateRangePreset
            value={rangeState}
            onChange={setRangeState}
            triggerClassName="w-28 sm:w-36 shrink-0"
          />

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
                  'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 shadow-2xs sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3',
                  critical > 0
                    ? 'border-red-200 bg-red-50/70 text-red-900'
                    : 'border-amber-200 bg-amber-50/60 text-amber-900',
                )}
              >
                <span
                  className={cn(
                    'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-xs sm:tracking-wider',
                    critical > 0 ? 'bg-red-600' : 'bg-amber-600',
                  )}
                >
                  {critical > 0 ? `${critical} Critical` : `${d.alerts.total} Alerts`}
                </span>
                <div className="min-w-0 flex-1 text-[11px] sm:text-sm">
                  <Link
                    to={d.alerts.top[0]?.linkPath || '/alerts'}
                    className="block truncate font-medium hover:underline hover:text-[var(--accent-strong)] sm:hidden"
                  >
                    {d.alerts.top[0]?.title}
                  </Link>
                  <div className="hidden min-w-0 flex-wrap gap-x-4 gap-y-1 sm:flex">
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
                </div>
                <Button size="sm" variant="ghost" className="h-6 shrink-0 px-1.5 text-[11px] font-semibold sm:h-7 sm:px-3 sm:text-xs" asChild>
                  <Link to="/alerts">
                    <span className="sm:hidden">All</span>
                    <span className="hidden sm:inline">View all ({d.alerts.total}) →</span>
                  </Link>
                </Button>
              </div>
            )}

            {/* 1. OPERATIONAL KPIS (AT THE TOP) */}
            <div className="space-y-4">
             

              {/* Operational KPI scorecards */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {/* Card 1: Raw Material — compact table */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKpiModal('raw_material')}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveKpiModal('raw_material')}
                  className="cursor-pointer rounded-xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-3 shadow-xs transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 group select-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      Raw Material
                    </span>
                    <div className="flex size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
                      <Recycle className="size-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-base font-bold tabular-nums text-foreground">
                      {fmt(
                        d.materialFlow.availableMaterialKg ??
                          d.inventory.availableMaterialKg ??
                          d.inventory.rawKg ??
                          0,
                      )}{' '}
                      kg
                    </span>
                    <span className="text-base font-bold tabular-nums text-foreground text-right">
                      {money(
                        d.materialFlow.availableMaterialValue ??
                          d.inventory.availableMaterialValue ??
                          0,
                      )}
                    </span>
                  </div>
                  {(() => {
                    const washedKg =
                      (d.materialFlow.availableWashedKg ??
                        d.inventory.availableWashedKg ??
                        0) +
                      (d.materialFlow.availableStoreReadyKg ??
                        d.inventory.availableStoreReadyKg ??
                        0)
                    const washedValue =
                      (d.materialFlow.availableWashedValue ??
                        d.inventory.availableWashedValue ??
                        0) +
                      (d.materialFlow.availableStoreReadyValue ??
                        d.inventory.availableStoreReadyValue ??
                        0)
                    type Tone = 'default' | 'avail' | 'waste' | 'second'
                    const rows: {
                      label: string
                      kg: number
                      value?: number
                      tone: Tone
                      divider?: boolean
                    }[] = [
                      {
                        label: 'Raw scrap bought',
                        kg: d.materialFlow.boughtRawKg ?? d.inventory.boughtRawKg ?? 0,
                        value: d.materialFlow.boughtRawCost ?? d.inventory.boughtRawCost ?? 0,
                        tone: 'default',
                      },
                      {
                        label: 'Scrap available',
                        kg:
                          d.materialFlow.availableRawScrapKg ??
                          d.inventory.availableRawScrapKg ??
                          0,
                        value:
                          d.materialFlow.availableRawScrapValue ??
                          d.inventory.availableRawScrapValue ??
                          0,
                        tone: 'avail',
                      },
                      {
                        label: 'Crushed bought',
                        kg:
                          d.materialFlow.boughtCrushedKg ?? d.inventory.boughtCrushedKg ?? 0,
                        value:
                          d.materialFlow.boughtCrushedCost ??
                          d.inventory.boughtCrushedCost ??
                          0,
                        tone: 'default',
                      },
                      {
                        label: 'Crushed available',
                        kg:
                          d.materialFlow.availableCrushedKg ??
                          d.inventory.availableCrushedKg ??
                          0,
                        value:
                          d.materialFlow.availableCrushedValue ??
                          d.inventory.availableCrushedValue ??
                          0,
                        tone: 'avail',
                      },
                      {
                        label: 'Recycled bought',
                        kg:
                          d.materialFlow.boughtRecycledKg ??
                          d.inventory.boughtRecycledKg ??
                          0,
                        value:
                          d.materialFlow.boughtRecycledCost ??
                          d.inventory.boughtRecycledCost ??
                          0,
                        tone: 'default',
                      },
                      {
                        label: 'Recycled available',
                        kg:
                          d.materialFlow.availableRecycledKg ??
                          d.inventory.availableRecycledKg ??
                          0,
                        value:
                          d.materialFlow.availableRecycledValue ??
                          d.inventory.availableRecycledValue ??
                          0,
                        tone: 'avail',
                      },
                      {
                        label: 'Washed / store',
                        kg: washedKg,
                        value: washedValue,
                        tone: 'default',
                        divider: true,
                      },
                      {
                        label: 'Waste',
                        kg: d.materialFlow.wasteKg || 0,
                        tone: 'waste',
                      },
                      {
                        label: '2nd grade',
                        kg: d.materialFlow.secondGradeKg || d.inventory.secondGradeKg || 0,
                        tone: 'second',
                      },
                    ]
                    const toneClass = (tone: Tone) =>
                      tone === 'avail'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : tone === 'waste'
                          ? 'text-rose-600'
                          : tone === 'second'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-zinc-800 dark:text-zinc-200'
                    const cellBorder =
                      'border border-zinc-200 px-1.5 py-1 dark:border-zinc-700'
                    return (
                      <table className="mt-2 w-full border-collapse overflow-hidden rounded-md border border-zinc-200 text-[11px] leading-tight dark:border-zinc-700">
                        <thead>
                          <tr className="bg-zinc-50 text-[9px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80">
                            <th className={cn(cellBorder, 'text-left font-semibold')}>Type</th>
                            <th className={cn(cellBorder, 'text-right font-semibold')}>kg</th>
                            <th className={cn(cellBorder, 'text-right font-semibold')}>₦</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr
                              key={row.label}
                              className={cn(row.divider && 'bg-zinc-50/70 dark:bg-zinc-900/40')}
                            >
                              <td
                                className={cn(
                                  cellBorder,
                                  'max-w-[7.5rem] truncate text-zinc-500',
                                )}
                              >
                                {row.label}
                              </td>
                              <td
                                className={cn(
                                  cellBorder,
                                  'whitespace-nowrap text-right tabular-nums font-semibold',
                                  toneClass(row.tone),
                                )}
                              >
                                {fmt(row.kg)}
                              </td>
                              <td
                                className={cn(
                                  cellBorder,
                                  'whitespace-nowrap text-right tabular-nums font-bold',
                                  toneClass(row.tone),
                                )}
                              >
                                {row.value != null ? money(row.value) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  })()}
                </div>

                {/* Card 2: Production — output in selected range */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKpiModal('production')}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveKpiModal('production')}
                  className="cursor-pointer rounded-xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-3 shadow-xs transition-all hover:border-indigo-500 hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 group select-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                      Total production
                    </span>
                    <div className="flex size-6 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 shrink-0">
                      <Factory className="size-3.5" />
                    </div>
                  </div>
                  <p className="mt-1.5 text-base font-bold tabular-nums text-foreground">
                    {fmtDozenPcs(d.production.unitsProduced ?? d.production.unitsGood)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {d.range.label}
                    {d.production.unitsReject > 0
                      ? ` · good ${fmtDozenPcs(d.production.unitsGood)}`
                      : ''}
                  </p>
                  {(d.productionByProduct || []).length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No production in this period</p>
                  ) : (
                    <table className="mt-2 w-full border-collapse overflow-hidden rounded-md border border-zinc-200 text-[11px] leading-tight dark:border-zinc-700">
                      <thead>
                        <tr className="bg-zinc-50 text-[9px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80">
                          <th className="border border-zinc-200 px-1.5 py-1 text-left font-semibold dark:border-zinc-700">
                            Product
                          </th>
                          <th className="border border-zinc-200 px-1.5 py-1 text-right font-semibold dark:border-zinc-700">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(d.productionByProduct || []).slice(0, 6).map((row) => (
                          <tr key={row.productId ?? row.productName}>
                            <td className="max-w-[8rem] truncate border border-zinc-200 px-1.5 py-1 text-zinc-500 dark:border-zinc-700">
                              {row.productName}
                            </td>
                            <td className="whitespace-nowrap border border-zinc-200 px-1.5 py-1 text-right tabular-nums font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                              {fmtDozenPcs(row.qtyProduced ?? row.qtyGood)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {(d.productionByProduct || []).length > 6 ? (
                        <tfoot>
                          <tr>
                            <td
                              colSpan={2}
                              className="border border-zinc-200 px-1.5 py-1 text-[10px] font-medium text-indigo-600 dark:border-zinc-700"
                            >
                              +{(d.productionByProduct || []).length - 6} more
                            </td>
                          </tr>
                        </tfoot>
                      ) : null}
                    </table>
                  )}
                </div>

                {/* Card 3: Finished Goods — compact table */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKpiModal('finished_goods')}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveKpiModal('finished_goods')}
                  className="cursor-pointer rounded-xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-3 shadow-xs transition-all hover:border-teal-500 hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 group select-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                      Factory store
                    </span>
                    <div className="flex size-6 items-center justify-center rounded-md bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400 shrink-0">
                      <PackageCheck className="size-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-base font-bold tabular-nums text-foreground">
                      {fmtDozenPcs(d.inventory.fgUnits)}
                    </span>
                    <span className="text-base font-bold tabular-nums text-foreground text-right">
                      {money(d.inventory.fgValue ?? d.finishedGoodsValue ?? 0)}
                    </span>
                  </div>
                  {(d.finishedGoodsStock || []).length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No product stock on hand</p>
                  ) : (
                    <table className="mt-2 w-full border-collapse overflow-hidden rounded-md border border-zinc-200 text-[11px] leading-tight dark:border-zinc-700">
                      <thead>
                        <tr className="bg-zinc-50 text-[9px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80">
                          <th className="border border-zinc-200 px-1.5 py-1 text-left font-semibold dark:border-zinc-700">
                            Product
                          </th>
                          <th className="border border-zinc-200 px-1.5 py-1 text-right font-semibold dark:border-zinc-700">
                            Qty
                          </th>
                          <th className="border border-zinc-200 px-1.5 py-1 text-right font-semibold dark:border-zinc-700">
                            ₦
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(d.finishedGoodsStock || []).slice(0, 8).map((row) => (
                          <tr key={row.productId}>
                            <td className="max-w-[7.5rem] truncate border border-zinc-200 px-1.5 py-1 text-zinc-500 dark:border-zinc-700">
                              {row.productName}
                            </td>
                            <td className="whitespace-nowrap border border-zinc-200 px-1.5 py-1 text-right tabular-nums font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                              {fmtDozenPcs(row.qtyOnHand)}
                            </td>
                            <td className="whitespace-nowrap border border-zinc-200 px-1.5 py-1 text-right tabular-nums font-bold text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                              {money(row.stockValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {(d.finishedGoodsStock || []).length > 8 ? (
                        <tfoot>
                          <tr>
                            <td
                              colSpan={3}
                              className="border border-zinc-200 px-1.5 py-1 text-[10px] font-medium text-teal-600 dark:border-zinc-700"
                            >
                              +{(d.finishedGoodsStock || []).length - 8} more
                            </td>
                          </tr>
                        </tfoot>
                      ) : null}
                    </table>
                  )}
                </div>

                {/* Card 4: Market shops */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKpiModal('shops')}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveKpiModal('shops')}
                  className="cursor-pointer rounded-xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-3 shadow-xs transition-all hover:border-violet-500 hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 group select-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors truncate">
                      Market shops
                    </span>
                    <div className="flex size-6 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400 shrink-0">
                      <Store className="size-3.5" />
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-base sm:text-lg font-bold tracking-tight text-foreground tabular-nums truncate">
                      {fmtDozenPcs(d.factoryShops?.remainingQty ?? 0)}
                    </span>
                    <span className="text-base sm:text-lg font-bold tracking-tight text-foreground tabular-nums text-right truncate">
                      {money(d.factoryShops?.remainingValue ?? 0)}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>Sold</span>
                      <span className="text-[13px] font-semibold tabular-nums text-foreground">
                        {fmtDozenPcs(d.factoryShops?.soldAtShopQty ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Sales</span>
                      <span className="text-[13px] font-semibold tabular-nums text-foreground">
                        ₦{fmt(d.sales.shopRevenue ?? d.factoryShops?.shopRetailGenerated ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 5: Sales — under market shops */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKpiModal('sales')}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveKpiModal('sales')}
                  className="cursor-pointer rounded-xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/60 p-3 shadow-xs transition-all hover:border-amber-500 hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950 group select-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors truncate">
                      Sales
                    </span>
                    <div className="flex size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
                      <Banknote className="size-3.5" />
                    </div>
                  </div>
                  <p className="mt-1.5 text-base sm:text-lg font-bold tracking-tight text-foreground tabular-nums truncate">
                    ₦
                    {fmt(
                      (d.sales.factoryRevenue ?? d.sales.revenue ?? 0) +
                        (d.sales.shopRevenue ?? 0),
                      0,
                    )}
                  </p>
                  <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>Factory sales</span>
                      <span className="text-[13px] font-semibold tabular-nums text-foreground">
                        ₦{fmt(d.sales.factoryRevenue ?? d.sales.revenue, 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Shop sales</span>
                      <span className="text-[13px] font-semibold tabular-nums text-foreground">
                        ₦{fmt(d.sales.shopRevenue ?? 0, 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Receivables</span>
                      <span className="text-[13px] font-semibold tabular-nums text-amber-600">
                        ₦{fmt(d.money.receivables)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Payables</span>
                      <span className="text-[13px] font-semibold tabular-nums text-sky-600">
                        ₦{fmt(d.money.payables ?? d.customerBalances?.totalPayable ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customers board — receivable vs advance payable */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/60 pt-4 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    Customers
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Netted position — they owe, or we hold their advance
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                  <Link to="/distributors">All customers →</Link>
                </Button>
              </div>

              {(() => {
                const board = (d.customerBalances?.rows || []).slice(0, 8)
                if (!board.length) {
                  return (
                    <Card className="p-4 text-xs text-muted-foreground">
                      No open receivables or customer advances.
                    </Card>
                  )
                }
                return (
                  <Card className="!p-3 sm:!p-4">
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 px-2.5 py-2 dark:border-amber-900/40 dark:bg-amber-950/30">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-400/80">
                          Receivables
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                          {money(d.customerBalances?.totalReceivable ?? d.money.receivables)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-sky-200/70 bg-sky-50/50 px-2.5 py-2 dark:border-sky-900/40 dark:bg-sky-950/30">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700/80 dark:text-sky-400/80">
                          Payables
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-sky-700 dark:text-sky-400">
                          {money(d.customerBalances?.totalPayable ?? d.money.payables ?? 0)}
                        </p>
                      </div>
                    </div>
                    <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {board.map((c, idx) => {
                        const recv = Number(c.receivable || 0)
                        const pay = Number(c.payable || 0)
                        const href = c.customerCode
                          ? `/distributors/${c.customerCode}`
                          : '/distributors'
                        return (
                          <li key={c.customerId}>
                            <Link
                              to={href}
                              className="group flex items-center gap-2.5 px-1 py-2.5 transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
                            >
                              <span className="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-zinc-400">
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground group-hover:text-emerald-700">
                                  {c.customerName}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {recv > 0.001 ? (
                                    <span className="text-amber-700 dark:text-amber-400">
                                      Receivable {money(recv)}
                                    </span>
                                  ) : pay > 0.001 ? (
                                    <span className="text-sky-700 dark:text-sky-400">
                                      Advance held {money(pay)}
                                    </span>
                                  ) : (
                                    <span>Settled</span>
                                  )}
                                </p>
                              </div>
                              <p
                                className={cn(
                                  'shrink-0 text-xs font-bold tabular-nums',
                                  c.net >= 0 ? 'text-amber-700' : 'text-sky-700',
                                )}
                              >
                                {c.net >= 0 ? '+' : '−'}
                                {money(Math.abs(c.net))}
                              </p>
                            </Link>
                          </li>
                        )
                      })}
                    </ol>
                  </Card>
                )
              })()}
            </div>

            {/* Operator Leaderboard under KPI cards */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/60 pt-4 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    Operator Leaderboard
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Top 5 ranked by good output, quality, and uptime · {d.range.label}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                  <Link to="/operators">All operators →</Link>
                </Button>
              </div>

              {(() => {
                const ranked = (d.operators || []).slice(0, 5)
                const leaderScore = ranked[0]?.score || 1
                if (!ranked.length) {
                  return (
                    <Card className="p-4 text-xs text-muted-foreground">
                      No operator output recorded for this period.
                    </Card>
                  )
                }
                return (
                  <Card className="!p-3 sm:!p-4">
                    <ol className="space-y-2.5">
                      {ranked.map((op, idx) => {
                        const width = Math.max(6, Math.round((Number(op.score || 0) / leaderScore) * 100))
                        const href = op.operatorId ? `/operators/${op.operatorId}` : '/operators'
                        return (
                          <li key={`${op.operatorId || op.operatorName}-${idx}`}>
                            <Link
                              to={href}
                              className="group block rounded-xl border border-zinc-100 bg-zinc-50/60 px-2.5 py-2 transition-colors hover:border-indigo-200 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-indigo-900"
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={cn(
                                    'flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black tabular-nums',
                                    idx === 0
                                      ? 'bg-amber-400 text-amber-950'
                                      : idx === 1
                                        ? 'bg-zinc-300 text-zinc-800'
                                        : idx === 2
                                          ? 'bg-orange-200 text-orange-900'
                                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300',
                                  )}
                                >
                                  {op.rank || idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <p className="truncate text-sm font-semibold text-foreground group-hover:text-indigo-700">
                                      {op.operatorName}
                                    </p>
                                    <p className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                                      {fmtDozenPcs(op.good)}
                                    </p>
                                  </div>
                                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800">
                                    <div
                                      className={cn(
                                        'h-full rounded-full',
                                        idx === 0 ? 'bg-amber-500' : 'bg-indigo-500',
                                      )}
                                      style={{ width: `${width}%` }}
                                    />
                                  </div>
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    {op.qualityPercent}% quality
                                    {op.rejectPercent > 0 ? ` · ${op.rejectPercent}% reject` : ''}
                                    {op.downtimeMinutes > 0
                                      ? ` · ${fmt(op.downtimeMinutes, 0)} min down`
                                      : ''}
                                    {op.kgUsable > 0 ? ` · ${fmt(op.kgUsable)} kg processed` : ''}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          </li>
                        )
                      })}
                    </ol>
                  </Card>
                )
              })()}
            </div>

            {/* Machine performance under KPI cards */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/60 pt-4 dark:border-zinc-800">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    Machine Performance
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Output and reject rate · {d.range.label}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
                  <Link to="/machines">All machines →</Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Output / hr</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                    {d.production.outputPerHour != null ? fmt(d.production.outputPerHour, 0) : '—'}
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
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">{fmtDozenPcs(m.produced)}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-600">
                              {fmtDozenPcs(m.good)}
                            </td>
                            <td
                              className={cn(
                                'py-2.5 px-3 text-right font-mono tabular-nums',
                                m.rejectPercent > 5 && 'text-red-600 font-semibold',
                              )}
                            >
                              {m.rejectPercent}%
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
                              {fmtDozenPcs(o.unitsProduced)}
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

              <div className="grid gap-4 lg:grid-cols-2">
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
          <DialogContent className="max-h-[94vh] w-[min(98vw,96rem)] !max-w-[96rem] overflow-y-auto p-4 sm:p-6 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:!max-w-none max-sm:rounded-none max-sm:pt-[max(1.25rem,env(safe-area-inset-top))] max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] [&_table_th]:px-2.5 [&_table_th]:py-1.5 [&_table_td]:px-2.5 [&_table_td]:py-1.5">
            {activeKpiModal === 'raw_material' && d && (
              <div className="space-y-4">
                <DialogHeader className="mb-0 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      <Recycle className="size-4" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                        Raw Material
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        {d.range.label}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="flex items-baseline justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      On hand
                    </span>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                      {fmt(
                        d.materialFlow.availableMaterialKg ??
                          d.inventory.availableMaterialKg ??
                          d.inventory.rawKg ??
                          0,
                      )}{' '}
                      kg
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Stock value
                    </span>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                      {money(
                        d.materialFlow.availableMaterialValue ??
                          d.inventory.availableMaterialValue ??
                          0,
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  {(
                    [
                      {
                        boughtLabel: 'Raw scrap bought',
                        availLabel: 'Scrap available',
                        bought:
                          d.materialFlow.boughtRawKg ?? d.inventory.boughtRawKg ?? 0,
                        boughtCost:
                          d.materialFlow.boughtRawCost ?? d.inventory.boughtRawCost ?? 0,
                        available:
                          d.materialFlow.availableRawScrapKg ??
                          d.inventory.availableRawScrapKg ??
                          0,
                        availableValue:
                          d.materialFlow.availableRawScrapValue ??
                          d.inventory.availableRawScrapValue ??
                          0,
                      },
                      {
                        boughtLabel: 'Crushed bought',
                        availLabel: 'Crushed available',
                        bought:
                          d.materialFlow.boughtCrushedKg ??
                          d.inventory.boughtCrushedKg ??
                          0,
                        boughtCost:
                          d.materialFlow.boughtCrushedCost ??
                          d.inventory.boughtCrushedCost ??
                          0,
                        available:
                          d.materialFlow.availableCrushedKg ??
                          d.inventory.availableCrushedKg ??
                          0,
                        availableValue:
                          d.materialFlow.availableCrushedValue ??
                          d.inventory.availableCrushedValue ??
                          0,
                      },
                      {
                        boughtLabel: 'Recycled bought',
                        availLabel: 'Recycled available',
                        bought:
                          d.materialFlow.boughtRecycledKg ??
                          d.inventory.boughtRecycledKg ??
                          0,
                        boughtCost:
                          d.materialFlow.boughtRecycledCost ??
                          d.inventory.boughtRecycledCost ??
                          0,
                        available:
                          d.materialFlow.availableRecycledKg ??
                          d.inventory.availableRecycledKg ??
                          0,
                        availableValue:
                          d.materialFlow.availableRecycledValue ??
                          d.inventory.availableRecycledValue ??
                          0,
                      },
                    ] as const
                  ).map((row) => (
                    <div key={row.boughtLabel} className="space-y-0.5 py-1 border-b border-zinc-100 dark:border-zinc-800 sm:border-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{row.boughtLabel}</span>
                        <span className="flex items-baseline gap-2 tabular-nums text-right">
                          <span className="font-semibold text-foreground">
                            {fmt(row.bought)} kg
                          </span>
                          <span className="font-bold text-foreground">
                            {money(row.boughtCost)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{row.availLabel}</span>
                        <span className="flex items-baseline gap-2 tabular-nums text-right">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {fmt(row.available)} kg
                          </span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {money(row.availableValue)}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                  {(
                    [
                      {
                        label: 'Washed available',
                        value:
                          d.materialFlow.availableWashedKg ??
                          d.inventory.availableWashedKg ??
                          0,
                        amount:
                          d.materialFlow.availableWashedValue ??
                          d.inventory.availableWashedValue ??
                          0,
                      },
                      {
                        label: 'Store-ready available',
                        value:
                          d.materialFlow.availableStoreReadyKg ??
                          d.inventory.availableStoreReadyKg ??
                          0,
                        amount:
                          d.materialFlow.availableStoreReadyValue ??
                          d.inventory.availableStoreReadyValue ??
                          0,
                      },
                      {
                        label: 'Waste',
                        value: d.materialFlow.wasteKg || 0,
                        tone: 'waste' as const,
                      },
                      {
                        label: 'Second grade',
                        value:
                          d.materialFlow.secondGradeKg || d.inventory.secondGradeKg || 0,
                        tone: 'second' as const,
                      },
                      {
                        label: 'Damaged re-crushed',
                        value:
                          d.materialFlow.damagedRecrushKg ||
                          d.inventory.damagedRecrushKg ||
                          0,
                        tone: 'damage' as const,
                      },
                    ] as const
                  ).map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3 py-1 border-b border-zinc-100 dark:border-zinc-800 sm:border-0"
                    >
                      <span className="text-muted-foreground">{row.label}</span>
                      <span
                        className={`flex items-baseline gap-2 tabular-nums text-right font-bold ${
                          'tone' in row && row.tone === 'waste'
                            ? 'text-rose-600'
                            : 'tone' in row && row.tone === 'second'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'tone' in row && row.tone === 'damage'
                                ? 'text-sky-700 dark:text-sky-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        <span>{fmt(row.value)} kg</span>
                        {'amount' in row ? <span>{money(row.amount)}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Buys · {d.range.label}
                  </h4>
                  {(d.scrapPurchases || []).length === 0 ? (
                    <p className="py-2 text-xs text-muted-foreground">
                      No scrap buys in this period.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                          <tr>
                            <th className="whitespace-nowrap py-2 pr-3">Buy</th>
                            <th className="py-2 px-3 whitespace-nowrap">Bought as</th>
                            <th className="py-2 px-3 text-right whitespace-nowrap">Bought</th>
                            <th className="py-2 px-3 text-right whitespace-nowrap">Amount</th>
                            <th className="py-2 px-3 text-right whitespace-nowrap">Available</th>
                            <th className="py-2 px-3 text-right whitespace-nowrap">Waste</th>
                            <th className="py-2 px-3 text-right whitespace-nowrap">2nd grade</th>
                            <th className="py-2 px-3 text-right whitespace-nowrap">Crushed</th>
                            <th className="py-2 pl-3 text-right whitespace-nowrap">Washed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {(d.scrapPurchases || []).map((row) => {
                            const form = String(row.inboundForm || 'RAW').toUpperCase()
                            const boughtAs =
                              form === 'RECYCLED'
                                ? 'Recycled'
                                : form === 'CRUSHED'
                                  ? 'Crushed scrap'
                                  : 'Raw scrap'
                            return (
                              <tr key={row.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                                <td className="whitespace-nowrap py-2 pr-3 align-middle">
                                  <div className="flex flex-col gap-0.5">
                                    <Link
                                      to={`/receiving/${row.id}`}
                                      onClick={() => setActiveKpiModal(null)}
                                      className="font-mono text-[11px] font-semibold text-foreground hover:underline hover:text-[var(--accent-strong)]"
                                      title={[row.supplierName, boughtAs].filter(Boolean).join(' · ')}
                                    >
                                      {row.batchNumber || `REC-${row.id}`}
                                    </Link>
                                    <span className="text-[10px] text-muted-foreground tabular-nums">
                                      {row.businessDate
                                        ? formatBusinessDate(row.businessDate)
                                        : formatDate(row.receivedAt)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-3 align-middle font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                                  {boughtAs}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums align-middle whitespace-nowrap">
                                  {fmt(row.kg)} kg
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold align-middle whitespace-nowrap">
                                  {money(row.cost ?? 0)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 align-middle whitespace-nowrap">
                                  {fmt(row.availableKg ?? 0)} kg
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-rose-600 align-middle whitespace-nowrap">
                                  {fmt(row.wasteKg ?? 0)} kg
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400 align-middle whitespace-nowrap">
                                  {fmt(row.secondGradeKg ?? 0)} kg
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums align-middle whitespace-nowrap">
                                  {fmt(row.crushedKg ?? 0)} kg
                                </td>
                                <td className="py-2 pl-3 text-right font-mono tabular-nums align-middle whitespace-nowrap">
                                  {fmt(row.washedKg ?? 0)} kg
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[11px] text-muted-foreground">Quick actions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                      <Link to="/receiving" onClick={() => setActiveKpiModal(null)}>Scrap Buying →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                      <Link to="/inventory" onClick={() => setActiveKpiModal(null)}>Inventory →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                      <Link to="/batches" onClick={() => setActiveKpiModal(null)}>Batches →</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeKpiModal === 'production' && d && (
              <div className="space-y-3">
                <DialogHeader className="mb-0 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                      <Factory className="size-4" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                        Total production
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        Good output by product for {d.range.label} (batch business date)
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Produced</span>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                      {fmtDozenPcs(d.production.unitsProduced)}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Dozen and pieces</span>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Good Quality</span>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600">
                      {fmtDozenPcs(d.production.unitsGood)}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-medium">Passed inspection</span>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reject Rate</span>
                    <p className={cn("mt-0.5 text-lg font-bold tabular-nums", d.production.rejectPercent > 5 ? 'text-red-600' : 'text-foreground')}>
                      {d.production.rejectPercent}%
                    </p>
                    <span className="text-[10px] text-muted-foreground">{fmtDozenPcs(d.production.unitsReject)} scrap</span>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Downtime</span>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-600">
                      {fmt(d.production.downtimeMinutes || 0)} <span className="text-[11px] font-normal text-muted-foreground">min</span>
                    </p>
                    <span className="text-[10px] text-muted-foreground">Unscheduled stops</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    By product · {d.range.label}
                  </h4>
                  {(d.productionByProduct || []).length === 0 ? (
                    <p className="rounded-lg border border-zinc-200 px-3 py-4 text-xs text-muted-foreground dark:border-zinc-800">
                      No production in this period.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-3 text-right">Quantity</th>
                            <th className="py-2.5 px-3 text-right">Dozen</th>
                            <th className="py-2.5 px-3 text-right">Pcs</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {(d.productionByProduct || []).map((row) => (
                            <tr
                              key={row.productId ?? row.productName}
                              className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60"
                            >
                              <td className="py-2.5 px-3 font-semibold text-foreground">
                                {row.productName}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums align-top font-semibold">
                                {fmtDozenPcs(row.qtyGood)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums align-top">
                                {row.dozen}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums align-top">
                                {row.pcs}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[11px] text-muted-foreground">Quick actions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                      <Link to="/production" onClick={() => setActiveKpiModal(null)}>Production Runs →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                      <Link to="/machines" onClick={() => setActiveKpiModal(null)}>Machines &amp; OEE →</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeKpiModal === 'finished_goods' && d && (
              <div className="space-y-3">
                <DialogHeader className="mb-0 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400">
                      <PackageCheck className="size-4" />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                        Factory store
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                        Factory stock on hand by product (same balances as Inventory · no QC filter)
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stock qty</span>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-teal-600">
                      {fmtDozenPcs(d.inventory.fgUnits)}
                    </p>
                    <span className="text-[10px] text-muted-foreground">On hand</span>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stock value</span>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-teal-700">
                      {money(d.inventory.fgValue ?? d.finishedGoodsValue ?? 0)}
                    </p>
                    <span className="text-[10px] text-muted-foreground">At list price</span>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Products</span>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                      {(d.finishedGoodsStock || []).length}
                    </p>
                    <span className="text-[10px] text-muted-foreground">With stock on hand</span>
                  </div>
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Low stock</span>
                    <p
                      className={cn(
                        'mt-0.5 text-lg font-bold tabular-nums',
                        d.inventory.lowStockCount > 0 ? 'text-amber-600' : 'text-foreground',
                      )}
                    >
                      {d.inventory.lowStockCount || 0}
                    </p>
                    <span className="text-[10px] text-muted-foreground">Below reorder point</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Stock by product
                  </h4>
                  {(d.finishedGoodsStock || []).length === 0 ? (
                    <p className="rounded-lg border border-zinc-200 px-3 py-4 text-xs text-muted-foreground dark:border-zinc-800">
                      No product stock on hand in the factory.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-3 text-right">Qty</th>
                            <th className="py-2.5 px-3 text-right">Unit price</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {(d.finishedGoodsStock || []).map((row) => (
                            <tr key={row.productId} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60">
                              <td className="py-2.5 px-3">
                                <p className="font-semibold text-foreground">{row.productName}</p>
                                {row.productCode ? (
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {row.productCode}
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums align-top font-semibold text-foreground">
                                {fmtDozenPcs(row.qtyOnHand)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums align-top text-muted-foreground">
                                {row.sellingPrice > 0 ? money(row.sellingPrice) : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums align-top font-bold text-foreground">
                                {row.stockValue > 0 ? money(row.stockValue) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-muted-foreground">QC pass rate</span>
                      <p className="text-base font-bold text-foreground mt-0.5 tabular-nums">
                        {d.quality.passRatePercent != null ? `${d.quality.passRatePercent}%` : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Open holds</span>
                      <p className="text-base font-bold text-foreground mt-0.5 tabular-nums">
                        {d.quality.openHolds || 0}
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-muted-foreground">Low stock SKUs</span>
                      <p
                        className={cn(
                          'text-base font-bold mt-0.5 tabular-nums',
                          d.inventory.lowStockCount > 0 ? 'text-amber-600' : 'text-foreground',
                        )}
                      >
                        {d.inventory.lowStockCount || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[11px] text-muted-foreground">Quick actions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                      <Link to="/pricing" onClick={() => setActiveKpiModal(null)}>Product pricing →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                      <Link to="/production-store?tab=finished_goods" onClick={() => setActiveKpiModal(null)}>FG Store →</Link>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                      <Link to="/qc" onClick={() => setActiveKpiModal(null)}>Quality Control →</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeKpiModal === 'sales' && d && (
              <div className="space-y-2.5">
                {(() => {
                  const factoryRev = Number(d.sales.factoryRevenue ?? d.sales.revenue ?? 0)
                  const shopRev = Number(d.sales.shopRevenue ?? 0)
                  const totalRev = factoryRev + shopRev
                  const factoryN = Number(d.sales.factorySaleCount ?? d.sales.saleCount ?? 0)
                  const shopN = Number(d.sales.shopSaleCount ?? 0)
                  const theyOwe = Number(d.money.receivables || 0)
                  const weHold = Number(d.money.payables ?? d.customerBalances?.totalPayable ?? 0)
                  const netPos = theyOwe - weHold
                  const cashIn = Number(d.money.cashIn || 0)
                  const cashOut = Number(d.money.cashOut || 0)
                  const netCash = Number(d.money.netCash || 0)
                  const owingRows = (d.customerBalances?.rows || []).filter(
                    (c) => Number(c.receivable || 0) > 0.001,
                  )
                  const advanceRows = (d.customerBalances?.rows || []).filter(
                    (c) => Number(c.payable || 0) > 0.001,
                  )
                  return (
                    <>
                      <DialogHeader className="mb-0 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            <Banknote className="size-3.5" />
                          </div>
                          <div>
                            <DialogTitle className="text-sm font-bold tracking-tight text-foreground">
                              Sales · {d.periodLabel}
                            </DialogTitle>
                            <DialogDescription className="text-[11px] text-muted-foreground">
                              What sold · who owes · cash movement
                            </DialogDescription>
                          </div>
                        </div>
                      </DialogHeader>

                      {/* 1. What sold */}
                      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 px-2.5 py-2 dark:border-zinc-800">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Sold this period
                          </span>
                          <span className="text-base font-bold tabular-nums text-zinc-900 dark:text-white">
                            ₦{fmt(totalRev, 0)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-zinc-100 dark:divide-zinc-800">
                          <div className="px-2.5 py-2">
                            <p className="text-[10px] font-medium text-zinc-500">Factory sales</p>
                            <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
                              ₦{fmt(factoryRev, 0)}
                            </p>
                            <p className="text-[10px] text-zinc-400">{factoryN} orders</p>
                          </div>
                          <div className="px-2.5 py-2">
                            <p className="text-[10px] font-medium text-zinc-500">Shop sales</p>
                            <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
                              ₦{fmt(shopRev, 0)}
                            </p>
                            <p className="text-[10px] text-zinc-400">{shopN} orders</p>
                          </div>
                        </div>
                      </section>

                      {/* 2. Customer money position (netted) */}
                      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="border-b border-zinc-100 px-2.5 py-1.5 dark:border-zinc-800">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Customer money
                          </span>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800">
                          <div className="px-2 py-2 text-center sm:px-2.5 sm:text-left">
                            <p className="text-[10px] font-medium text-amber-700/80">They owe</p>
                            <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-700">
                              ₦{fmt(theyOwe, 0)}
                            </p>
                          </div>
                          <div className="px-2 py-2 text-center sm:px-2.5 sm:text-left">
                            <p className="text-[10px] font-medium text-sky-700/80">Advance held</p>
                            <p className="mt-0.5 text-sm font-bold tabular-nums text-sky-700">
                              ₦{fmt(weHold, 0)}
                            </p>
                          </div>
                          <div className="px-2 py-2 text-center sm:px-2.5 sm:text-left">
                            <p className="text-[10px] font-medium text-zinc-500">Net</p>
                            <p
                              className={cn(
                                'mt-0.5 text-sm font-bold tabular-nums',
                                netPos > 0.001
                                  ? 'text-amber-700'
                                  : netPos < -0.001
                                    ? 'text-sky-700'
                                    : 'text-zinc-900 dark:text-white',
                              )}
                            >
                              {netPos < -0.001 ? '−' : netPos > 0.001 ? '+' : ''}
                              ₦{fmt(Math.abs(netPos), 0)}
                            </p>
                          </div>
                        </div>
                        {(owingRows.length > 0 || advanceRows.length > 0) && (
                          <div className="max-h-36 space-y-0.5 overflow-y-auto border-t border-zinc-100 px-1.5 py-1.5 dark:border-zinc-800">
                            {owingRows.slice(0, 5).map((c) => (
                              <Link
                                key={`o-${c.customerId}`}
                                to={c.customerCode ? `/distributors/${c.customerCode}` : '/distributors'}
                                onClick={() => setActiveKpiModal(null)}
                                className="flex items-center justify-between gap-2 rounded px-1 py-1 text-[11px] hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              >
                                <span className="min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-200">
                                  {c.customerName}
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums text-amber-700">
                                  owes ₦{fmt(c.receivable, 0)}
                                </span>
                              </Link>
                            ))}
                            {advanceRows.slice(0, 5).map((c) => (
                              <Link
                                key={`a-${c.customerId}`}
                                to={c.customerCode ? `/distributors/${c.customerCode}` : '/distributors'}
                                onClick={() => setActiveKpiModal(null)}
                                className="flex items-center justify-between gap-2 rounded px-1 py-1 text-[11px] hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              >
                                <span className="min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-200">
                                  {c.customerName}
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums text-sky-700">
                                  advance ₦{fmt(c.payable, 0)}
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </section>

                      {/* 3. Cash movement */}
                      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 px-2.5 py-1.5 dark:border-zinc-800">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Cash this period
                          </span>
                          <span
                            className={cn(
                              'text-xs font-bold tabular-nums',
                              netCash >= 0 ? 'text-emerald-700' : 'text-red-600',
                            )}
                          >
                            Net {netCash >= 0 ? '+' : '−'}₦{fmt(Math.abs(netCash), 0)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-px bg-zinc-100 sm:grid-cols-4 dark:bg-zinc-800">
                          <div className="bg-white px-2.5 py-2 dark:bg-zinc-950">
                            <p className="text-[10px] text-zinc-500">Cash in</p>
                            <p className="text-sm font-bold tabular-nums text-emerald-700">
                              ₦{fmt(cashIn, 0)}
                            </p>
                          </div>
                          <div className="bg-white px-2.5 py-2 dark:bg-zinc-950">
                            <p className="text-[10px] text-zinc-500">Cash out</p>
                            <p className="text-sm font-bold tabular-nums text-red-600">
                              ₦{fmt(cashOut, 0)}
                            </p>
                          </div>
                          <div className="bg-white px-2.5 py-2 dark:bg-zinc-950">
                            <p className="text-[10px] text-zinc-500">Expenses</p>
                            <p className="text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
                              ₦{fmt(d.spend.approvedExpenses || 0, 0)}
                            </p>
                          </div>
                          <div className="bg-white px-2.5 py-2 dark:bg-zinc-950">
                            <p className="text-[10px] text-zinc-500">Wages owed</p>
                            <p className="text-sm font-bold tabular-nums text-amber-700">
                              ₦{fmt(d.spend.wagesOutstanding || 0, 0)}
                            </p>
                          </div>
                        </div>
                      </section>

                      {/* Compact trend chips */}
                      {d.trend && d.trend.length > 0 && (
                        <section>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                            Recent months
                          </p>
                          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                            {d.trend.map((t, idx) => (
                              <div
                                key={idx}
                                className="min-w-[4.75rem] shrink-0 rounded-md border border-zinc-200 bg-zinc-50/80 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/50"
                              >
                                <p className="text-[10px] font-medium text-zinc-500">{t.shortLabel}</p>
                                <p className="text-xs font-bold tabular-nums text-zinc-900 dark:text-white">
                                  ₦{fmt(t.revenue, 0)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                        <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                          <Link to="/sales" onClick={() => setActiveKpiModal(null)}>
                            Sales →
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                          <Link to="/distributors" onClick={() => setActiveKpiModal(null)}>
                            Customers →
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] font-medium" asChild>
                          <Link to="/expenses" onClick={() => setActiveKpiModal(null)}>
                            Cash →
                          </Link>
                        </Button>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {activeKpiModal === 'shops' && d && (
              <div className="space-y-2.5">
                <DialogHeader className="mb-0 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
                      <Store className="size-3.5" />
                    </div>
                    <div>
                      <DialogTitle className="text-sm font-bold tracking-tight text-foreground">
                        Market shops
                      </DialogTitle>
                      <DialogDescription className="text-[11px] text-muted-foreground">
                        Stock at shop and stall sales · {d.range.label}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800">
                    <div className="px-2 py-2 sm:px-2.5">
                      <p className="text-[10px] font-medium text-zinc-500">On hand</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-violet-700 dark:text-violet-400">
                        {money(d.factoryShops?.remainingValue ?? 0)}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {fmtDozenPcs(d.factoryShops?.remainingQty ?? 0)}
                      </p>
                    </div>
                    <div className="px-2 py-2 sm:px-2.5">
                      <p className="text-[10px] font-medium text-zinc-500">Sold</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
                        {fmtDozenPcs(d.factoryShops?.soldAtShopQty ?? 0)}
                      </p>
                      <p className="text-[10px] text-zinc-400">At the shop</p>
                    </div>
                    <div className="px-2 py-2 sm:px-2.5">
                      <p className="text-[10px] font-medium text-zinc-500">Sales</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
                        ₦{fmt(d.sales.shopRevenue ?? d.factoryShops?.shopRetailGenerated ?? 0)}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        Collected ₦
                        {fmt(d.sales.shopCollected ?? d.factoryShops?.shopRetailCollected ?? 0)}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Balance by shop
                  </h4>
                  {(d.factoryShops?.shops || []).length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">
                      No market shops set up yet.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full border-collapse text-left text-[11px]">
                        <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900">
                          <tr>
                            <th className="px-2 py-1.5 font-semibold">Shop</th>
                            <th className="px-2 py-1.5 text-right font-semibold">In</th>
                            <th className="px-2 py-1.5 text-right font-semibold">Sold</th>
                            <th className="px-2 py-1.5 text-right font-semibold">On hand</th>
                            <th className="px-2 py-1.5 text-right font-semibold">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {(d.factoryShops?.shops || []).map((shop) => (
                            <tr
                              key={shop.customerId}
                              className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60"
                            >
                              <td className="px-2 py-1.5">
                                <Link
                                  to={`/distributors/${shop.customerCode || shop.customerId}`}
                                  onClick={() => setActiveKpiModal(null)}
                                  className="font-semibold text-violet-700 hover:underline dark:text-violet-400"
                                >
                                  {shop.customerName}
                                </Link>
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {fmtDozenPcs(shop.receivedQty)}
                              </td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {fmtDozenPcs(shop.soldQty)}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                                {fmtDozenPcs(shop.remainingQty)}
                              </td>
                              <td className="px-2 py-1.5 text-right font-bold tabular-nums text-violet-700 dark:text-violet-400">
                                {money(shop.remainingValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Transfers ({d.factoryShops?.transfers?.length ?? 0})
                  </h4>
                  {(d.factoryShops?.transfers || []).length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">
                      No stock issues to shops in this period.
                    </p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                      {(d.factoryShops?.transfers || []).map((txn) => {
                        const open = expandedShopTransferId === txn.id
                        return (
                          <div key={txn.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedShopTransferId(open ? null : txn.id)
                              }
                              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60"
                            >
                              <ChevronDown
                                className={cn(
                                  'size-3.5 shrink-0 text-muted-foreground transition-transform',
                                  open && 'rotate-180',
                                )}
                              />
                              <span className="w-20 shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">
                                {formatBusinessDate(txn.businessDate) || '—'}
                              </span>
                              <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                                {txn.customerName}
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {fmtDozenPcs(txn.qty)}
                              </span>
                              <span className="w-24 shrink-0 text-right font-bold tabular-nums text-foreground">
                                {money(txn.stockValue)}
                              </span>
                            </button>
                            {open ? (
                              <div className="border-t border-zinc-100 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                                {(txn.lines || []).length === 0 ? (
                                  <p className="py-1 text-[11px] text-muted-foreground">
                                    No line items.
                                  </p>
                                ) : (
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead className="text-muted-foreground font-semibold">
                                      <tr>
                                        <th className="py-1 pr-2">Product</th>
                                        <th className="py-1 px-2 text-right">Qty</th>
                                        <th className="py-1 px-2 text-right">Unit</th>
                                        <th className="py-1 pl-2 text-right">Value</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                      {(txn.lines || []).map((line, idx) => (
                                        <tr key={`${txn.id}-${line.productId}-${idx}`}>
                                          <td className="py-1.5 pr-2 font-medium text-foreground">
                                            {line.productName || `Product #${line.productId}`}
                                          </td>
                                          <td className="py-1.5 px-2 text-right tabular-nums">
                                            {fmtDozenPcs(line.qty)}
                                          </td>
                                          <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">
                                            {money(line.unitPrice)}
                                          </td>
                                          <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">
                                            {money(line.lineValue)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[11px] text-muted-foreground">Quick actions:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const shops = d.factoryShops?.shops || []
                      const shop = shops[0]
                      const viewTo = shop
                        ? `/distributors/${shop.customerCode || shop.customerId}`
                        : '/distributors'
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] font-medium"
                          asChild
                        >
                          <Link to={viewTo} onClick={() => setActiveKpiModal(null)}>
                            View shop →
                          </Link>
                        </Button>
                      )
                    })()}
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
