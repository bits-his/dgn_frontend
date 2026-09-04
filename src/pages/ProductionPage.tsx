import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock,
  Search,
  Eye,
  Plus,
  X,
  Play,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field } from '@/components/ui'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/lib/auth'

type MasterItem = {
  id: number
  name: string
  code?: string
  uom?: string
  startTime?: string
  endTime?: string
}

type InputBatch = {
  id: number
  batchNumber: string
  batchType: string
  qtyRemaining: number | string
  uom: string
  material?: { name: string }
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
}

type IssueFormValues = {
  machineId: string
  productId: string
  inputBatchNumber: string
  shiftId: string
  operatorName: string
  materialConsumed: string
  notes: string
}

function fmt(value: string | number | null | undefined, digits = 0) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: digits })
    : String(value)
}

function formatDateTime(raw?: string | null) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ProductionPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canCreate = hasPermission(user, 'production.create')

  // Search & filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL')
  const [machineFilter, setMachineFilter] = useState('')

  // Modal states
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
  const [serverError, setServerError] = useState('')

  // Queries
  const machines = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const { data } = await api.get('/masters/machines')
      return (data.data || []) as MasterItem[]
    },
  })

  const products = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get('/masters/products')
      return (data.data || []) as MasterItem[]
    },
  })

  const shifts = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data } = await api.get('/masters/shifts')
      return (data.data || []) as MasterItem[]
    },
  })

  const staff = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data } = await api.get('/masters/employees')
      return (data.data || []) as Array<{
        id: number
        firstname?: string
        lastname?: string
        employeeCode?: string
      }>
    },
  })

  const inputs = useQuery({
    queryKey: ['production-inputs'],
    queryFn: async () => {
      const { data } = await api.get('/production/inputs')
      return (data.data || []) as InputBatch[]
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

  // Issue Material Form
  const issueForm = useForm<IssueFormValues>({
    defaultValues: {
      machineId: '',
      productId: '',
      inputBatchNumber: '',
      shiftId: '',
      operatorName: '',
      materialConsumed: '',
      notes: '',
    },
  })

  const runs = runsQuery.data || []

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

    return { inProgressCount, totalProduced, totalConsumed, avgOee }
  }, [runs])

  const handleOpenIssueModal = () => {
    setServerError('')
    const defaultShift = shifts.data?.[0]?.id ? String(shifts.data[0].id) : ''
    issueForm.reset({
      machineId: '',
      productId: '',
      inputBatchNumber: '',
      shiftId: defaultShift,
      operatorName: '',
      materialConsumed: '',
      notes: '',
    })
    setIsIssueModalOpen(true)
  }

  const handleStartRun = async (values: IssueFormValues) => {
    setServerError('')
    try {
      await api.post('/production/runs/start', {
        machineId: Number(values.machineId),
        productId: Number(values.productId),
        inputBatchNumber: values.inputBatchNumber,
        shiftId: values.shiftId ? Number(values.shiftId) : null,
        operatorName: values.operatorName || null,
        materialConsumed: Number(values.materialConsumed),
        notes: values.notes || null,
      })
      await queryClient.invalidateQueries({ queryKey: ['production-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
      setIsIssueModalOpen(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; errors?: Record<string, string> } } }
      const res = axiosErr.response?.data
      if (res?.errors) {
        setServerError(Object.values(res.errors).join(' · '))
      } else {
        setServerError(res?.err || 'Failed to issue material and start run')
      }
    }
  }

  const selectedInputBatch = inputs.data?.find(
    (b) => b.batchNumber === issueForm.watch('inputBatchNumber')
  )

  return (
    <div className="space-y-4">
      {/* 1. Ultra-Compact Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
              Production
            </h1>
            {metricsSummary.inProgressCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                {metricsSummary.inProgressCount} active on floor
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Issue material to operators, track live machine runs, and close finished batches.
          </p>
        </div>

        {/* Action Button: Issue Material (Modal) + link for 1-step */}
        <div className="flex items-center gap-2">
          {canCreate && (
            <>
              <button
                type="button"
                onClick={handleOpenIssueModal}
                className="dgn-btn dgn-btn-primary flex items-center gap-1.5 !px-3.5 !py-1.5 text-xs font-semibold shadow-xs"
              >
                <Plus className="size-3.5" />
                Issue Material (Start Run)
              </button>
              <Link
                to="/production/new"
                className="dgn-btn dgn-btn-secondary !px-2.5 !py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                title="Record completed run in one step"
              >
                1-Step Record
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 2. Compact Horizontal Stats Ribbon */}
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

      {/* 3. The Table inside a beautiful, structured Card with embedded Search & Filters */}
      <Card className="!p-0 overflow-hidden shadow-xs border border-zinc-200">
        {/* Card Header Toolbar with Search and Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 border-b border-zinc-200/80 bg-zinc-50/70">
          {/* Status Segment Control */}
          <div className="inline-flex rounded-lg bg-zinc-200/70 p-0.5 text-xs font-semibold">
            {(['ALL', 'IN_PROGRESS', 'COMPLETED'] as const).map((tab) => {
              const active = statusFilter === tab
              const labels = {
                ALL: 'All',
                IN_PROGRESS: 'In Progress',
                COMPLETED: 'Completed',
              }
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                    active
                      ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {labels[tab]}
                  {tab === 'IN_PROGRESS' && metricsSummary.inProgressCount > 0 && (
                    <span className="ml-1 rounded-full bg-amber-500 px-1 py-0.2 text-[10px] text-white">
                      {metricsSummary.inProgressCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search Input and Machine Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                className="dgn-input !h-8 pl-8 text-xs bg-white"
                placeholder="Search batch, machine, operator…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="dgn-input !h-8 text-xs bg-white w-36"
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
            >
              <option value="">All machines</option>
              {machines.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] text-zinc-500 uppercase tracking-wider">
                <th className="px-3.5 py-2.5 font-bold">Batch #</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5 font-bold">Machine</th>
                <th className="px-3 py-2.5 font-bold">Product</th>
                <th className="px-3 py-2.5 font-bold">Shift & Operator</th>
                <th className="px-3 py-2.5 font-bold text-right">Material (kg)</th>
                <th className="px-3 py-2.5 font-bold text-right">Output (Good / Reject)</th>
                <th className="px-3 py-2.5 font-bold text-center">OEE</th>
                <th className="px-3 py-2.5 font-bold">Date</th>
                <th className="px-3.5 py-2.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runsQuery.isLoading && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="size-5 animate-spin text-[var(--accent)]" />
                      <span className="text-xs">Loading production runs…</span>
                    </div>
                  </td>
                </tr>
              )}

              {!runsQuery.isLoading && filteredRuns.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-zinc-500">
                    <p className="font-semibold text-zinc-700">No production runs found.</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {statusFilter === 'IN_PROGRESS'
                        ? 'No active runs on the floor right now. Click "Issue Material" above to start one.'
                        : 'Start a run by clicking "Issue Material (Start Run)" above.'}
                    </p>
                  </td>
                </tr>
              )}

              {!runsQuery.isLoading &&
                filteredRuns.map((run) => {
                  const isRunning = run.batch?.status === 'IN_PROGRESS'
                  const oee = Number(run.oeePercent || 0)
                  return (
                    <tr
                      key={run.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors"
                    >
                      {/* Batch # */}
                      <td className="px-3.5 py-2.5">
                        <Link
                          to={`/batches/${run.batch?.batchNumber}`}
                          className="font-bold text-[var(--accent-strong)] hover:underline text-left text-xs inline-block"
                        >
                          {run.batch?.batchNumber || `RUN-${run.id}`}
                        </Link>
                        {run.inputBatch?.batchNumber && (
                          <p className="text-[10px] text-zinc-400">
                            from {run.inputBatch.batchNumber}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                            In progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            Completed
                          </span>
                        )}
                      </td>

                      {/* Machine */}
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-xs text-zinc-800">
                          {run.machine?.name || '—'}
                        </p>
                        {run.machine?.code && (
                          <p className="text-[10px] text-zinc-400">{run.machine.code}</p>
                        )}
                      </td>

                      {/* Product */}
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-xs text-zinc-800">
                          {run.product?.name || '—'}
                        </span>
                      </td>

                      {/* Shift & Operator */}
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-xs text-zinc-800">
                          {run.operatorName || '—'}
                        </p>
                        {run.shift?.name && (
                          <span className="inline-block mt-0.5 rounded bg-zinc-100 px-1 py-0.2 text-[10px] font-semibold text-zinc-600">
                            {run.shift.name}
                          </span>
                        )}
                      </td>

                      {/* Material Issued */}
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-xs text-zinc-800">
                        {fmt(run.materialConsumed, 1)} kg
                      </td>

                      {/* Output (Good / Reject) */}
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs">
                        {isRunning ? (
                          <span className="text-[11px] text-amber-700 font-medium italic">
                            Running…
                          </span>
                        ) : (
                          <div>
                            <span className="font-bold text-emerald-700">
                              {fmt(run.qtyGood)} {run.uom || 'pcs'}
                            </span>
                            {Number(run.qtyReject || 0) > 0 && (
                              <span className="ml-1 text-[11px] text-red-600 font-medium">
                                ({fmt(run.qtyReject)} rej)
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* OEE */}
                      <td className="px-3 py-2.5 text-center">
                        {isRunning ? (
                          <span className="text-xs text-zinc-400">—</span>
                        ) : (
                          <span
                            className={`inline-flex rounded-md px-1.5 py-0.2 text-[11px] font-bold ${
                              oee >= 80
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : oee >= 60
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {oee > 0 ? `${oee}%` : '—'}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2.5 text-[11px] text-zinc-500 tabular-nums">
                        {formatDateTime(run.startedAt || run.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/batches/${run.batch?.batchNumber}`}
                            className="dgn-btn dgn-btn-secondary !px-2 !py-1 text-xs font-semibold flex items-center gap-1"
                          >
                            <Eye className="size-3" />
                            View
                          </Link>

                          {isRunning && canCreate && (
                            <Link
                              to={`/production/${run.id}/complete`}
                              className="dgn-btn dgn-btn-primary !px-2 !py-1 text-xs font-semibold flex items-center gap-1 shadow-2xs"
                            >
                              <CheckCircle2 className="size-3" />
                              Complete
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL: RECORD ISSUING OF MATERIAL & OPERATOR */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                  <Play className="size-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900">Issue Material to Operator</h2>
                  <p className="text-[11px] text-zinc-500">
                    Give raw material to the operator to begin the machine run.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => setIsIssueModalOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>

            {serverError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700 border border-red-200">
                {serverError}
              </div>
            )}

            <form
              className="mt-3.5 space-y-3.5"
              onSubmit={issueForm.handleSubmit((vals) => handleStartRun(vals))}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Machine">
                  <select
                    className="dgn-input text-xs"
                    {...issueForm.register('machineId', { required: true })}
                  >
                    <option value="">Select machine</option>
                    {machines.data?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Product">
                  <select
                    className="dgn-input text-xs"
                    {...issueForm.register('productId', { required: true })}
                  >
                    <option value="">Select product</option>
                    {products.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.uom || 'pcs'})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Shift">
                  <select className="dgn-input text-xs" {...issueForm.register('shiftId')}>
                    <option value="">Select shift</option>
                    {shifts.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.startTime || ''} - {s.endTime || ''})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Operator assigned">
                  <select className="dgn-input text-xs" {...issueForm.register('operatorName')}>
                    <option value="">Select staff</option>
                    {(staff.data || []).map((e) => {
                      const name =
                        `${e.firstname || ''} ${e.lastname || ''}`.trim() ||
                        e.employeeCode ||
                        `Staff ${e.id}`
                      return (
                        <option key={e.id} value={name}>
                          {name} {e.employeeCode ? `(${e.employeeCode})` : ''}
                        </option>
                      )
                    })}
                  </select>
                </Field>
              </div>

              {/* Material Input selection & quantity */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 space-y-2.5">
                <Field label="Dried Material Batch (Input)">
                  <select
                    className="dgn-input text-xs"
                    {...issueForm.register('inputBatchNumber', { required: true })}
                  >
                    <option value="">Choose dried batch</option>
                    {inputs.data?.map((b) => (
                      <option key={b.id} value={b.batchNumber}>
                        {b.batchNumber} · {b.material?.name || b.batchType} ·{' '}
                        {fmt(b.qtyRemaining, 1)} {b.uom} left
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Material Issued (kg)">
                  <input
                    inputMode="decimal"
                    type="number"
                    step="any"
                    placeholder="e.g. 100"
                    className="dgn-input text-xs font-semibold"
                    {...issueForm.register('materialConsumed', { required: true })}
                  />
                </Field>

                {selectedInputBatch && (
                  <p className="text-[11px] text-zinc-500">
                    Selected batch: <strong>{selectedInputBatch.batchNumber}</strong> · Available:{' '}
                    <strong>{selectedInputBatch.qtyRemaining} kg</strong>
                  </p>
                )}
              </div>

              <Field label="Notes / Machine Setup Instructions">
                <textarea
                  rows={2}
                  className="dgn-input text-xs"
                  placeholder="e.g. Started batch with clean mould, shift note..."
                  {...issueForm.register('notes')}
                />
              </Field>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <Link
                  to="/production/new"
                  className="text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                >
                  Or record completed run (1-step)
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="dgn-btn dgn-btn-ghost text-xs"
                    onClick={() => setIsIssueModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={issueForm.formState.isSubmitting}
                    className="dgn-btn dgn-btn-primary text-xs flex items-center gap-1.5"
                  >
                    <Play className="size-3.5" />
                    {issueForm.formState.isSubmitting ? 'Issuing…' : 'Start Run & Issue Material'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
