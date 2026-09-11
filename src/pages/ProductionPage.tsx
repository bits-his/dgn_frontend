import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  Search,
  Eye,
  ExternalLink,
  UserCheck,
  Wrench,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTable1 from '@/components/CustomTable1'
import { api } from '@/lib/api'
import { Card } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type MasterItem = {
  id: number
  name: string
  code?: string
  isActive?: boolean
}

export type ShiftLogItem = {
  id: number
  productionRunId: number
  machineId: number
  shiftId: number | null
  operatorId: number | null
  operatorName: string
  clockInAt: string
  clockOutAt: string | null
  status: 'ACTIVE' | 'COMPLETED'
  runtimeMinutes: number
  downtimeMinutes: number
  qtyGood: string | number
  qtyReject: string | number
  materialConsumed: string | number
  handoverNotes: string | null
  shift?: { id: number; name: string; code: string }
}

export type FaultLogItem = {
  id: number
  productionRunId: number
  productionShiftLogId: number | null
  machineId: number
  shiftId: number | null
  operatorName: string
  category: string
  downtimeMinutes: number
  startTime: string | null
  endTime: string | null
  rootCause: string | null
  actionTaken: string | null
  createdAt: string
  shift?: { id: number; name: string }
}

type ProductionRunRow = {
  id: number
  batchId: number
  machineId: number
  productId: number
  inputBatchId: number
  shiftId: number | null
  operatorName: string | null
  materialConsumed: string | number
  qtyProduced: string | number
  qtyGood: string | number
  qtyReject: string | number
  uom: string
  runtimeMinutes: number
  downtimeMinutes: number
  downtimeReason: string | null
  scheduledMinutes: number
  yieldPercent: string | number
  rejectPercent: string | number
  outputPerHour: string | number
  materialPerUnit: string | number
  materialVariance: string | number
  availabilityPercent: string | number
  performancePercent: string | number
  qualityPercent: string | number
  oeePercent: string | number
  labourCost: string | number
  energyCost: string | number
  otherCost: string | number
  startedAt: string | null
  endedAt: string | null
  notes: string | null
  createdAt: string
  batch?: {
    id: number
    batchNumber: string
    batchType: string
    status: string
    qtyIn: string | number
    qtyOut: string | number
    qtyRemaining: string | number
    uom: string
  }
  inputBatch?: {
    id: number
    batchNumber: string
    material?: { name: string }
  }
  machine?: {
    id: number
    name: string
    code: string
  }
  product?: {
    id: number
    name: string
    code: string
    uom: string
  }
  shift?: {
    id: number
    name: string
    code: string
  }
  shiftLogs?: ShiftLogItem[]
  faultLogs?: FaultLogItem[]
}

function fmt(value: string | number | null | undefined, digits = 0) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: digits })
    : String(value)
}

