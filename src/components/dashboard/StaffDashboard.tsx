import { useMemo, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PackagePlus,
  Hammer,
  Droplets,
  RotateCcw,
  Warehouse,
  Play,
  ShieldCheck,
  Boxes,
  Truck,
  Store,
  Search,
  Receipt,
  Users,
  HardHat,
  Wallet,
  LayoutDashboard,
  Gauge,
  TrendingUp,
  Calculator,
  Layers,
  Bell,
  ArrowRight,
  Eye,
  EyeOff,
  Banknote,
  Wrench,
  Factory,
  Recycle,
  RefreshCw,
  Tag,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
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
import { canAccessNavItem } from '@/components/AppShell'
import { cn } from '@/lib/utils'
import { isOutletScoped, outletHomePath, outletNavLabel } from '@/lib/outlet'
import { useHideMoney } from '@/hooks/useHideMoney'
import { fmtDozenPcs } from '@/lib/units'

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
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

type QuickActionItem = {
  to: string
  title: string
  desc: string
  icon: ComponentType<{ className?: string }>
  tone: string
  menuKey: string
  permission?: string
}

type StaffOpsSections = {
  scrap?: {
    periodBuys?: number
    periodKg?: number
    periodCost?: number
    todayBuys: number
    todayKg: number
    todayCost: number
    openTickets: number
  }
  crushing?: {
    openLots: number
    openKg: number
    periodRuns?: number
    periodOutKg?: number
    todayRuns: number
    todayInKg: number
    todayOutKg: number
  }
  washing?: {
    openLots: number
    openKg: number
    periodRuns?: number
    periodOutKg?: number
    todayRuns: number
    todayInKg: number
    todayOutKg: number
  }
  drying?: {
    openLots: number
    openKg: number
    periodRuns?: number
    periodOutKg?: number
    todayRuns: number
    todayInKg: number
    todayOutKg: number
  }
  recrushing?: { waitingLots: number }
  recycling?: {
    openLots: number
    openKg: number
    periodRuns?: number
    periodOutKg?: number
    todayRuns: number
    todayOutKg: number
  }
  productionStore?: { lots: number; kg: number; pendingHandover: number }
  production?: {
    activeRuns: number
    openBatches: number
    periodGood?: number
    periodReject?: number
    periodCompleted?: number
    periodDowntimeMinutes?: number
    todayGood: number
    todayReject: number
    todayCompleted: number
    todayDowntimeMinutes: number
  }
  machines?: {
    totalMachines: number
    running: number
    maintenance: number
    stopped: number
    openJobs: number
    scheduled: number
    periodCost?: number
    periodDowntimeMinutes?: number
    monthCost: number
    monthDowntimeMinutes: number
  }
  inventory?: { rawKg: number; wipKg: number; finishedQty: number; lowStockLines: number }
  sales?: {
    periodSales?: number
    periodRevenue?: number
    todaySales: number
    todayRevenue: number
  }
  qc?: { pendingQueue: number }
  expenses?: {
    periodCount?: number
    periodTotal?: number
    todayCount: number
    todayTotal: number
    pendingCount: number
  }
  alerts?: { totalUnacknowledged: number; bySeverity: Record<string, number> }
}

type KpiCard = {
  key: string
  label: string
  value: string
  hint: string
  icon: ComponentType<{ className?: string }>
  tone: string
  to?: string
}

const ALL_SIDEBAR_QUICK_ACTIONS: QuickActionItem[] = [
  {
    to: '/receiving/new',
    title: 'New Scrap Buying',
    desc: 'Log inbound raw or crushed scrap',
    icon: PackagePlus,
    tone: 'bg-amber-500 text-white',
    menuKey: 'receiving',
    permission: 'receiving.create',
  },
  {
    to: '/process/crushing',
    title: 'Crushing Stage',
    desc: 'Crush sorted material into flakes',
    icon: Hammer,
    tone: 'bg-purple-600 text-white',
    menuKey: 'crushing',
    permission: 'batch.create',
  },
  {
    to: '/process/washing',
    title: 'Washing Stage',
    desc: 'Wash crushed material lots',
    icon: Droplets,
    tone: 'bg-cyan-600 text-white',
    menuKey: 'washing',
    permission: 'batch.create',
  },
  {
    to: '/process/recrushing',
    title: 'Re-crushing',
    desc: 'Re-crush washed and dried lots',
    icon: RotateCcw,
    tone: 'bg-slate-700 text-white',
    menuKey: 'recrushing',
    permission: 'batch.create',
  },
  {
    to: '/production/store',
    title: 'Material Store',
    desc: 'Ready-to-process flake inventory',
    icon: Warehouse,
    tone: 'bg-emerald-600 text-white',
    menuKey: 'production_store',
    permission: 'batch.view',
  },
  {
    to: '/production/new',
    title: 'Floor Operations & Shifts',
    desc: 'Manage machine shifts, outputs & downtime',
    icon: Play,
    tone: 'bg-violet-600 text-white',
    menuKey: 'production',
    permission: 'batch.view',
  },
  {
    to: '/qc',
    title: 'QC Inspection',
    desc: 'Inspect dried or production batches',
    icon: ShieldCheck,
    tone: 'bg-teal-600 text-white',
    menuKey: 'qc',
    permission: 'qc.inspect',
  },
  {
    to: '/inventory',
    title: 'Stock Ledger',
    desc: 'View balances and make adjustments',
    icon: Boxes,
    tone: 'bg-sky-600 text-white',
    menuKey: 'inventory',
    permission: 'inventory.view',
  },
  {
    to: '/sales/new',
    title: 'New Dispatch / Sale',
    desc: 'Create sales invoice & dispatch goods',
    icon: Truck,
    tone: 'bg-indigo-600 text-white',
    menuKey: 'sales',
    permission: 'sales.view',
  },
  {
    to: '/pricing',
    title: 'Product pricing',
    desc: 'Set & update selling prices for sales',
    icon: Tag,
    tone: 'bg-teal-700 text-white',
    menuKey: 'pricing',
    permission: 'sales.create',
  },
  {
    to: '/distributors',
    title: 'Distributors',
    desc: 'Customer distributor accounts & credit',
    icon: Store,
    tone: 'bg-blue-600 text-white',
    menuKey: 'distributors',
    permission: 'sales.view',
  },
  {
    to: '/batches',
    title: 'Batches',
    desc: 'Search, trace & inspect batch histories',
    icon: Search,
    tone: 'bg-zinc-700 text-white',
    menuKey: 'batches',
    permission: 'batch.view',
  },
  {
    to: '/masters',
    title: 'Masters Management',
    desc: 'Configure scrap grades, products & settings',
    icon: Boxes,
    tone: 'bg-stone-600 text-white',
    menuKey: 'masters',
    permission: 'masters.manage',
  },
  {
    to: '/wallet',
    title: 'Wallet',
    desc: 'Available balance for each person',
    icon: Wallet,
    tone: 'bg-zinc-900 text-white',
    menuKey: 'processing_money',
    permission: 'float.spend',
  },
  {
    to: '/expenses',
    title: 'Log Expense',
    desc: 'Submit operational expenses & vouchers',
    icon: Receipt,
    tone: 'bg-rose-600 text-white',
    menuKey: 'expenses',
    permission: 'expense.view',
  },
  {
    to: '/staff',
    title: 'Staff Management',
    desc: 'Manage workforce, attendance & roles',
    icon: Users,
    tone: 'bg-amber-600 text-white',
    menuKey: 'staff',
    permission: 'labour.view',
  },
  {
    to: '/operators',
    title: 'Operators',
    desc: 'Floor operators for crushing, re-crushing and production — no login',
    icon: HardHat,
    tone: 'bg-stone-700 text-white',
    menuKey: 'operators',
    permission: 'labour.view',
  },
  {
    to: '/payroll',
    title: 'Payroll & Wages',
    desc: 'Worker wage sheets & disbursements',
    icon: Wallet,
    tone: 'bg-emerald-700 text-white',
    menuKey: 'payroll',
    permission: 'labour.view',
  },
  {
    to: '/dashboard',
    title: 'Command Centre',
    desc: 'Executive cockpit, KPIs & margins',
    icon: LayoutDashboard,
    tone: 'bg-indigo-700 text-white',
    menuKey: 'dashboard',
    permission: 'dashboard.executive',
  },
  {
    to: '/machines',
    title: 'Machines & Maintenance',
    desc: 'Monitor health, runtimes & breakdowns',
    icon: Gauge,
    tone: 'bg-orange-600 text-white',
    menuKey: 'machines',
    permission: 'batch.view',
  },
  {
    to: '/sales/margins',
    title: 'Sales Margins',
    desc: 'Analyze product profitability & margins',
    icon: TrendingUp,
    tone: 'bg-teal-700 text-white',
    menuKey: 'sales_margins',
    permission: 'sales.view',
  },
  {
    to: '/costs',
    title: 'Cost Intelligence',
    desc: 'Unit production costs & power usage',
    icon: Calculator,
    tone: 'bg-cyan-700 text-white',
    menuKey: 'costs',
    permission: 'costs.view',
  },
  {
    to: '/costs/overhead',
    title: 'Factory Overhead',
    desc: 'Track monthly overheads & absorption',
    icon: Layers,
    tone: 'bg-fuchsia-700 text-white',
    menuKey: 'overhead',
    permission: 'costs.view',
  },
  {
    to: '/alerts',
    title: 'Operational Alerts',
    desc: 'Review critical notices & plant flags',
    icon: Bell,
    tone: 'bg-red-600 text-white',
    menuKey: 'alerts',
    permission: 'alert.view',
  },
]

function stageCards(
  key: string,
  title: string,
  to: string,
  icon: ComponentType<{ className?: string }>,
  periodLabel: string,
  data?: {
    openLots: number
    openKg: number
    periodRuns?: number
    periodOutKg?: number
    todayRuns: number
    todayInKg?: number
    todayOutKg: number
  },
): KpiCard[] {
  if (!data) return []
  const runs = data.periodRuns ?? data.todayRuns
  const outKg = data.periodOutKg ?? data.todayOutKg
  return [
    {
      key: `${key}-open`,
      label: `${title} waiting`,
      value: String(data.openLots),
      hint: `${Number(data.openKg || 0).toLocaleString()} kg open`,
      icon,
      tone: 'text-violet-600',
      to,
    },
    {
      key: `${key}-period`,
      label: `${title} · ${periodLabel}`,
      value: String(runs),
      hint: `${Number(outKg || 0).toLocaleString()} kg out`,
      icon,
      tone: 'text-emerald-600',
      to,
    },
  ]
}

export function StaffDashboard() {
  const user = useAuthStore((s) => s.user)
  const { hidden: hideMoney, toggle: toggleHideMoney, maskMoney } = useHideMoney()
  const [rangePreset, setRangePreset] = useState('this_month')

  const canSeeQc = canAccessNavItem(user, {
    to: '/qc',
    label: 'Quality control',
    icon: ShieldCheck,
    menuKey: 'qc',
    permission: 'qc.inspect',
  })
  const canQcInspect = hasPermission(user, 'qc.inspect')

  const opsQuery = useQuery({
    queryKey: ['staff-ops-dashboard', rangePreset],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/staff', {
        params: { rangePreset },
      })
      return data.data as {
        businessDate: string
        range?: { preset: string; from: string; to: string; label: string }
        sections: StaffOpsSections
      }
    },
    refetchInterval: 30_000,
  })

  const walletQuery = useQuery({
    queryKey: ['processing-wallet-me'],
    queryFn: async () => {
      const { data } = await api.get('/processing-wallets/me')
      return data as {
        hasWallet?: boolean
        data?: { remaining?: number; given?: number; spent?: number; returned?: number }
      }
    },
    refetchInterval: 30_000,
  })

  const qcQueueQuery = useQuery({
    queryKey: ['staff-qc-queue'],
    queryFn: async () => {
      const { data } = await api.get('/qc/queue')
      const items = (data.data as Array<{
        id: number
        batchNumber: string
        batchType: string
        status: string
        qtyOut?: number | string | null
        qtyRemaining?: number | string | null
        uom: string
        product?: { name: string }
        material?: { name: string }
        productName?: string | null
        materialName?: string | null
      }>) || []
      return items.filter(
        (b) => !(b.batchType === 'PROD' && (b.status === 'IN_PROGRESS' || b.status === 'PENDING')),
      )
    },
    enabled: canSeeQc,
    refetchInterval: 30_000,
  })

  const hasWallet = Boolean(walletQuery.data?.hasWallet)
  const wallet = walletQuery.data?.data
  const sections = opsQuery.data?.sections || {}
  const rangeLabel =
    opsQuery.data?.range?.label ||
    RANGE_OPTIONS.find((o) => o.id === rangePreset)?.label ||
    'This month'
  const shortLabel =
    rangePreset === 'today'
      ? 'Today'
      : rangePreset === 'yesterday'
        ? 'Yesterday'
        : rangeLabel

  const kpiCards = useMemo(() => {
    const cards: KpiCard[] = []
    const s = sections

    if (s.scrap) {
      const buys = s.scrap.periodBuys ?? s.scrap.todayBuys
      const kg = s.scrap.periodKg ?? s.scrap.todayKg
      const cost = s.scrap.periodCost ?? s.scrap.todayCost
      cards.push(
        {
          key: 'scrap-buys',
          label: `Scrap buys · ${shortLabel}`,
          value: String(buys),
          hint: `${Number(kg || 0).toLocaleString()} kg`,
          icon: PackagePlus,
          tone: 'text-amber-600',
          to: '/receiving',
        },
        {
          key: 'scrap-cost',
          label: `Scrap spend · ${shortLabel}`,
          value: money(cost),
          hint: `${s.scrap.openTickets} open tickets`,
          icon: Banknote,
          tone: 'text-amber-700',
          to: '/receiving',
        },
      )
    }

    cards.push(...stageCards('crush', 'Crushing', '/process/crushing', Hammer, shortLabel, s.crushing))
    cards.push(...stageCards('wash', 'Washing', '/process/washing', Droplets, shortLabel, s.washing))
    cards.push(...stageCards('dry', 'Drying', '/process/drying', Factory, shortLabel, s.drying))

    if (s.recrushing) {
      cards.push({
        key: 'recrush-wait',
        label: 'Re-crush waiting',
        value: String(s.recrushing.waitingLots),
        hint: 'Wash / dry lots ready',
        icon: RotateCcw,
        tone: 'text-slate-700',
        to: '/process/recrushing',
      })
    }

    if (s.recycling) {
      cards.push(...stageCards('recycle', 'Recycling', '/process/recycling', Recycle, shortLabel, s.recycling))
    }

    if (s.productionStore) {
      cards.push(
        {
          key: 'store-kg',
          label: 'Material store',
          value: `${Number(s.productionStore.kg || 0).toLocaleString()} kg`,
          hint: `${s.productionStore.lots} lots on hand`,
          icon: Warehouse,
          tone: 'text-emerald-600',
          to: '/production/store',
        },
        {
          key: 'store-pending',
          label: 'Pending handover',
          value: String(s.productionStore.pendingHandover),
          hint: 'Dry / recycle waiting',
          icon: Warehouse,
          tone: 'text-emerald-700',
          to: '/production/store',
        },
      )
    }

    if (s.production) {
      const good = s.production.periodGood ?? s.production.todayGood
      const reject = s.production.periodReject ?? s.production.todayReject
      const down = s.production.periodDowntimeMinutes ?? s.production.todayDowntimeMinutes
      cards.push(
        {
          key: 'prod-active',
          label: 'Active production',
          value: String(s.production.activeRuns),
          hint: `${s.production.openBatches} open batches`,
          icon: Play,
          tone: 'text-violet-600',
          to: '/production',
        },
        {
          key: 'prod-good',
          label: `Good · ${shortLabel}`,
          value: fmtDozenPcs(good),
          hint: `${fmtDozenPcs(reject)} reject · ${down}m down`,
          icon: Factory,
          tone: 'text-violet-700',
          to: '/production',
        },
      )
    }

    if (s.machines) {
      const cost = s.machines.periodCost ?? s.machines.monthCost
      const down = s.machines.periodDowntimeMinutes ?? s.machines.monthDowntimeMinutes
      cards.push(
        {
          key: 'mach-fleet',
          label: 'Machines running',
          value: `${s.machines.running}/${s.machines.totalMachines}`,
          hint: `${s.machines.maintenance} in maint · ${s.machines.stopped} stopped`,
          icon: Gauge,
          tone: 'text-orange-600',
          to: '/machines',
        },
        {
          key: 'mach-jobs',
          label: 'Maintenance jobs',
          value: String(s.machines.openJobs + s.machines.scheduled),
          hint: `${s.machines.openJobs} in progress · ${s.machines.scheduled} scheduled`,
          icon: Wrench,
          tone: 'text-orange-700',
          to: '/machines',
        },
        {
          key: 'mach-cost',
          label: `Maint. cost · ${shortLabel}`,
          value: money(cost),
          hint: `${down} min downtime`,
          icon: Wrench,
          tone: 'text-rose-600',
          to: '/machines',
        },
      )
    }

    if (s.inventory) {
      cards.push(
        {
          key: 'inv-raw',
          label: 'Raw scrap stock',
          value: `${Number(s.inventory.rawKg || 0).toLocaleString()} kg`,
          hint: `${Number(s.inventory.wipKg || 0).toLocaleString()} kg WIP`,
          icon: Boxes,
          tone: 'text-sky-600',
          to: '/inventory',
        },
        {
          key: 'inv-fg',
          label: 'Finished goods',
          value: fmtDozenPcs(s.inventory.finishedQty),
          hint: s.inventory.lowStockLines
            ? `${s.inventory.lowStockLines} below reorder`
            : 'Store inventory',
          icon: Boxes,
          tone: 'text-sky-700',
          to: '/inventory',
        },
      )
    }

    if (s.sales) {
      const salesCount = s.sales.periodSales ?? s.sales.todaySales
      const revenue = s.sales.periodRevenue ?? s.sales.todayRevenue
      cards.push({
        key: 'sales-period',
        label: `Sales · ${shortLabel}`,
        value: String(salesCount),
        hint: money(revenue),
        icon: Truck,
        tone: 'text-indigo-600',
        to: '/sales',
      })
    }

    if (s.qc) {
      cards.push({
        key: 'qc-pending',
        label: 'QC pending',
        value: String(s.qc.pendingQueue),
        hint: s.qc.pendingQueue ? 'Awaiting inspection' : 'Queue clear',
        icon: ShieldCheck,
        tone: 'text-teal-600',
        to: '/qc',
      })
    }

    if (s.expenses) {
      const total = s.expenses.periodTotal ?? s.expenses.todayTotal
      const count = s.expenses.periodCount ?? s.expenses.todayCount
      cards.push({
        key: 'exp-period',
        label: `Expenses · ${shortLabel}`,
        value: money(total),
        hint: `${count} logged · ${s.expenses.pendingCount} pending`,
        icon: Receipt,
        tone: 'text-rose-600',
        to: '/expenses',
      })
    }

    return cards
  }, [sections, shortLabel])

  const fastActions = useMemo(() => {
    return ALL_SIDEBAR_QUICK_ACTIONS.filter((act) =>
      canAccessNavItem(user, {
        to: act.to,
        label: act.title,
        icon: act.icon,
        menuKey: act.menuKey,
        permission: act.permission,
      }),
    ).map((act) => {
      if (act.menuKey !== 'distributors' || !isOutletScoped(user)) return act
      return {
        ...act,
        to: outletHomePath(user),
        title: outletNavLabel(user),
        desc: user?.outlet?.name
          ? `Stock, invoices and activity for ${user.outlet.name}`
          : 'Your assigned shop or distributor',
      }
    })
  }, [user])

  const alertCount = sections.alerts?.totalUnacknowledged || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{rangeLabel}</span>
        </p>
        <div className="flex items-center gap-1.5">
          <Select value={rangePreset} onValueChange={setRangePreset}>
            <SelectTrigger className="h-8 w-32 sm:w-40 text-xs bg-white dark:bg-zinc-900">
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
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => opsQuery.refetch()}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', opsQuery.isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {alertCount > 0 && (
        <Link
          to="/alerts"
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
        >
          <Bell className="h-4 w-4 text-amber-700 shrink-0" />
          <span>{alertCount} unacknowledged operational alert(s)</span>
          <ArrowRight className="h-3.5 w-3.5 ml-auto text-amber-700 shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {hasWallet && (
          <Card className="col-span-2 p-2.5 sm:p-4 bg-white dark:bg-zinc-900 border-emerald-200/80">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Processing money
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={toggleHideMoney}
                  className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  aria-label={hideMoney ? 'Show balances' : 'Hide balances'}
                  title={hideMoney ? 'Show balances' : 'Hide balances'}
                >
                  {hideMoney ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
                <Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
              </div>
            </div>
            <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold tracking-tight tabular-nums text-emerald-800 truncate">
              {maskMoney(money(wallet?.remaining || 0))}
            </p>
            <p className="mt-0.5 text-[9px] sm:text-xs text-muted-foreground truncate">
              Remaining
              {hideMoney
                ? ''
                : ` · given ${money(wallet?.given || 0)} · spent ${money(wallet?.spent || 0)}`}
            </p>
            {canAccessNavItem(user, {
              to: '/processing-money',
              label: 'Processing money',
              icon: Banknote,
              menuKey: 'processing_money',
              permission: 'float.spend',
            }) && (
              <Link
                to="/processing-money"
                className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-800 hover:underline"
              >
                Open wallet <ArrowRight className="size-3" />
              </Link>
            )}
          </Card>
        )}

        {opsQuery.isLoading && !kpiCards.length && (
          <Card className="col-span-2 p-4 text-xs text-muted-foreground">Loading your KPIs…</Card>
        )}

        {kpiCards.map((card) => {
          const Icon = card.icon
          const body = (
            <>
              <div className="flex items-center justify-between gap-1">
                <span
                  className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate"
                  title={card.label}
                >
                  {card.label}
                </span>
                <Icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0', card.tone)} />
              </div>
              <p className="mt-1 sm:mt-2 text-sm sm:text-xl font-bold tracking-tight text-foreground truncate">
                {card.value}
              </p>
              <p className="mt-0.5 text-[9px] sm:text-xs text-muted-foreground truncate">{card.hint}</p>
            </>
          )
          return card.to ? (
            <Link key={card.key} to={card.to} className="block">
              <Card className="h-full p-2.5 sm:p-4 bg-white dark:bg-zinc-900 transition hover:border-amber-300 hover:shadow-xs">
                {body}
              </Card>
            </Link>
          ) : (
            <Card key={card.key} className="p-2.5 sm:p-4 bg-white dark:bg-zinc-900">
              {body}
            </Card>
          )
        })}
      </div>

      {fastActions.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase text-muted-foreground">
            Quick Actions
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fastActions.map((act) => {
              const Icon = act.icon
              return (
                <Link
                  key={`${act.menuKey}-${act.to}`}
                  to={act.to}
                  className="group flex items-start gap-3.5 rounded-xl border border-zinc-200/80 bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-lg shadow-xs',
                      act.tone,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground group-hover:text-[var(--accent-strong)] truncate">
                      {act.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{act.desc}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)]" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {canSeeQc && (qcQueueQuery.data || []).length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-700" />
              <h3 className="font-semibold text-sm text-amber-950">
                Quality Inspection Queue ({qcQueueQuery.data!.length} waiting)
              </h3>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs bg-white" asChild>
              <Link to="/qc">View All QC</Link>
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {qcQueueQuery.data!.slice(0, 3).map((item) => {
              const qty = Number(item.qtyRemaining ?? item.qtyOut)
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200/80 bg-white p-3 shadow-2xs"
                >
                  <div>
                    <p className="font-semibold text-xs text-foreground">{item.batchNumber}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.productName ||
                        item.materialName ||
                        item.product?.name ||
                        item.material?.name ||
                        item.batchType}{' '}
                      · {(Number.isFinite(qty) ? qty : 0).toLocaleString()} {item.uom || 'kg'}
                    </p>
                  </div>
                  {canQcInspect && (
                    <Button size="sm" variant="default" className="h-7 text-xs" asChild>
                      <Link to={`/qc?batch=${item.batchNumber}`}>Inspect</Link>
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
