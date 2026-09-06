import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  PackagePlus,
  Hammer,
  Droplets,
  Flame,
  RotateCcw,
  Play,
  ShieldCheck,
  Boxes,
  Truck,
  Receipt,
  Clock,
  CheckCircle2,
  Bell,
  ArrowRight,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import CustomTable1 from '@/components/CustomTable1'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/lib/auth'
import { cn } from '@/lib/utils'

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
  qtyOut: number
  uom: string
  product?: { name: string }
  material?: { name: string }
}

function getStageBadge(stage?: string) {
  const s = (stage || '').toUpperCase()
  if (s === 'SCRAP') return 'bg-amber-50 text-amber-800 border-amber-200'
  if (s === 'SORT') return 'bg-blue-50 text-blue-800 border-blue-200'
  if (s === 'CRUSH') return 'bg-purple-50 text-purple-800 border-purple-200'
  if (s === 'WASH') return 'bg-cyan-50 text-cyan-800 border-cyan-200'
  if (s === 'DRY') return 'bg-orange-50 text-orange-800 border-orange-200'
  if (s === 'PROD') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  return 'bg-zinc-100 text-zinc-800 border-zinc-200'
}

function formatCreatedAt(raw?: string) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function StaffDashboard() {
  const user = useAuthStore((s) => s.user)

  const canBatchView = hasPermission(user, 'batch.view')
  const canBatchCreate = hasPermission(user, 'batch.create')
  const canReceiving = hasPermission(user, 'receiving.create')
  const canProdCreate = hasPermission(user, 'production.create')
  const canQc = hasPermission(user, 'qc.inspect')
  const canInventory = hasPermission(user, 'inventory.view')
  const canSales = hasPermission(user, 'sales.view')
  const canExpense = hasPermission(user, 'expense.view')
  const canAlert = hasPermission(user, 'alert.view')

  // Fetch recent batches for operations queue
  const batchesQuery = useQuery({
    queryKey: ['staff-recent-batches'],
    queryFn: async () => {
      const { data } = await api.get('/batches', { params: { limit: 20 } })
      return data.data as BatchRow[]
    },
    enabled: canBatchView,
    refetchInterval: 30_000,
  })

  // Fetch QC queue if QC or supervisor
  const qcQueueQuery = useQuery({
    queryKey: ['staff-qc-queue'],
    queryFn: async () => {
      const { data } = await api.get('/qc/queue')
      return data.data as QcQueueItem[]
    },
    enabled: canQc || canBatchCreate,
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

  // Fast actions relevant to user
  const fastActions = useMemo(() => {
    const list: Array<{
      to: string
      title: string
      desc: string
      icon: any
      tone: string
    }> = []

    if (canReceiving) {
      list.push({
        to: '/receiving/new',
        title: 'New Scrap Buying',
        desc: 'Log inbound raw or crushed scrap',
        icon: PackagePlus,
        tone: 'bg-amber-500 text-white',
      })
    }
    if (canBatchCreate) {
      list.push({
        to: '/process/crushing',
        title: 'Crushing Stage',
        desc: 'Crush sorted material into flakes',
        icon: Hammer,
        tone: 'bg-purple-600 text-white',
      })
      list.push({
        to: '/process/washing',
        title: 'Washing Stage',
        desc: 'Wash crushed material lots',
        icon: Droplets,
        tone: 'bg-cyan-600 text-white',
      })
      list.push({
        to: '/process/drying',
        title: 'Drying Stage',
        desc: 'Dry washed lots for production',
        icon: Flame,
        tone: 'bg-orange-600 text-white',
      })
      list.push({
        to: '/process/recrushing',
        title: 'Re-crushing',
        desc: 'Re-crush oversized scrap',
        icon: RotateCcw,
        tone: 'bg-slate-700 text-white',
      })
    }
    if (canProdCreate) {
      list.push({
        to: '/production/new',
        title: 'Record Production',
        desc: 'Log machine run and finished goods',
        icon: Play,
        tone: 'bg-violet-600 text-white',
      })
    }
    if (canQc) {
      list.push({
        to: '/qc',
        title: 'QC Inspection',
        desc: 'Inspect dried or production batches',
        icon: ShieldCheck,
        tone: 'bg-emerald-600 text-white',
      })
    }
    if (canInventory) {
      list.push({
        to: '/inventory',
        title: 'Stock Ledger',
        desc: 'View balances and make adjustments',
        icon: Boxes,
        tone: 'bg-sky-600 text-white',
      })
    }
    if (canSales) {
      list.push({
        to: '/sales/new',
        title: 'New Dispatch / Sale',
        desc: 'Create sales invoice & dispatch goods',
        icon: Truck,
        tone: 'bg-indigo-600 text-white',
      })
    }
    if (canExpense) {
      list.push({
        to: '/expenses',
        title: 'Log Expense',
        desc: 'Submit operational expenses',
        icon: Receipt,
        tone: 'bg-rose-600 text-white',
      })
    }

    return list
  }, [canReceiving, canBatchCreate, canProdCreate, canQc, canInventory, canSales, canExpense])

  // CustomTable1 columns for recent batches
  const batchColumns = useMemo((): ColumnDef<BatchRow>[] => [
    {
      accessorKey: 'batchNumber',
      header: 'Batch #',
      cell: ({ row }) => (
        <div>
          <Link
            to={`/batches/${row.original.batchNumber}`}
            className="font-semibold text-sm hover:underline text-[var(--accent-strong)]"
          >
            {row.original.batchNumber}
          </Link>
          <p className="text-xs text-[var(--ink-faint)]">
            {row.original.material?.name || row.original.product?.name || '—'}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'batchType',
      header: 'Stage',
      cell: ({ row }) => (
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
            getStageBadge(row.original.batchType),
          )}
        >
          {row.original.batchType}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status
        const isProg = s === 'IN_PROGRESS' || s === 'OPEN'
        return (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              isProg ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-700',
            )}
          >
            {isProg ? 'In progress' : s}
          </span>
        )
      },
    },
    {
      accessorKey: 'qtyRemaining',
      header: 'Qty Remaining',
      cell: ({ row }) => (
        <span className="tabular-nums font-medium text-sm">
          {Number(row.original.qtyRemaining).toLocaleString()} {row.original.uom || 'kg'}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--ink-muted)]">
          {formatCreatedAt(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => {
        const b = row.original
        const stageMap: Record<string, string> = {
          CRUSH: 'crushing',
          WASH: 'washing',
          DRY: 'drying',
          SORT: 'sorting',
        }
        const stageUrl = stageMap[b.batchType] ? `/process/${stageMap[b.batchType]}?batch=${b.batchNumber}` : `/batches/${b.batchNumber}`
        return (
          <Button variant="ghost" size="sm" className="h-7 text-xs font-medium shrink-0" asChild>
            <Link to={stageUrl} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span>Open</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
            </Link>
          </Button>
        )
      },
    },
  ], [])

  return (
    <div className="space-y-6">
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

        {(canQc || canBatchCreate) && (
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

      {/* Fast Actions Bar */}
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

      {/* QC Queue Callout (if items pending) */}
      {(canQc || canBatchCreate) && (qcQueueQuery.data || []).length > 0 && (
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
                    {item.product?.name || item.material?.name || item.batchType} · {Number(item.qtyOut).toLocaleString()} {item.uom}
                  </p>
                </div>
                <Button size="sm" variant="default" className="h-7 text-xs" asChild>
                  <Link to={`/qc?batch=${item.batchNumber}`}>Inspect</Link>
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Live Floor Batches Table */}
      {canBatchView && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Active Operations &amp; Recent Batches</h2>
              <p className="text-xs text-muted-foreground">
                Recent lots moving through processing stages
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs font-medium shrink-0" asChild>
              <Link to="/batches" className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span>All Batches</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </Link>
            </Button>
          </div>

          <CustomTable1
            data={batchList.slice(0, 5)}
            columns={batchColumns}
            filter={false}
            pagination={false}
            loading={batchesQuery.isLoading}
          />
        </div>
      )}
    </div>
  )
}
