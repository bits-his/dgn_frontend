import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock,
  Search,
  Eye,
  Plus,
  Play,
  ExternalLink,
  Palette,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTable1 from '@/components/CustomTable1'
import { api } from '@/lib/api'
import { Card, Field } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
} from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useAuthStore } from '@/stores/auth-store'
import { hasPermission } from '@/lib/auth'
import { SORT_COLORS } from '@/lib/sortColors'

function colorName(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

type MasterItem = {
  id: number
  name: string
  code?: string
  uom?: string
  machineType?: string
  startTime?: string
  endTime?: string
}

type InputBatch = {
  id: number
  batchNumber: string
  batchType: string
  qtyRemaining: number | string
  uom: string
  sortColor?: string | null
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
  masterbatchColor?: string
  masterbatchKg?: string
  normalColorName?: string
  pigmentKg?: string
  colorCost?: string
  colorType?: 'normal' | 'master' | 'both'
  colorName?: string
  colorNotes?: string
}

function fmt(value: string | number | null | undefined, digits = 0) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: digits })
    : String(value)
}


function getCurrentTimeString(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function getTimeMinusMinutes(minutes: number, baseDate = new Date()): string {
  const d = new Date(baseDate.getTime() - minutes * 60 * 1000)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function calculateMinutesBetween(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return 0

  let diff = eh * 60 + em - (sh * 60 + sm)
  if (diff < 0) {
    diff += 24 * 60
  }
  return diff
}

export function ProductionPage() {
  const navigate = useNavigate()
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

  // Downtime modal states
  const [downtimeRun, setDowntimeRun] = useState<ProductionRunRow | null>(null)
  const [downtimeFrom, setDowntimeFrom] = useState<string>('')
  const [downtimeTo, setDowntimeTo] = useState<string>('')
  const [downtimeMinutes, setDowntimeMinutes] = useState<string>('30')
  const [downtimeReason, setDowntimeReason] = useState<string>('Power Outage / Generator switch')
  const [customReason, setCustomReason] = useState<string>('')
  const [downtimeNotes, setDowntimeNotes] = useState<string>('')
  const [isSubmittingDowntime, setIsSubmittingDowntime] = useState(false)
  const [downtimeError, setDowntimeError] = useState('')
  const [downtimeSuccess, setDowntimeSuccess] = useState('')

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
    queryKey: ['masters-employees'],
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

  const storeColors = useQuery({
    queryKey: ['production-store-colors'],
    queryFn: async () => {
      const { data } = await api.get('/production/store/colors')
      return (data.data || { masterbatches: [], normalColors: [] }) as {
        masterbatches: Array<{
          id: number
          batchNumber: string
          colorName: string
          label: string
          type: 'master'
          qtyRemaining: number
          costPerKg: number
          uom: string
        }>
        normalColors: Array<{
          id: number
          batchNumber: string
          colorName: string
          label: string
          type: 'normal'
          qtyRemaining: number
          costPerKg: number
          uom: string
        }>
      }
    },
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
      masterbatchColor: '',
      masterbatchKg: '',
      normalColorName: '',
      pigmentKg: '',
      colorCost: '',
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
      masterbatchColor: '',
      masterbatchKg: '',
      normalColorName: '',
      pigmentKg: '',
      colorCost: '',
    })
    setIsIssueModalOpen(true)
  }

  const handleStartRun = async (values: IssueFormValues) => {
    setServerError('')
    try {
      const mode =
        values.masterbatchColor && values.normalColorName
          ? 'both'
          : values.masterbatchColor
          ? 'master'
          : values.normalColorName
          ? 'normal'
          : undefined

      const normColor = values.normalColorName || null
      const mbColor = values.masterbatchColor || null
      const mbKg = values.masterbatchKg ? Number(values.masterbatchKg) : undefined
      const pigKg = values.pigmentKg ? Number(values.pigmentKg) : undefined
      const totalAdditiveCost = Number(values.colorCost || 0) || undefined

      const colorParts = []
      if (values.normalColorName) colorParts.push(`${values.normalColorName} (Normal${pigKg ? ` ${pigKg}kg` : ''})`)
      if (values.masterbatchColor) colorParts.push(`${values.masterbatchColor} (MB${mbKg ? ` ${mbKg}kg` : ''})`)
      const finalColorName = colorParts.join(' + ') || null

      await api.post('/production/runs/start', {
        machineId: Number(values.machineId),
        productId: Number(values.productId),
        inputBatchNumber: values.inputBatchNumber,
        shiftId: values.shiftId ? Number(values.shiftId) : null,
        operatorName: values.operatorName || null,
        materialConsumed: Number(values.materialConsumed),
        notes: values.notes || null,
        colorType: mode,
        colorName: finalColorName,
        normalColorName: normColor,
        masterbatchColor: mbColor,
        masterbatchKg: mbKg,
        colorCost: totalAdditiveCost,
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

  const handleOpenDowntimeModal = (run: ProductionRunRow) => {
    setDowntimeRun(run)
    const to = getCurrentTimeString()
    const from = getTimeMinusMinutes(30)
    setDowntimeFrom(from)
    setDowntimeTo(to)
    setDowntimeMinutes('30')
    setDowntimeReason('Power Outage / Generator switch')
    setCustomReason('')
    setDowntimeNotes('')
    setDowntimeError('')
    setDowntimeSuccess('')
  }

  const handleDowntimeTimeChange = (from: string, to: string) => {
    setDowntimeFrom(from)
    setDowntimeTo(to)
    if (from && to) {
      const diff = calculateMinutesBetween(from, to)
      setDowntimeMinutes(String(diff))
    }
  }

  const handleSelectPresetMinutes = (minsStr: string) => {
    setDowntimeMinutes(minsStr)
    const m = Number(minsStr) || 0
    if (downtimeTo && m > 0) {
      const [eh, em] = downtimeTo.split(':').map(Number)
      if (!Number.isNaN(eh) && !Number.isNaN(em)) {
        let totalMins = eh * 60 + em - m
        if (totalMins < 0) totalMins += 24 * 60
        const sh = String(Math.floor(totalMins / 60)).padStart(2, '0')
        const sm = String(totalMins % 60).padStart(2, '0')
        setDowntimeFrom(`${sh}:${sm}`)
      }
    }
  }

  const handleSaveDowntime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!downtimeRun) return
    const mins = Number(downtimeMinutes)
    if (Number.isNaN(mins) || mins <= 0) {
      setDowntimeError('Please enter valid downtime minutes (greater than 0)')
      return
    }

    const reason = downtimeReason === 'Other' ? customReason.trim() || 'Other' : downtimeReason

    setIsSubmittingDowntime(true)
    setDowntimeError('')
    try {
      await api.post(`/production/runs/${downtimeRun.id}/downtime`, {
        downtimeMinutes: mins,
        downtimeReason: reason,
        notes: downtimeNotes.trim() || undefined,
      })
      await queryClient.invalidateQueries({ queryKey: ['production-runs'] })
      setDowntimeSuccess(`Logged ${mins}m downtime successfully!`)
      setTimeout(() => {
        setDowntimeRun(null)
      }, 900)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; errors?: Record<string, string> } } }
      const msg =
        axiosErr.response?.data?.errors?.downtimeMinutes ||
        axiosErr.response?.data?.err ||
        'Failed to log downtime'
      setDowntimeError(msg)
    } finally {
      setIsSubmittingDowntime(false)
    }
  }

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
{
                isRunning ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                    In progress
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    Completed
                  </span>
                )
}
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
                {m?.code && <p className="text-[10px] text-zinc-400">{m.code}</p>}
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
          return (
            <div>
              <p className="font-medium text-xs text-zinc-800">{run.operatorName || '—'}</p>
              {run.shift?.name && (
                <span className="inline-block mt-0.5 rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-medium text-zinc-600 border border-zinc-200/60">
                  {run.shift.name}
                </span>
              )}
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
          if (isRunning) {
            return <span className="text-[11px] text-amber-700 font-medium italic">Running…</span>
          }
          return (
            <div className="tabular-nums text-xs">
              <span className="font-semibold text-emerald-700">
                {fmt(run.qtyGood)} {run.uom || 'pcs'}
              </span>
              {Number(run.qtyReject || 0) > 0 && (
                <span className="ml-1 text-[11px] text-red-600 font-medium">
                  ({fmt(run.qtyReject)} waste)
                </span>
              )}
              {Number(run.qtyGood || 0) >= 12 && (
                <p className="text-[10px] text-zinc-400 font-medium">
                  {Math.floor(Number(run.qtyGood) / 12)} dz{Number(run.qtyGood) % 12 > 0 ? ` ${Number(run.qtyGood) % 12} pcs` : ''}
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
          const isRunning = run.batch?.status === 'IN_PROGRESS'
          return (
            <div className="flex flex-col gap-1 ">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap"
                asChild
              >
                <Link
                  to={`/batches/${run.batch?.batchNumber}`}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Eye className="size-3.5 shrink-0" />
                  <span>View</span>
                </Link>
              </Button>
              {isRunning && canCreate && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                    onClick={() => handleOpenDowntimeModal(run)}
                  >
                    <Clock className="size-3.5 text-amber-700 shrink-0" />
                    <span>Downtime{Number(run.downtimeMinutes || 0) > 0 ? ` (${run.downtimeMinutes}m)` : ''}</span>
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white"
                    asChild
                  >
                    <Link
                      to={`/production/${run.id}/complete`}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      <span>Complete</span>
                    </Link>
                  </Button>
                </>
              )}
            </div>
          )
        },
      },
    ],
    [canCreate]
  )

  const selectedInputBatch = inputs.data?.find(
    (b) => b.batchNumber === issueForm.watch('inputBatchNumber')
  )

  const productOptions = useMemo(() => {
    return (products.data || []).map((p) => ({
      value: String(p.id),
      label: p.name,
      sublabel: p.code ? `Code: ${p.code}` : undefined,
      badge: p.uom || 'pcs',
    }))
  }, [products.data])

  const machineOptions = useMemo(() => {
    return (machines.data || []).map((m) => ({
      value: String(m.id),
      label: m.name,
      sublabel: m.code ? `Code: ${m.code}` : undefined,
      badge: m.machineType || undefined,
    }))
  }, [machines.data])

  const operatorOptions = useMemo(() => {
    const list = Array.isArray(staff.data)
      ? staff.data
      : Array.isArray((staff.data as any)?.rows)
        ? (staff.data as any).rows
        : Array.isArray((staff.data as any)?.data)
          ? (staff.data as any).data
          : []
    return list.map((e: any) => {
      const name =
        `${e.firstname || ''} ${e.lastname || ''}`.trim() ||
        e.employeeCode ||
        `Staff ${e.id}`
      return {
        value: name,
        label: name,
        sublabel: e.employeeCode ? `Code: ${e.employeeCode}` : undefined,
      }
    })
  }, [staff.data])

  const inputBatchOptions = useMemo(() => {
    return (inputs.data || []).map((b) => ({
      value: b.batchNumber,
      label: `${b.batchNumber} · ${b.material?.name || b.batchType}`,
      sublabel: `${fmt(b.qtyRemaining, 1)} ${b.uom}${b.sortColor ? ` · ${colorName(b.sortColor)}` : ''}`,
      badge: b.batchType,
    }))
  }, [inputs.data])

  const masterbatchOptions = useMemo(() => {
    const list = storeColors.data?.masterbatches || []
    const storeOpts = list.map((m) => ({
      value: m.colorName,
      label: m.colorName,
      sublabel: `${m.costPerKg > 0 ? `₦${m.costPerKg.toLocaleString()}/kg · ` : ''}${m.qtyRemaining}kg in store`,
      badge: 'Store Stock',
    }))
    const existing = new Set(storeOpts.map((x) => x.value.toLowerCase()))
    const presetOpts = SORT_COLORS.filter((c) => !existing.has(c.name.toLowerCase())).map((c) => ({
      value: c.name,
      label: c.name,
      sublabel: 'Standard preset',
    }))
    return [...storeOpts, ...presetOpts]
  }, [storeColors.data?.masterbatches])

  const normalColorOptions = useMemo(() => {
    const list = storeColors.data?.normalColors || []
    const storeOpts = list.map((c) => ({
      value: c.colorName,
      label: c.colorName,
      sublabel: `${c.costPerKg > 0 ? `₦${c.costPerKg.toLocaleString()}/kg · ` : ''}${c.qtyRemaining}kg in store`,
      badge: 'Store Stock',
    }))
    const existing = new Set(storeOpts.map((x) => x.value.toLowerCase()))
    const presetOpts = SORT_COLORS.filter((c) => !existing.has(c.name.toLowerCase())).map((c) => ({
      value: c.name,
      label: c.name,
      sublabel: 'Standard preset',
    }))
    return [...storeOpts, ...presetOpts]
  }, [storeColors.data?.normalColors])

  const watchNormalColorName = issueForm.watch('normalColorName') || ''
  const watchMasterbatchColor = issueForm.watch('masterbatchColor') || ''
  const watchMasterbatchKg = issueForm.watch('masterbatchKg') || ''
  const watchPigmentKg = issueForm.watch('pigmentKg') || ''

  const selectedMb = useMemo(() => {
    return storeColors.data?.masterbatches?.find(
      (m) => m.colorName.toLowerCase() === watchMasterbatchColor.toLowerCase()
    )
  }, [storeColors.data?.masterbatches, watchMasterbatchColor])

  const selectedNormal = useMemo(() => {
    return storeColors.data?.normalColors?.find(
      (n) => n.colorName.toLowerCase() === watchNormalColorName.toLowerCase()
    )
  }, [storeColors.data?.normalColors, watchNormalColorName])

  // Auto-calculate additive cost based on store prices
  useEffect(() => {
    const mbKg = Number(watchMasterbatchKg || 0)
    const normKg = Number(watchPigmentKg || 0)
    const mbPrice = Number(selectedMb?.costPerKg || 0)
    const normPrice = Number(selectedNormal?.costPerKg || 0)
    const total = Math.round(mbKg * mbPrice + normKg * normPrice)
    if (total > 0) {
      issueForm.setValue('colorCost', String(total))
    }
  }, [selectedMb, selectedNormal, watchMasterbatchKg, watchPigmentKg, issueForm])

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-2">
          <span>Production Runs</span>
          {metricsSummary.inProgressCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
              {metricsSummary.inProgressCount} active
            </span>
          )}
        </div>
      }
      description="Monitor machine execution, issue raw material to shifts, and record outputs."
      actions={
        canCreate ? (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              onClick={handleOpenIssueModal}
              className="gap-1.5 font-semibold"
            >
              <Plus className="size-4" />
              <span>Issue Material<span className="hidden sm:inline"> (Start Run)</span></span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/production/new')}
              className="font-semibold"
            >
              1-Step Record
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-3 sm:space-y-4">

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2.5 sm:p-3 border-b border-zinc-200/80 bg-zinc-50/70">
          {/* Search Input (less rounded, shadcn Input) */}
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

          {/* Filters: Status Select and Machine Select */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
            {/* Status Select (replaces old tab control) */}
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

            {/* Machine Filter Select */}
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
        />
      </Card>

      {/* MODAL: RECORD ISSUING OF MATERIAL & OPERATOR (SHADCN DIALOG) */}
      <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shadow-2xs">
                <Play className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Issue Material to Operator
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  Assign machine, product, raw material lot, and operator to begin the production run.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {serverError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-400">
              {serverError}
            </div>
          )}

          <form
            className="space-y-4 pt-1"
            onSubmit={issueForm.handleSubmit((vals) => handleStartRun(vals))}
          >
            {/* Machine & Product Row */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Production Machine">
                <SearchableSelect
                  value={issueForm.watch('machineId') || ''}
                  onChange={(val) =>
                    issueForm.setValue('machineId', val, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  options={machineOptions}
                  placeholder="Select machine…"
                  searchPlaceholder="Search machine name or code…"
                />
              </Field>

              <Field label="Product to Produce">
                <SearchableSelect
                  value={issueForm.watch('productId') || ''}
                  onChange={(val) =>
                    issueForm.setValue('productId', val, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  options={productOptions}
                  placeholder="Select product…"
                  searchPlaceholder="Search products by name or code…"
                />
              </Field>
            </div>

            {/* Raw Material Batch & Quantity Row */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Raw Material Batch">
                <SearchableSelect
                  value={issueForm.watch('inputBatchNumber') || ''}
                  onChange={(val) =>
                    issueForm.setValue('inputBatchNumber', val, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  options={inputBatchOptions}
                  placeholder="Select raw material batch…"
                  searchPlaceholder="Search batch number or material…"
                />
              </Field>

              <Field label="Material Issued (kg)">
                <Input
                  inputMode="decimal"
                  type="number"
                  step="any"
                  placeholder="e.g. 100"
                  className="h-9 text-xs font-semibold"
                  {...issueForm.register('materialConsumed', { required: true })}
                />
              </Field>
            </div>

            {/* Selected Batch Preview Card */}
            {selectedInputBatch && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/40 p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Selected Raw Material
                  </span>
                  <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                    {selectedInputBatch.material?.name || selectedInputBatch.batchType || 'Raw Material'}
                    {selectedInputBatch.sortColor ? ` · ${colorName(selectedInputBatch.sortColor)}` : ''}
                  </p>
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Lot #{selectedInputBatch.batchNumber}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Available in Store
                  </span>
                  <p className="text-xl font-black text-emerald-900 dark:text-emerald-100 tabular-nums">
                    {fmt(selectedInputBatch.qtyRemaining, 1)}{' '}
                    <span className="text-xs font-extrabold uppercase">
                      {selectedInputBatch.uom || 'kg'}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Color Formulation Inputs (Masterbatch & Normal Pigment from Production Store) */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/60 p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <Palette className="size-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Color Formulation (Masterbatch & Normal Pigment)
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500">
                  Stocked from Production Store · Unit prices auto-calculate additive cost
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Masterbatch Column */}
                <div className="rounded-lg border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Masterbatch Pellets</span>
                    {selectedMb && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        {selectedMb.costPerKg > 0 ? `₦${selectedMb.costPerKg.toLocaleString()}/kg · ` : ''}{selectedMb.qtyRemaining}kg in store
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-[10px] text-zinc-500 mb-1 block">MB Color</Label>
                      <SearchableSelect
                        size="sm"
                        value={issueForm.watch('masterbatchColor') || ''}
                        onChange={(col) => issueForm.setValue('masterbatchColor', col)}
                        options={masterbatchOptions}
                        placeholder="Select masterbatch…"
                        searchPlaceholder="Search store masterbatches…"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-zinc-500 mb-1 block">MB Qty (kg)</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="0.0"
                        className="h-9 text-xs font-semibold"
                        value={issueForm.watch('masterbatchKg') || ''}
                        onChange={(e) => issueForm.setValue('masterbatchKg', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Normal Pigment Column */}
                <div className="rounded-lg border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Normal Pigment</span>
                    {selectedNormal && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        {selectedNormal.costPerKg > 0 ? `₦${selectedNormal.costPerKg.toLocaleString()}/kg · ` : ''}{selectedNormal.qtyRemaining}kg in store
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-[10px] text-zinc-500 mb-1 block">Normal Color</Label>
                      <SearchableSelect
                        size="sm"
                        value={issueForm.watch('normalColorName') || ''}
                        onChange={(col) => issueForm.setValue('normalColorName', col)}
                        options={normalColorOptions}
                        placeholder="Select normal color…"
                        searchPlaceholder="Search normal pigments…"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-zinc-500 mb-1 block">Pigment Qty (kg)</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="0.0"
                        className="h-9 text-xs font-semibold"
                        value={issueForm.watch('pigmentKg') || ''}
                        onChange={(e) => issueForm.setValue('pigmentKg', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Additive Cost Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200/80 dark:border-zinc-800 text-xs">
                <div className="text-zinc-500 text-[11px]">
                  {Number(issueForm.watch('masterbatchKg') || 0) + Number(issueForm.watch('pigmentKg') || 0) > 0 ? (
                    <span>
                      Total Additive: <strong>{(Number(issueForm.watch('masterbatchKg') || 0) + Number(issueForm.watch('pigmentKg') || 0)).toFixed(2)} kg</strong>
                      {selectedMb && Number(issueForm.watch('masterbatchKg') || 0) > 0 && selectedMb.costPerKg > 0 && (
                        <span> (MB: ₦{(Number(issueForm.watch('masterbatchKg') || 0) * selectedMb.costPerKg).toLocaleString()})</span>
                      )}
                      {selectedNormal && Number(issueForm.watch('pigmentKg') || 0) > 0 && selectedNormal.costPerKg > 0 && (
                        <span> (Pigment: ₦{(Number(issueForm.watch('pigmentKg') || 0) * selectedNormal.costPerKg).toLocaleString()})</span>
                      )}
                    </span>
                  ) : (
                    <span>Enter masterbatch or pigment kg to compute additive cost</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300 text-xs">Additive Cost (₦):</span>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Auto or custom"
                    className="w-32 h-8 text-xs font-bold text-emerald-700 dark:text-emerald-400"
                    value={issueForm.watch('colorCost') || ''}
                    onChange={(e) => issueForm.setValue('colorCost', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Shift & Operator Row */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shift">
                <Select
                  value={issueForm.watch('shiftId')}
                  onValueChange={(val) => issueForm.setValue('shiftId', val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.data?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.startTime || ''} - {s.endTime || ''})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Operator assigned">
                <SearchableSelect
                  value={issueForm.watch('operatorName') || ''}
                  onChange={(val) => issueForm.setValue('operatorName', val)}
                  options={operatorOptions}
                  placeholder="Select staff…"
                  searchPlaceholder="Search staff by name or code…"
                />
              </Field>
            </div>

            <Field label="Notes / Setup Instructions">
              <textarea
                rows={2}
                className="dgn-input text-xs w-full"
                placeholder="Optional machine setup or shift instructions..."
                {...issueForm.register('notes')}
              />
            </Field>

            <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <Link
                to="/production/new"
                className="text-xs font-semibold text-[var(--accent-strong)] hover:underline"
              >
                Or record 1-step run
              </Link>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setIsIssueModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    issueForm.formState.isSubmitting ||
                    !issueForm.watch('machineId') ||
                    !issueForm.watch('productId') ||
                    !issueForm.watch('inputBatchNumber') ||
                    !(Number(issueForm.watch('materialConsumed')) > 0)
                  }
                  className="h-8 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Play className="size-3.5" />
                  {issueForm.formState.isSubmitting ? 'Issuing…' : 'Start Run & Issue'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* MODAL: LOG DOWNTIME ON IN-PROGRESS RUN */}
      {downtimeRun && (
        <Dialog open={Boolean(downtimeRun)} onOpenChange={(open) => !open && setDowntimeRun(null)}>
          <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl shadow-2xl border-zinc-200 dark:border-zinc-800">
            {/* Header with amber accent banner */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-200/60 dark:border-amber-900/40 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30">
                  <Clock className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <span>Log Machine Downtime</span>
                    <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase tracking-wide">
                      Stop event
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {downtimeRun.machine?.name || 'Machine'} · Batch #{downtimeRun.batch?.batchNumber || `RUN-${downtimeRun.id}`}
                    {downtimeRun.operatorName ? ` · Operator: ${downtimeRun.operatorName}` : ''}
                  </DialogDescription>
                </div>
              </div>

              {/* Previously logged downtime banner */}
              {Number(downtimeRun.downtimeMinutes || 0) > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-white/80 dark:bg-zinc-900/80 px-3 py-1.5 text-xs border border-amber-200/80 dark:border-amber-900/60">
                  <span className="text-zinc-500">Previously Recorded:</span>
                  <span className="font-bold text-amber-900 dark:text-amber-200">
                    {downtimeRun.downtimeMinutes}m total{downtimeRun.downtimeReason ? ` (${downtimeRun.downtimeReason})` : ''}
                  </span>
                </div>
              )}
            </div>

            {downtimeSuccess && (
              <div className="mx-5 mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                <span>{downtimeSuccess}</span>
              </div>
            )}

            {downtimeError && (
              <div className="mx-5 mt-4 rounded-lg bg-red-50 dark:bg-red-950/50 p-2.5 text-xs font-medium text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                {downtimeError}
              </div>
            )}

            <form onSubmit={handleSaveDowntime} className="p-5 space-y-4">
              {/* FROM & TO TIME SELECTION */}
              <div>
                <Label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Downtime Period (Stopped At → Resumed At)
                </Label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                      Stopped At
                    </span>
                    <input
                      type="time"
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20"
                      value={downtimeFrom}
                      onChange={(e) => handleDowntimeTimeChange(e.target.value, downtimeTo)}
                      required
                    />
                  </div>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-2.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                      Resumed At
                    </span>
                    <input
                      type="time"
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500/20"
                      value={downtimeTo}
                      onChange={(e) => handleDowntimeTimeChange(downtimeFrom, e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Calculated duration & presets banner */}
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                    Calculated Downtime Duration:
                  </span>
                  <div className="text-right">
                    <span className="text-base font-black text-amber-900 dark:text-amber-300 tabular-nums">
                      {downtimeMinutes} mins
                    </span>
                    {Number(downtimeMinutes) >= 60 && (
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 ml-1.5">
                        ({Math.floor(Number(downtimeMinutes) / 60)}h {Number(downtimeMinutes) % 60}m)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mr-1">
                    Quick presets:
                  </span>
                  {['15', '30', '45', '60', '90', '120'].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleSelectPresetMinutes(mins)}
                      className={`rounded-lg px-2 py-1 text-xs font-bold transition-all ${
                        downtimeMinutes === mins
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-amber-100 dark:hover:bg-amber-950 border border-amber-200 dark:border-amber-800/80'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Categorized Downtime Reason */}
              <div>
                <Label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Reason for Stoppage
                </Label>
                <select
                  className="dgn-input text-xs font-medium"
                  value={downtimeReason}
                  onChange={(e) => setDowntimeReason(e.target.value)}
                >
                  <optgroup label="⚡ Power & Energy">
                    <option value="Power Outage / Generator switch">Power Outage / Generator switch</option>
                    <option value="Voltage Fluctuation / Phase drop">Voltage Fluctuation / Phase drop</option>
                  </optgroup>
                  <optgroup label="⚙️ Mechanical & Tooling">
                    <option value="Mould Jammed / Cleaning">Mould Jammed / Cleaning</option>
                    <option value="Machine Breakdown / Mechanical fault">Machine Breakdown / Mechanical fault</option>
                    <option value="Heater / Temperature issue">Heater / Temperature issue</option>
                    <option value="Hydraulic / Pneumatic issue">Hydraulic / Pneumatic issue</option>
                  </optgroup>
                  <optgroup label="📦 Raw Material & Feed">
                    <option value="Raw Material shortage / feed issue">Raw Material shortage / feed issue</option>
                    <option value="Additive / Color mismatch">Additive / Color mismatch</option>
                  </optgroup>
                  <optgroup label="👥 Operational & Shift">
                    <option value="Operator Break / Shift change">Operator Break / Shift change</option>
                    <option value="Preventive Maintenance">Preventive Maintenance</option>
                    <option value="Other">Other reason…</option>
                  </optgroup>
                </select>
                {downtimeReason === 'Other' && (
                  <Input
                    type="text"
                    className="h-8 text-xs mt-2"
                    placeholder="Specify the specific stoppage reason…"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    required
                  />
                )}
              </div>

              {/* Floor Notes */}
              <div>
                <Label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">
                  Floor Notes & Action Taken (Optional)
                </Label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="e.g. Cleared stuck plastic from nozzle, switched to backup generator, replaced heating band..."
                  value={downtimeNotes}
                  onChange={(e) => setDowntimeNotes(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold"
                  onClick={() => setDowntimeRun(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingDowntime}
                  className="h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs"
                >
                  <Clock className="size-3.5" />
                  {isSubmittingDowntime ? 'Saving…' : 'Save Downtime Log'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </PageLayout>
  )
}
