import { useMemo, type ComponentType } from 'react'
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
  Banknote,
  Users,
  Wallet,
  LayoutDashboard,
  Gauge,
  TrendingUp,
  Calculator,
  Layers,
  Clock,
  CheckCircle2,
  Bell,
  ArrowRight,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/lib/auth'
import { canAccessNavItem } from '@/components/AppShell'
import { cn } from '@/lib/utils'
import { isOutletScoped, outletHomePath, outletNavLabel } from '@/lib/outlet'

type BatchRow = {
  id: number
  batchNumber: string
  batchType: string
  status: string
  qtyRemaining: number | string
  uom: string
  createdAt?: string
  material?: { name: string }
  product?: { name: string }
}

type QcQueueItem = {
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
}

type QuickActionItem = {
  to: string
  title: string
  desc: string
  icon: ComponentType<{ className?: string }>
  tone: string
  menuKey: string
  permission?: string
}

// All sidebar navigation items mapped to a quick action
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
    to: '/processing-money',
    title: 'Processing money',
    desc: 'Cash given for scrap buying and processing, with remaining balance',
    icon: Banknote,
    tone: 'bg-lime-700 text-white',
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

function qcQueueQty(item: QcQueueItem) {
  const n = Number(item.qtyRemaining ?? item.qtyOut)
  return Number.isFinite(n) ? n : 0
}

export function StaffDashboard() {
  const user = useAuthStore((s) => s.user)

  const canBatchView = hasPermission(user, 'batch.view')
  const canQcInspect = hasPermission(user, 'qc.inspect')
  const canSeeQc = canAccessNavItem(user, {
    to: '/qc',
    label: 'Quality control',
    icon: ShieldCheck,
    menuKey: 'qc',
    permission: 'qc.inspect',
  })
  const canInventory = hasPermission(user, 'inventory.view')
  const canAlert = hasPermission(user, 'alert.view')

  // Fetch recent batches for metric calculations
  const batchesQuery = useQuery({
    queryKey: ['staff-recent-batches'],
    queryFn: async () => {
      const { data } = await api.get('/batches', { params: { limit: 20 } })
      return data.data as BatchRow[]
    },
    enabled: canBatchView,
    refetchInterval: 30_000,
  })

  const qcQueueQuery = useQuery({
    queryKey: ['staff-qc-queue'],
    queryFn: async () => {
      const { data } = await api.get('/qc/queue')
      const items = (data.data as QcQueueItem[]) || []
      return items.filter(
        (b) => !(b.batchType === 'PROD' && (b.status === 'IN_PROGRESS' || b.status === 'PENDING')),
      )
    },
    enabled: canSeeQc,
    refetchInterval: 30_000,
  })

  // Fetch Inventory overview if inventory access
  const inventoryQuery = useQuery({
    queryKey: ['staff-inventory-overview'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/overview')
      return data.data as {
        totals: {
          rawMaterialQty: number
          wipQty: number
          finishedGoodsQty: number
          lines: number
        }
      }
    },
    enabled: canInventory,
    refetchInterval: 60_000,
  })

  // Fetch alerts summary if alert view
  const alertsQuery = useQuery({
    queryKey: ['staff-alerts-summary'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/summary')
      return data.data as { totalUnacknowledged: number; bySeverity: Record<string, number> }
    },
    enabled: canAlert,
    refetchInterval: 60_000,
  })

  // Calculate batch metrics
  const batchList = batchesQuery.data || []
  const activeBatchesCount = batchList.filter((b) => b.status === 'IN_PROGRESS' || b.status === 'OPEN').length
  const completedTodayCount = batchList.filter((b) => b.status === 'COMPLETED').length
  const qcQueueCount = qcQueueQuery.data?.length || 0

  // Filter all sidebar quick actions based on user access
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

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {canAlert && (alertsQuery.data?.totalUnacknowledged || 0) > 0 && (
        <Link
          to="/alerts"
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
        >
          <Bell className="h-4 w-4 text-amber-700 shrink-0" />
          <span>{alertsQuery.data?.totalUnacknowledged} unacknowledged operational alert(s)</span>
          <ArrowRight className="h-3.5 w-3.5 ml-auto text-amber-700 shrink-0" />
        </Link>
      )}

      {/* Role-Specific Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {canBatchView && (
          <Card className="p-2 sm:p-4 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate" title="Active Batches">
                Active Batches
              </span>
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 shrink-0" />
            </div>
            <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {activeBatchesCount}
            </p>
            <p className="mt-0.5 text-[9px] sm:text-xs text-muted-foreground truncate">In progress</p>
          </Card>
        )}

        {canSeeQc && (
          <Card className="p-2 sm:p-4 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate" title="QC Pending">
                QC Pending
              </span>
              <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
            </div>
            <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {qcQueueCount}
            </p>
            <p className="mt-0.5 text-[9px] sm:text-xs text-muted-foreground truncate">
              {qcQueueCount === 0 ? 'Queue clear' : 'Awaiting QC'}
            </p>
          </Card>
        )}

        {canInventory && inventoryQuery.data && (
          <>
            <Card className="p-2 sm:p-4 bg-white dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate" title="Raw Scrap Stock">
                  Raw Scrap
                </span>
                <Boxes className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 shrink-0" />
              </div>
              <p className="mt-1 sm:mt-2 text-sm sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {Number(inventoryQuery.data.totals.rawMaterialQty || 0).toLocaleString()}{' '}
                <span className="text-[9px] sm:text-xs font-normal text-muted-foreground">kg</span>
              </p>
              <p className="mt-0.5 text-[9px] sm:text-xs text-muted-foreground truncate">Yard balance</p>
            </Card>

            <Card className="p-2 sm:p-4 bg-white dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate" title="Finished Goods">
                  Finished
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600 shrink-0" />
              </div>
              <p className="mt-1 sm:mt-2 text-sm sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {Number(inventoryQuery.data.totals.finishedGoodsQty || 0).toLocaleString()}{' '}
                <span className="text-[9px] sm:text-xs font-normal text-muted-foreground">pcs</span>
              </p>
              <p className="mt-0.5 text-[9px] sm:text-xs text-muted-foreground truncate">Store inventory</p>
            </Card>
          </>
        )}

        {!canInventory && canBatchView && (
          <Card className="p-2 sm:p-4 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate" title="Completed">
                Completed
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
            </div>
            <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {completedTodayCount}
            </p>
            <p className="mt-0.5 text-[9px] sm:text-xs text-muted-foreground truncate">Recent lots</p>
          </Card>
        )}
      </div>

      {/* Quick Actions Bar */}
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
                  key={act.to}
                  to={act.to}
                  className="group flex items-start gap-3.5 rounded-xl border border-zinc-200/80 bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg shadow-xs', act.tone)}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground group-hover:text-[var(--accent-strong)] truncate">
                      {act.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {act.desc}
                    </p>
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
            {qcQueueQuery.data!.slice(0, 3).map((item) => (
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
                    · {qcQueueQty(item).toLocaleString()} {item.uom || 'kg'}
                  </p>
                </div>
                {canQcInspect && (
                  <Button size="sm" variant="default" className="h-7 text-xs" asChild>
                    <Link to={`/qc?batch=${item.batchNumber}`}>Inspect</Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