export function ProductionPage() {
  // Search & filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL')
  const [machineFilter, setMachineFilter] = useState('')

  // Queries
  const machines = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const { data } = await api.get('/machines')
      return (data.data || []) as MasterItem[]
    },
  })

  const runsQuery = useQuery({
    queryKey: ['production-runs'],
    queryFn: async () => {
      const { data } = await api.get('/production/runs')
      return (data.data || []) as ProductionRunRow[]
    },
    refetchInterval: 15_000,
  })

  const runs = runsQuery.data || []

  // Run Table Columns
  const runColumns: ColumnDef<ProductionRunRow>[] = useMemo(
    () => [
      {
        id: 'batchNumber',
        header: 'Batch #',
        accessorKey: 'batch.batchNumber',
        cell: ({ row }) => {
          const run = row.original
          const isRunning = row.original.batch?.status === 'IN_PROGRESS'
          return (
            <div className="min-w-[130px] whitespace-nowrap">
              <Link
                to={`/batches/${run.batch?.batchNumber}`}
                className="font-semibold text-xs text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1 font-mono"
              >
                {run.batch?.batchNumber || `RUN-${run.id}`}
                <ExternalLink className="size-3 text-zinc-400" />
              </Link>
              {run.inputBatch?.batchNumber && (
                <p className="text-[10px] text-zinc-400">
                  from {run.inputBatch.batchNumber}
                </p>
              )}
              {isRunning ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200 mt-0.5">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  In progress
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200 mt-0.5">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  Completed
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: 'startedAt',
        header: 'Date & Time',
        cell: ({ row }) => {
          const dateVal = row.original.startedAt || row.original.createdAt
          if (!dateVal) return <span className="text-xs text-zinc-400">—</span>
          const d = new Date(dateVal)
          const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          return (
            <div className="text-xs tabular-nums leading-tight whitespace-nowrap">
              <p className="font-medium text-zinc-800">{dateStr}</p>
              <p className="text-[11px] text-zinc-400">{timeStr}</p>
            </div>
          )
        },
      },
      {
        id: 'machine',
        header: 'Machine',
        cell: ({ row }) => {
          const m = row.original.machine
          const isRunning = row.original.batch?.status === 'IN_PROGRESS'
          const oee = Number(row.original.oeePercent || 0)
          return (
            <div className="space-y-1 min-w-[100px]">
              <div>
                <p className="font-semibold text-xs text-zinc-800">{m?.name || '—'}</p>
                {m?.code && <p className="text-[10px] text-zinc-400 font-mono">{m.code}</p>}
              </div>
              {!isRunning && oee > 0 && (
                <div>
                  <span
                    className={`inline-flex rounded px-1.5 py-0.2 text-[10px] font-bold ${
                      oee >= 80
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : oee >= 60
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    OEE: {oee}%
                  </span>
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'product',
        header: 'Product',
        cell: ({ row }) => (
          <span className="font-medium text-xs text-zinc-800">
            {row.original.product?.name || '—'}
          </span>
        ),
      },
      {
        id: 'shift',
        header: 'Shift & Operator',
        cell: ({ row }) => {
          const run = row.original
          const isRunning = run.batch?.status === 'IN_PROGRESS'
          const activeShift = run.shiftLogs?.find((s) => s.status === 'ACTIVE')

          if (isRunning) {
            if (activeShift) {
              const clockInFormatted = new Date(activeShift.clockInAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
              return (
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{activeShift.operatorName}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <span className="font-semibold text-zinc-700">{activeShift.shift?.name || 'On Shift'}</span>
                    <span>•</span>
                    <span>Clocked in {clockInFormatted}</span>
                  </div>
                </div>
              )
            }
            return (
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                  <UserCheck className="size-3 text-amber-600" />
                  No Active Operator
                </span>
                {run.shiftLogs && run.shiftLogs.length > 0 && (
                  <p className="text-[10px] text-zinc-400">
                    {run.shiftLogs.length} previous shift{run.shiftLogs.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )
          }

          // Completed run
          const shiftsCount = run.shiftLogs?.length || 0
          return (
            <div>
              <p className="font-medium text-xs text-zinc-800">{run.operatorName || '—'}</p>
              {shiftsCount > 1 ? (
                <span className="inline-block mt-0.5 rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-semibold text-blue-700 border border-blue-200">
                  {shiftsCount} operators / shifts
                </span>
              ) : run.shift?.name ? (
                <span className="inline-block mt-0.5 rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-medium text-zinc-600 border border-zinc-200/60">
                  {run.shift.name}
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'materialConsumed',
        header: 'Material (kg)',
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold text-xs text-zinc-800">
            {fmt(row.original.materialConsumed, 1)} kg
          </span>
        ),
      },
      {
        id: 'output',
        header: 'Output (Good / Reject)',
        cell: ({ row }) => {
          const run = row.original
          const isRunning = run.batch?.status === 'IN_PROGRESS'
          const goodPcs = Number(run.qtyGood || 0)
          const rejectPcs = Number(run.qtyReject || 0)

          if (isRunning) {
            if (goodPcs > 0 || rejectPcs > 0) {
              return (
                <div className="tabular-nums text-xs">
                  <div className="flex items-center gap-1 text-emerald-700 font-bold">
                    <span>{fmt(goodPcs)} good</span>
                    <span className="text-zinc-400 font-normal">so far</span>
                  </div>
                  {rejectPcs > 0 && (
                    <p className="text-[10px] text-red-600 font-medium">({fmt(rejectPcs)} scrap)</p>
                  )}
                  {goodPcs >= 12 && (
                    <p className="text-[10px] text-zinc-400">
                      {Math.floor(goodPcs / 12)} dz{goodPcs % 12 > 0 ? ` ${goodPcs % 12} pcs` : ''}
                    </p>
                  )}
                </div>
              )
            }
            return <span className="text-[11px] text-amber-700 font-medium italic">Running…</span>
          }

          return (
            <div className="tabular-nums text-xs">
              <span className="font-semibold text-emerald-700">
                {fmt(run.qtyGood)} {run.uom || 'pcs'}
              </span>
              {rejectPcs > 0 && (
                <span className="ml-1 text-[11px] text-red-600 font-medium">
                  ({fmt(run.qtyReject)} scrap)
                </span>
              )}
              {goodPcs >= 12 && (
                <p className="text-[10px] text-zinc-400 font-medium">
                  {Math.floor(goodPcs / 12)} dz{goodPcs % 12 > 0 ? ` ${goodPcs % 12} pcs` : ''}
                </p>
              )}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const run = row.original
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs font-semibold gap-1.5"
                asChild
              >
                <Link to={`/batches/${run.batch?.batchNumber}`}>
                  <Eye className="size-3.5 shrink-0" />
                  <span>View</span>
                </Link>
              </Button>
              <Button
                size="sm"
                className="h-8 px-2.5 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                asChild
              >
                <Link to={`/production/${run.id}/work`}>
                  <Wrench className="size-3.5 shrink-0" />
                  <span>Work & Logs</span>
                </Link>
              </Button>
            </div>
          )
        },
      },
    ],
    []
  )

  // Filtered runs
  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      const batchStatus = r.batch?.status || 'COMPLETED'
      if (statusFilter === 'IN_PROGRESS' && batchStatus !== 'IN_PROGRESS') return false
      if (statusFilter === 'COMPLETED' && batchStatus === 'IN_PROGRESS') return false
      if (machineFilter && String(r.machineId) !== machineFilter) return false

      if (!search) return true
      const q = search.toLowerCase()
      const bNum = r.batch?.batchNumber?.toLowerCase() || ''
      const mName = r.machine?.name?.toLowerCase() || ''
      const pName = r.product?.name?.toLowerCase() || ''
      const op = r.operatorName?.toLowerCase() || ''
      return bNum.includes(q) || mName.includes(q) || pName.includes(q) || op.includes(q)
    })
  }, [runs, statusFilter, machineFilter, search])

  // Summary Metrics
  const metricsSummary = useMemo(() => {
    const inProgressCount = runs.filter((r) => r.batch?.status === 'IN_PROGRESS').length
    const completedRuns = runs.filter((r) => r.batch?.status !== 'IN_PROGRESS')
    const totalProduced = runs.reduce((sum, r) => sum + Number(r.qtyGood || 0), 0)
    const totalConsumed = runs.reduce((sum, r) => sum + Number(r.materialConsumed || 0), 0)

    const completedWithOee = completedRuns.filter((r) => Number(r.oeePercent || 0) > 0)
    const avgOee =
      completedWithOee.length > 0
        ? +(
            completedWithOee.reduce((sum, r) => sum + Number(r.oeePercent || 0), 0) /
            completedWithOee.length
          ).toFixed(1)
        : 0

    return {
      inProgressCount,
      totalProduced,
      totalConsumed,
      avgOee,
    }
  }, [runs])

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-2">
          <span>Production</span>
          {metricsSummary.inProgressCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
              {metricsSummary.inProgressCount} active on machines
            </span>
          )}
        </div>
      }
      description="Monitor active machine execution, track operator shift hours and outputs, log machine faults, and view operator scorecards."
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Compact Horizontal Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Active Runs
            </p>
            <p className="text-base font-bold text-amber-800">
              {metricsSummary.inProgressCount} on floor
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Total Good Output
            </p>
            <p className="text-base font-bold text-emerald-700">
              {fmt(metricsSummary.totalProduced)} pcs
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Material Consumed
            </p>
            <p className="text-base font-bold text-zinc-800">
              {fmt(metricsSummary.totalConsumed, 1)} kg
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white px-3.5 py-2 shadow-2xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Average OEE
            </p>
            <p className="text-base font-bold text-zinc-900">
              {metricsSummary.avgOee > 0 ? `${metricsSummary.avgOee}%` : '—'}
            </p>
          </div>
        </div>

        {/* The Table inside a structured Card with embedded Search & Filters */}
        <Card className="!p-0 overflow-hidden shadow-xs border border-zinc-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2.5 sm:p-3 border-b border-zinc-200/80 bg-zinc-50/70">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <Input
                type="text"
                className="pl-8 h-8 text-xs bg-white"
                placeholder="Search batch, machine, operator…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val as 'ALL' | 'IN_PROGRESS' | 'COMPLETED')}
              >
                <SelectTrigger className="w-full sm:w-[145px] h-8 text-xs bg-white font-medium">
                  <SelectValue placeholder="All status">
                    {statusFilter === 'ALL' && 'All Status'}
                    {statusFilter === 'IN_PROGRESS' && (
                      <span className="flex items-center gap-1.5">
                        <span>In Progress</span>
                        {metricsSummary.inProgressCount > 0 && (
                          <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                            {metricsSummary.inProgressCount}
                          </span>
                        )}
                      </span>
                    )}
                    {statusFilter === 'COMPLETED' && 'Completed'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="IN_PROGRESS">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>In Progress</span>
                      {metricsSummary.inProgressCount > 0 && (
                        <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                          {metricsSummary.inProgressCount}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={machineFilter || 'ALL'}
                onValueChange={(val) => setMachineFilter(val === 'ALL' ? '' : val)}
              >
                <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs bg-white font-medium">
                  <SelectValue placeholder="All machines">
                    {!machineFilter || machineFilter === 'ALL'
                      ? 'All machines'
                      : machines.data?.find((m) => String(m.id) === String(machineFilter))?.name || 'All machines'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All machines</SelectItem>
                  {machines.data?.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CustomTable1
            data={filteredRuns}
            columns={runColumns}
            loading={runsQuery.isLoading}
            card={true}
          />
        </Card>
      </div>
    </PageLayout>
  )
}
