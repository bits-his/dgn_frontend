import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Clock,
  Eye,
  LogIn,
  LogOut,
  AlertTriangle,
  UserCheck,
  History,
  Check,
  Factory,
  Plus,
  Pencil,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useOperators } from '@/lib/useOperators'
import { SearchableSelect } from '@/components/ui/searchable-select'
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
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

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

type ShiftItem = {
  id: number
  name: string
  code?: string
  startTime?: string
  endTime?: string
  isActive?: boolean
}

type ProductionRunSummary = {
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
  status?: string
  startedAt: string | null
  createdAt: string
  notes?: string | null
  batch?: {
    id: number
    batchNumber: string
    status: string
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
  }
  shiftLogs?: ShiftLogItem[]
  faultLogs?: FaultLogItem[]
}

const FAULT_CATEGORIES = [
  { value: 'ELECTRICAL', label: 'Electrical & Sensors (Heaters, PLC, Drives, Thermocouple)', icon: '⚡' },
  { value: 'MECHANICAL', label: 'Mechanical & Hydraulic (Motors, Pumps, Screw, Nozzle, Barrel)', icon: '⚙️' },
  { value: 'MOLD_TOOLING', label: 'Mold & Tooling (Jams, Ejector Pins, Water Cooling Lines)', icon: '🧩' },
  { value: 'POWER_UTILITY', label: 'Power & Utilities (Grid Outage, Generator Change, Air)', icon: '🔌' },
  { value: 'RAW_MATERIAL', label: 'Raw Material & Feed (Hopper Clog, Color Purging, Contamination)', icon: '📦' },
  { value: 'OPERATOR_ERROR', label: 'Operational & Handling (Setup Delay, Cycle Delay, Packing)', icon: '👤' },
  { value: 'OTHER', label: 'Other Stoppage / General Stoppage', icon: '❓' },
]

function fmt(value: string | number | null | undefined, digits = 0) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: digits })
    : String(value)
}

function toHhMm(value?: string | null) {
  if (!value) return ''
  const match = String(value).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return ''
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`
}

function getCurrentTimeString(date = new Date()) {
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

export function RecordProductionPage() {
  const navigate = useNavigate()
  const { id: pathId } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const urlRunId = pathId || searchParams.get('runId') || ''

  // Fetch all production runs
  const runsQuery = useQuery({
    queryKey: ['production-runs'],
    queryFn: async () => {
      const { data } = await api.get('/production/runs')
      return (data.data || []) as ProductionRunSummary[]
    },
    refetchInterval: 12_000,
  })

  const inProgressRuns = useMemo(() => {
    return (runsQuery.data || []).filter(
      (r) => r.batch?.status === 'IN_PROGRESS' || r.status === 'IN_PROGRESS'
    )
  }, [runsQuery.data])

  // Current active run selection
  const [selectedRunId, setSelectedRunId] = useState<string>(urlRunId)

  useEffect(() => {
    if (urlRunId) {
      setSelectedRunId(urlRunId)
    } else if (inProgressRuns.length > 0 && !selectedRunId) {
      setSelectedRunId(String(inProgressRuns[0].id))
      setSearchParams({ runId: String(inProgressRuns[0].id) }, { replace: true })
    }
  }, [urlRunId, inProgressRuns, selectedRunId, setSearchParams])

  const handleSelectRun = (idStr: string) => {
    setSelectedRunId(idStr)
    setSearchParams({ runId: idStr })
  }

  // Fetch detailed shifts and faults for selected run
  const scorecardQuery = useQuery({
    queryKey: ['run-shifts-and-faults', selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return null
      const { data } = await api.get(`/production/runs/${selectedRunId}/shifts-and-faults`)
      return data.data
    },
    enabled: Boolean(selectedRunId),
    refetchInterval: 10_000,
  })

  const shiftsQuery = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data } = await api.get('/masters/shifts')
      return (data.data || []) as ShiftItem[]
    },
  })

  const operatorsQuery = useOperators()
  const operatorOptions = useMemo(
    () =>
      (operatorsQuery.data || []).map((emp) => {
        const name =
          `${emp.firstname || ''} ${emp.lastname || ''}`.trim() ||
          emp.employeeCode ||
          `Operator ${emp.id}`
        return {
          value: String(emp.id),
          label: name,
          sublabel: emp.employeeCode ? `Code: ${emp.employeeCode}` : undefined,
        }
      }),
    [operatorsQuery.data],
  )

  const runDetail = scorecardQuery.data?.run || runsQuery.data?.find((r) => String(r.id) === selectedRunId)
  const isRunActive = runDetail?.batch?.status === 'IN_PROGRESS'
  const activeShift = scorecardQuery.data?.shiftLogs?.find((s: ShiftLogItem) => s.status === 'ACTIVE')

  // Clock In State
  const [clockInEmployeeId, setClockInEmployeeId] = useState<string>('')
  const [clockInShiftId, setClockInShiftId] = useState<string>('')
  const [clockInTime, setClockInTime] = useState<string>(getCurrentTimeString())
  const [isClockingIn, setIsClockingIn] = useState(false)
  const [clockInError, setClockInError] = useState('')
  const [clockInSuccess, setClockInSuccess] = useState('')

  const applyShiftClockTimes = (shiftId: string) => {
    const shift = shiftsQuery.data?.find((s) => String(s.id) === String(shiftId))
    if (!shift) return
    const start = toHhMm(shift.startTime)
    const end = toHhMm(shift.endTime)
    if (start) setClockInTime(start)
    if (end) setOutputClockOutTime(end)
  }

  useEffect(() => {
    if (shiftsQuery.data && shiftsQuery.data.length > 0 && !clockInShiftId) {
      const first = String(shiftsQuery.data[0].id)
      setClockInShiftId(first)
      applyShiftClockTimes(first)
    }
  }, [shiftsQuery.data, clockInShiftId])

  // Shift Output State
  const [outputGoodDozen, setOutputGoodDozen] = useState('')
  const [outputGoodPcs, setOutputGoodPcs] = useState('')
  const [outputRejectKg, setOutputRejectKg] = useState('0')
  const [outputMaterialKg, setOutputMaterialKg] = useState('')
  const [outputNotes, setOutputNotes] = useState('')
  const [outputClockOutTime, setOutputClockOutTime] = useState<string>(getCurrentTimeString())
  const [isSavingOutput, setIsSavingOutput] = useState(false)
  const [outputError, setOutputError] = useState('')
  const [outputSuccess, setOutputSuccess] = useState('')

  useEffect(() => {
    if (!activeShift) return
    const shift =
      shiftsQuery.data?.find((s) => s.id === activeShift.shiftId) ||
      shiftsQuery.data?.find((s) => s.id === Number(clockInShiftId))
    const end = toHhMm(shift?.endTime)
    setOutputClockOutTime(end || getCurrentTimeString())
  }, [activeShift, activeShift?.shiftId, shiftsQuery.data, clockInShiftId])

  // Automatically calculate net operating runtime from clock-in to clock-out minus shift downtime
  const calculatedShiftMinutes = useMemo(() => {
    if (!activeShift?.clockInAt || !outputClockOutTime) return 0
    const clockInDate = new Date(activeShift.clockInAt)
    const [oh, om] = outputClockOutTime.split(':').map(Number)
    if (Number.isNaN(oh) || Number.isNaN(om)) return 0

    const clockOutDate = new Date(clockInDate)
    clockOutDate.setHours(oh, om, 0, 0)
    if (clockOutDate.getTime() < clockInDate.getTime()) {
      clockOutDate.setDate(clockOutDate.getDate() + 1)
    }

    const elapsedMinutes = Math.max(0, Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000))
    const dt = Number(activeShift.downtimeMinutes || 0)
    return Math.max(0, elapsedMinutes - dt)
  }, [activeShift?.clockInAt, activeShift?.downtimeMinutes, outputClockOutTime])

  // Machine Fault Modal State
  const [isFaultModalOpen, setIsFaultModalOpen] = useState(false)
  const [faultCategory, setFaultCategory] = useState<string>('ELECTRICAL')
  const [faultMinutes, setFaultMinutes] = useState<string>('30')
  const [faultFrom, setFaultFrom] = useState<string>(getTimeMinusMinutes(30))
  const [faultTo, setFaultTo] = useState<string>(getCurrentTimeString())
  const [faultRootCause, setFaultRootCause] = useState<string>('')
  const [faultActionTaken, setFaultActionTaken] = useState<string>('')
  const [isLoggingFault, setIsLoggingFault] = useState(false)
  const [faultError, setFaultError] = useState('')
  const [faultSuccess, setFaultSuccess] = useState('')

  // Finalize Run Dialog State
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState('')

  const [editingShift, setEditingShift] = useState<ShiftLogItem | null>(null)
  const [editShiftId, setEditShiftId] = useState('')
  const [editOperatorId, setEditOperatorId] = useState('')
  const [editClockIn, setEditClockIn] = useState('')
  const [editClockOut, setEditClockOut] = useState('')
  const [editGood, setEditGood] = useState('')
  const [editReject, setEditReject] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editError, setEditError] = useState('')
  const [isSavingShift, setIsSavingShift] = useState(false)

  // HANDLERS
  const handleFaultTimeChange = (from: string, to: string) => {
    setFaultFrom(from)
    setFaultTo(to)
    if (from && to) {
      const diff = calculateMinutesBetween(from, to)
      setFaultMinutes(String(diff))
    }
  }

  const handleFaultPresetMinutes = (minsStr: string) => {
    setFaultMinutes(minsStr)
    const m = Number(minsStr) || 0
    if (faultTo && m > 0) {
      const [eh, em] = faultTo.split(':').map(Number)
      if (!Number.isNaN(eh) && !Number.isNaN(em)) {
        let totalMins = eh * 60 + em - m
        if (totalMins < 0) totalMins += 24 * 60
        const sh = String(Math.floor(totalMins / 60)).padStart(2, '0')
        const sm = String(totalMins % 60).padStart(2, '0')
        setFaultFrom(`${sh}:${sm}`)
      }
    }
  }

  // 1. Submit Shift Clock In
  const handleClockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRunId) return

    const emp = operatorsQuery.data?.find((e) => String(e.id) === clockInEmployeeId)
    if (!emp) {
      setClockInError('Select an operator from the list')
      return
    }
    const finalName = `${emp.firstname} ${emp.lastname || ''}`.trim()
    const empId = emp.id

    setIsClockingIn(true)
    setClockInError('')
    try {
      const now = new Date()
      const [ch, cm] = clockInTime.split(':').map(Number)
      if (!Number.isNaN(ch) && !Number.isNaN(cm)) {
        now.setHours(ch, cm, 0, 0)
      }

      await api.post(`/production/runs/${selectedRunId}/shift-login`, {
        operatorName: finalName,
        operatorId: empId,
        shiftId: clockInShiftId ? Number(clockInShiftId) : undefined,
        clockInAt: now.toISOString(),
      })

      await queryClient.invalidateQueries({ queryKey: ['run-shifts-and-faults', selectedRunId] })
      await queryClient.invalidateQueries({ queryKey: ['production-runs'] })
      setClockInSuccess(`${finalName} clocked in successfully!`)
      setClockInEmployeeId('')
      setTimeout(() => setClockInSuccess(''), 3000)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; errors?: Record<string, string> } } }
      setClockInError(axiosErr.response?.data?.errors?.operatorName || axiosErr.response?.data?.err || 'Failed to clock into shift')
    } finally {
      setIsClockingIn(false)
    }
  }

  // 2. Submit Shift Output & Clock Out
  const handleOutputSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRunId || !activeShift) return

    const dozen = Number(outputGoodDozen || 0)
    const pieces = Number(outputGoodPcs || 0)
    const totalGood = dozen * 12 + pieces
    const rejectKg = Number(outputRejectKg || 0)
    const runtime = calculatedShiftMinutes

    if (totalGood < 0) {
      setOutputError('Good output cannot be negative')
      return
    }

    setIsSavingOutput(true)
    setOutputError('')
    try {
      const now = new Date()
      const [ch, cm] = outputClockOutTime.split(':').map(Number)
      if (!Number.isNaN(ch) && !Number.isNaN(cm)) {
        now.setHours(ch, cm, 0, 0)
      }

      await api.post(`/production/runs/${selectedRunId}/shift-logout`, {
        shiftLogId: activeShift.id,
        qtyGood: totalGood,
        qtyReject: rejectKg,
        runtimeMinutes: runtime,
        materialConsumed: outputMaterialKg ? Number(outputMaterialKg) : undefined,
        handoverNotes: outputNotes.trim() || undefined,
        clockOutAt: now.toISOString(),
      })

      await queryClient.invalidateQueries({ queryKey: ['run-shifts-and-faults', selectedRunId] })
      await queryClient.invalidateQueries({ queryKey: ['production-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-balance'] })

      setOutputSuccess(`Shift output recorded! ${totalGood} pcs deposited into FG Store inventory.`)
      setOutputGoodDozen('')
      setOutputGoodPcs('')
      setOutputRejectKg('0')
      setOutputMaterialKg('')
      setOutputNotes('')
      setTimeout(() => setOutputSuccess(''), 4000)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; errors?: Record<string, string> } } }
      setOutputError(axiosErr.response?.data?.errors?.qtyGood || axiosErr.response?.data?.err || 'Failed to record shift output')
    } finally {
      setIsSavingOutput(false)
    }
  }

  // 3. Submit Machine Fault
  const handleFaultSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRunId) return

    const mins = Number(faultMinutes)
    if (Number.isNaN(mins) || mins <= 0) {
      setFaultError('Please specify valid downtime minutes (greater than 0)')
      return
    }

    setIsLoggingFault(true)
    setFaultError('')
    try {
      await api.post(`/production/runs/${selectedRunId}/faults`, {
        category: faultCategory,
        downtimeMinutes: mins,
        startTime: faultFrom || undefined,
        endTime: faultTo || undefined,
        rootCause: faultRootCause.trim() || undefined,
        actionTaken: faultActionTaken.trim() || undefined,
      })

      await queryClient.invalidateQueries({ queryKey: ['run-shifts-and-faults', selectedRunId] })
      await queryClient.invalidateQueries({ queryKey: ['production-runs'] })
      setFaultSuccess(`Logged ${mins}m machine fault (${faultCategory.replace(/_/g, ' ')}) successfully!`)
      setFaultRootCause('')
      setFaultActionTaken('')
      setTimeout(() => {
        setFaultSuccess('')
        setIsFaultModalOpen(false)
      }, 750)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; errors?: Record<string, string> } } }
      setFaultError(axiosErr.response?.data?.errors?.downtimeMinutes || axiosErr.response?.data?.err || 'Failed to log fault')
    } finally {
      setIsLoggingFault(false)
    }
  }

  const openEditShift = (shift: ShiftLogItem) => {
    setEditingShift(shift)
    setEditShiftId(shift.shiftId ? String(shift.shiftId) : '')
    const matched =
      (shift.operatorId && operatorsQuery.data?.find((e) => e.id === shift.operatorId)) ||
      operatorsQuery.data?.find(
        (e) => `${e.firstname} ${e.lastname || ''}`.trim() === (shift.operatorName || '').trim(),
      )
    setEditOperatorId(matched ? String(matched.id) : shift.operatorId ? String(shift.operatorId) : '')
    setEditClockIn(getCurrentTimeString(new Date(shift.clockInAt)))
    setEditClockOut(shift.clockOutAt ? getCurrentTimeString(new Date(shift.clockOutAt)) : '')
    setEditGood(String(Number(shift.qtyGood || 0)))
    setEditReject(String(Number(shift.qtyReject || 0)))
    setEditNotes(shift.handoverNotes || '')
    setEditError('')
  }

  const handleSaveEditShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRunId || !editingShift) return
    const emp = operatorsQuery.data?.find((e) => String(e.id) === editOperatorId)
    if (!emp) {
      setEditError('Select an operator from the list')
      return
    }
    setIsSavingShift(true)
    setEditError('')
    try {
      await api.patch(`/production/runs/${selectedRunId}/shift-logs/${editingShift.id}`, {
        shiftId: editShiftId ? Number(editShiftId) : null,
        operatorName: `${emp.firstname} ${emp.lastname || ''}`.trim(),
        operatorId: emp.id,
        clockInTime: editClockIn || undefined,
        clockOutTime: editingShift.status === 'COMPLETED' ? editClockOut || undefined : undefined,
        qtyGood: Number(editGood || 0),
        qtyReject: Number(editReject || 0),
        handoverNotes: editNotes.trim() || null,
      })
      await queryClient.invalidateQueries({ queryKey: ['run-shifts-and-faults', selectedRunId] })
      await queryClient.invalidateQueries({ queryKey: ['production-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory-balance'] })
      setEditingShift(null)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string } } }
      setEditError(axiosErr.response?.data?.err || 'Could not update this shift')
    } finally {
      setIsSavingShift(false)
    }
  }

  // 4. Finalize & Complete Run
  const handleFinalizeRun = async () => {
    if (!selectedRunId || !runDetail) return

    setIsFinalizing(true)
    setFinalizeError('')
    try {
      const totalGood = Number(scorecardQuery.data?.totals?.totalGood || runDetail.qtyGood || 0)
      const totalRejectKg = Number(scorecardQuery.data?.totals?.totalReject || runDetail.qtyReject || 0)
      const totalRuntime = Number(scorecardQuery.data?.totals?.totalRuntimeMinutes || runDetail.runtimeMinutes || 0)
      const totalDowntime = Number(scorecardQuery.data?.totals?.totalDowntimeMinutes || runDetail.downtimeMinutes || 0)

      await api.post(`/production/runs/${selectedRunId}/complete`, {
        qtyProduced: totalGood > 0 ? totalGood : 1,
        qtyGood: totalGood,
        qtyReject: totalRejectKg,
        runtimeMinutes: totalRuntime,
        downtimeMinutes: totalDowntime,
        autoRelease: true,
        confirmUnusualRun: true,
      })

      await queryClient.invalidateQueries({ queryKey: ['production-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['run-shifts-and-faults', selectedRunId] })
      setIsFinalizeModalOpen(false)
      navigate('/production')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; message?: string } } }
      setFinalizeError(axiosErr.response?.data?.message || axiosErr.response?.data?.err || 'Failed to finalize production run')
    } finally {
      setIsFinalizing(false)
    }
  }

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-2">
          <span>Production Work & Shift Operations</span>
          {isRunActive && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
              Active Run
            </span>
          )}
        </div>
      }
      description="Assign operators to shifts, log good pieces and defect scrap, record categorized machine downtime, and monitor floor scorecards."
      back={true}
      backTo="/production"
      backLabel="Back to Production"
      actions={
        <div className="flex items-center gap-2">
          {/* Quick Active Run Switcher - hidden on mobile */}
          <div className="hidden sm:block sm:w-64 md:w-72">
            <Select value={selectedRunId} onValueChange={handleSelectRun}>
              <SelectTrigger className="h-8 text-xs bg-white font-medium">
                <SelectValue placeholder="Select active run…" />
              </SelectTrigger>
              <SelectContent>
                {inProgressRuns.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="font-mono font-semibold">{r.batch?.batchNumber || `RUN-${r.id}`}</span>
                      <span className="text-zinc-400 text-[11px]">({r.machine?.name})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isRunActive && (
            <Button
              type="button"
              onClick={() => setIsFinalizeModalOpen(true)}
              className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Finalize Run</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        {/* ========================================================================= */}
        {/* TOP STATUS RIBBON: SELECTED RUN DETAILS (COMPACT)                         */}
        {/* ========================================================================= */}
        {runDetail ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                  <Factory className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-zinc-900 font-mono">
                      {runDetail.batch?.batchNumber || `RUN-${runDetail.id}`}
                    </span>
                    <Link
                      to={`/batches/${runDetail.batch?.batchNumber}`}
                      className="text-zinc-400 hover:text-blue-600"
                      title="View batch profile"
                    >
                      <Eye className="size-3.5" />
                    </Link>
                    {isRunActive ? (
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.2 text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                        In Progress
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.2 text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                        Completed
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-600">
                    <strong>Product:</strong> {runDetail.product?.name || '—'} · <strong>Machine:</strong> {runDetail.machine?.name || '—'} ({runDetail.machine?.code || '—'})
                  </p>
                </div>
              </div>

              {/* Feed lot and store notes badge */}
              <div className="flex items-center gap-2">
                {runDetail.inputBatch && (
                  <span className="text-[11px] text-zinc-500 bg-zinc-100 border border-zinc-200 rounded-md px-2 py-0.5 font-mono">
                    Feed: {runDetail.inputBatch.batchNumber}
                  </span>
                )}
                {runDetail.notes && (
                  <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-0.5 truncate max-w-[200px]" title={runDetail.notes}>
                    {runDetail.notes.split('\n')[0]}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px] font-semibold"
                  asChild
                >
                  <Link to={`/batches/${runDetail.batch?.batchNumber}`}>
                    <Eye className="size-3 mr-1" />
                    Batch
                  </Link>
                </Button>
              </div>
            </div>

            {/* Quick Metrics Grid (Compact) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5">
              <div className="bg-zinc-50 rounded-lg p-2 border border-zinc-200/70">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Material Issued
                </span>
                <span className="text-sm font-bold text-zinc-900 tabular-nums">
                  {fmt(runDetail.materialConsumed, 1)} kg
                </span>
              </div>
              <div className="bg-emerald-50/60 rounded-lg p-2 border border-emerald-200/70">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Cumulative Good Output
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-black text-emerald-700 tabular-nums">
                    {fmt(scorecardQuery.data?.totals?.totalGood || runDetail.qtyGood || 0)} {runDetail.uom || 'pcs'}
                  </span>
                  {Number(scorecardQuery.data?.totals?.totalGood || runDetail.qtyGood || 0) >= 12 && (
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      ({Math.floor(Number(scorecardQuery.data?.totals?.totalGood || runDetail.qtyGood || 0) / 12)} dz)
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-red-50/50 rounded-lg p-2 border border-red-200/70">
                <span className="text-[9px] font-bold uppercase tracking-wider text-red-700 block">
                  Defect Scrap / Waste
                </span>
                <span className="text-sm font-bold text-red-700 tabular-nums">
                  {fmt(scorecardQuery.data?.totals?.totalReject || runDetail.qtyReject || 0, 2)} kg
                </span>
              </div>
              <div className="bg-amber-50/60 rounded-lg p-2 border border-amber-200/70">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 block">
                  Total Downtime
                </span>
                <span className="text-sm font-bold text-amber-900 tabular-nums">
                  {scorecardQuery.data?.totals?.totalDowntimeMinutes || runDetail.downtimeMinutes || 0} mins
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-xs max-w-lg mx-auto space-y-3 my-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mx-auto">
              <Factory className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">No Active Production Run Selected</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Production runs are created when raw material and color additives are issued to a machine from the Material Store. Select an active run from the dropdown above, or visit the Material Store.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button variant="outline" size="sm" asChild>
                <Link to="/production">
                  View Floor Table
                </Link>
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
                <Link to="/production/store">
                  Go to Material Store
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TWO-COLUMN WORKSPACE: LEFT (ACTIONS) / RIGHT (SCORECARD & FAULTS)         */}
        {/* ========================================================================= */}
        {runDetail && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* LEFT COLUMN: ACTIVE SHIFT & OUTPUT LOGGING (7 Cols) */}
            <div className="lg:col-span-7 space-y-3">
              {/* 1. OPERATOR SHIFT CARD */}
              <div className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <UserCheck className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900">
                        Operator Shift Assignment
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        Assign operators to machines by shift to track hours, outputs, and downtime attribution.
                      </p>
                    </div>
                  </div>
                </div>

                {/* If an operator is currently active */}
                {activeShift ? (
                  <div className="mt-3 rounded-lg bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-300 p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex size-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                          </span>
                          <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wide">
                            Current Active Operator
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-zinc-900">
                          {activeShift.operatorName}
                        </h4>
                        <p className="text-[11px] text-zinc-600">
                          {activeShift.shift?.name || 'On Shift'} · In at{' '}
                          <strong>
                            {new Date(activeShift.clockInAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 self-start sm:self-auto sm:border-l sm:border-emerald-200/80 sm:pl-3">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-zinc-400 block">
                            Downtime
                          </span>
                          <span className="text-xs font-bold text-amber-900 tabular-nums">
                            {activeShift.downtimeMinutes || 0}m
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsFaultModalOpen(true)}
                          className="h-7 px-2 text-[11px] font-semibold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1 shadow-2xs"
                        >
                          <AlertTriangle className="size-3 text-amber-700" />
                          <span>Log Fault</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : isRunActive ? (
                  <div className="mt-3 space-y-2.5">
                    <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-2.5 flex items-center gap-2 text-xs text-amber-900 font-medium">
                      <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                      <span>No operator clocked in. Clock in an operator below to begin recording shift output.</span>
                    </div>

                    {clockInSuccess && (
                      <div className="rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                        <span>{clockInSuccess}</span>
                      </div>
                    )}

                    {clockInError && (
                      <div className="rounded-lg bg-red-50 p-2 text-xs font-medium text-red-700 border border-red-200">
                        {clockInError}
                      </div>
                    )}

                    <form onSubmit={handleClockInSubmit} className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-xs font-bold text-zinc-800 mb-0.5 block">
                            Operator *
                          </Label>
                          <SearchableSelect
                            value={clockInEmployeeId}
                            onChange={setClockInEmployeeId}
                            options={operatorOptions}
                            placeholder="Select operator…"
                            searchPlaceholder="Search operator name…"
                            emptyMessage="No operators found. Add them on the Operators page."
                            allowClear={false}
                            triggerClassName="h-8 px-2.5 py-1 text-xs bg-white"
                            onOpenChange={(open) => {
                              if (open) void operatorsQuery.refetch()
                            }}
                          />
                        </div>

                        <div>
                          <Label className="block text-xs font-bold text-zinc-800 mb-0.5">
                            Shift *
                          </Label>
                          <Select
                            value={clockInShiftId}
                            onValueChange={(val) => {
                              setClockInShiftId(val)
                              applyShiftClockTimes(val)
                            }}
                          >
                            <SelectTrigger className="w-full text-xs h-8 bg-white">
                              <SelectValue placeholder="Select shift…" />
                            </SelectTrigger>
                            <SelectContent>
                              {shiftsQuery.data?.map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.name} {s.startTime && s.endTime ? `(${s.startTime} - ${s.endTime})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="flex-1">
                          <Label className="block text-xs font-bold text-zinc-800 mb-0.5">
                            Clock-In Time
                          </Label>
                          <Input
                            type="time"
                            className="h-8 text-xs bg-white"
                            value={clockInTime}
                            onChange={(e) => setClockInTime(e.target.value)}
                            required
                          />
                        </div>
                        <div className="self-end">
                          <Button
                            type="submit"
                            disabled={isClockingIn}
                            className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white gap-1 shadow-xs"
                          >
                            <LogIn className="size-3.5" />
                            {isClockingIn ? 'Starting…' : 'Clock In Shift'}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 mt-1">This run is completed. Shift logins are closed.</p>
                )}
              </div>

              {/* 2. RECORD SHIFT OUTPUT & CLOCK OUT - ONLY WHEN OPERATOR IS ACTIVE */}
              {isRunActive && activeShift && (
                <div className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <LogOut className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-zinc-900">
                          Record Shift Output & Clock Out
                        </h3>
                        <p className="text-[11px] text-zinc-500">
                          Save output for <strong>{activeShift.operatorName}</strong>. Added to FG Store inventory.
                        </p>
                      </div>
                    </div>
                  </div>

                  {outputSuccess && (
                    <div className="mt-2.5 rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                      <span>{outputSuccess}</span>
                    </div>
                  )}

                  {outputError && (
                    <div className="mt-2.5 rounded-lg bg-red-50 p-2 text-xs font-medium text-red-700 border border-red-200">
                      {outputError}
                    </div>
                  )}

                  <form onSubmit={handleOutputSubmit} className="space-y-3 pt-2.5">
                    {/* Good output (Dozens & Pieces inputs) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5 space-y-1.5">
                        <Label className="block text-xs font-bold text-emerald-900">
                          Good Output ({runDetail?.uom || 'pcs'}) *
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-emerald-800 block mb-0.5">Dozens</span>
                            <Input
                              type="number"
                              min="0"
                              className="h-8 text-xs font-bold text-emerald-900 bg-white"
                              placeholder="dz"
                              value={outputGoodDozen}
                              onChange={(e) => setOutputGoodDozen(e.target.value)}
                            />
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-emerald-800 block mb-0.5">Pieces</span>
                            <Input
                              type="number"
                              min="0"
                              className="h-8 text-xs font-bold text-emerald-900 bg-white"
                              placeholder="pcs"
                              value={outputGoodPcs}
                              onChange={(e) => setOutputGoodPcs(e.target.value)}
                            />
                          </div>
                        </div>
                        <p className="text-[11px] font-semibold text-emerald-700">
                          Total Good: {Number(outputGoodDozen || 0) * 12 + Number(outputGoodPcs || 0)} pcs
                        </p>
                      </div>

                      <div className="rounded-lg border border-red-200 bg-red-50/40 p-2.5 space-y-1.5">
                        <Label className="block text-xs font-bold text-red-900">
                          Defects / Rejects / Scrap (kg)
                        </Label>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-red-800 block mb-0.5">
                            Weighed scrap
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            className="h-8 text-xs font-bold text-red-700 bg-white"
                            placeholder="0.00"
                            value={outputRejectKg}
                            onChange={(e) => setOutputRejectKg(e.target.value)}
                          />
                        </div>
                        <p className="text-[11px] text-red-800/80">Enter the scale weight of damaged scrap.</p>
                      </div>
                    </div>

                    {/* Clock out time & Calculated Runtime Badge */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <Label className="block text-xs font-bold text-zinc-800 mb-0.5">
                          Clock Out Time *
                        </Label>
                        <Input
                          type="time"
                          className="h-8 text-xs bg-white"
                          value={outputClockOutTime}
                          onChange={(e) => setOutputClockOutTime(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex flex-col justify-end">
                        <div className="rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-1 flex items-center justify-between text-xs h-8">
                          <span className="text-zinc-500 font-medium text-[11px]">Operating Runtime:</span>
                          <span className="font-bold text-zinc-900 tabular-nums">
                            {calculatedShiftMinutes} mins
                            {calculatedShiftMinutes >= 60 && (
                              <span className="text-[11px] text-zinc-500 font-normal ml-1">
                                ({(calculatedShiftMinutes / 60).toFixed(1)}h)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Handover notes */}
                    <div>
                      <Label className="block text-xs font-bold text-zinc-800 mb-0.5">
                        Shift Handover Notes (Optional)
                      </Label>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-800 outline-none focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="e.g. Cleared nozzle at 02:00 PM; barrel heating stable; handed over to next operator..."
                        value={outputNotes}
                        onChange={(e) => setOutputNotes(e.target.value)}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-zinc-400">
                        * Finished goods are automatically added to FG inventory.
                      </span>
                      <Button
                        type="submit"
                        disabled={isSavingOutput || !activeShift}
                        className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                      >
                        <Check className="size-3.5" />
                        {isSavingOutput ? 'Saving Output…' : 'Clock Out & Save Output'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: OPERATOR SCORECARD & CHRONOLOGICAL SESSIONS (5 Cols) */}
            <div className="lg:col-span-5 space-y-3">
              {/* CHRONOLOGICAL SHIFTS TIMELINE */}
              <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-3.5 shadow-2xs">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="size-3.5 text-zinc-500" />
                  <span>Shift Sessions ({scorecardQuery.data?.shiftLogs?.length || 0})</span>
                </h3>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {scorecardQuery.data?.shiftLogs?.map((shift: ShiftLogItem) => {
                    const isActive = shift.status === 'ACTIVE'
                    return (
                      <div
                        key={shift.id}
                        className={`rounded-lg border p-2 text-xs ${
                          isActive
                            ? 'bg-emerald-50/40 border-emerald-300'
                            : 'bg-white border-zinc-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {isActive ? (
                              <span className="rounded-full bg-emerald-500 size-2 animate-pulse" />
                            ) : (
                              <span className="rounded-full bg-zinc-300 size-1.5" />
                            )}
                            <strong className="text-zinc-900">{shift.operatorName}</strong>
                            {shift.shift?.name && (
                              <span className="text-[10px] text-zinc-500">· {shift.shift.name}</span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="font-bold text-emerald-700">
                              {fmt(shift.qtyGood)} pcs
                            </span>
                            {Number(shift.qtyReject || 0) > 0 ? (
                              <span className="text-[10px] font-semibold text-red-700">
                                {fmt(shift.qtyReject, 2)} kg
                              </span>
                            ) : null}
                            {isRunActive && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800 hover:text-amber-950"
                                onClick={() => openEditShift(shift)}
                              >
                                <Pencil className="size-2.5" />
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
                          <span>
                            {new Date(shift.clockInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {shift.clockOutAt ? ` → ${new Date(shift.clockOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (Active)'}
                          </span>
                          <span>
                            Run: {shift.runtimeMinutes || 0}m · Stop: {shift.downtimeMinutes || 0}m
                          </span>
                        </div>
                        {shift.handoverNotes && (
                          <p className="mt-1 text-[10px] text-zinc-600 bg-zinc-50 p-1.5 rounded border border-zinc-100 italic">
                            &ldquo;{shift.handoverNotes}&rdquo;
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* RECORDED MACHINE FAULTS */}
              <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-3.5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-amber-600" />
                    <span>Machine Stops & Faults ({scorecardQuery.data?.faultLogs?.length || 0})</span>
                  </h3>
                  {isRunActive && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFaultModalOpen(true)}
                      className="h-6 px-2 text-[10px] font-semibold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1"
                    >
                      <Plus className="size-2.5 text-amber-700" />
                      <span>Log Fault</span>
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
                  {scorecardQuery.data?.faultLogs?.map((f: FaultLogItem) => (
                    <div key={f.id} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[9px] uppercase bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded">
                          {f.category.replace(/_/g, ' ')}
                        </span>
                        <span className="font-bold text-zinc-900 text-[11px]">{f.downtimeMinutes}m stop</span>
                      </div>
                      {f.rootCause && (
                        <p className="mt-0.5 text-zinc-800 text-[11px]">
                          <strong>Cause:</strong> {f.rootCause}
                        </p>
                      )}
                      {f.actionTaken && (
                        <p className="text-zinc-500 text-[10px]">
                          <strong>Fix:</strong> {f.actionTaken}
                        </p>
                      )}
                    </div>
                  ))}
                  {(!scorecardQuery.data?.faultLogs || scorecardQuery.data.faultLogs.length === 0) && (
                    <p className="text-xs text-zinc-400 italic py-1.5">No machine faults recorded.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: LOG MACHINE FAULT & DOWNTIME                                       */}
        {/* ========================================================================= */}
        {isFaultModalOpen && (
          <Dialog open={isFaultModalOpen} onOpenChange={setIsFaultModalOpen}>
            <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl shadow-2xl border-zinc-200">
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-200/60 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                      <span>Log Machine Fault & Stoppage</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 border border-amber-200 uppercase tracking-wide">
                        Downtime
                      </span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-600 mt-0.5">
                      {runDetail?.machine?.name || 'Machine'} · Batch #{runDetail?.batch?.batchNumber || `RUN-${runDetail?.id}`}
                      {activeShift ? ` · Active Operator: ${activeShift.operatorName}` : ''}
                    </DialogDescription>
                  </div>
                </div>
              </div>

              {faultSuccess && (
                <div className="mx-5 mt-4 rounded-lg bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <span>{faultSuccess}</span>
                </div>
              )}

              {faultError && (
                <div className="mx-5 mt-4 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700 border border-red-200">
                  {faultError}
                </div>
              )}

              <form onSubmit={handleFaultSubmit} className="p-5 space-y-3.5">
                <div>
                  <Label className="block text-xs font-bold text-zinc-800 mb-1">
                    Fault Category *
                  </Label>
                  <Select value={faultCategory} onValueChange={(val) => setFaultCategory(val)}>
                    <SelectTrigger className="w-full text-xs h-9 bg-white">
                      <SelectValue placeholder="Select fault category…" />
                    </SelectTrigger>
                    <SelectContent>
                      {FAULT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <span className="mr-1.5">{cat.icon}</span>
                          <span>{cat.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Stopped At</span>
                    <Input
                      type="time"
                      className="h-8 text-xs bg-white"
                      value={faultFrom}
                      onChange={(e) => handleFaultTimeChange(e.target.value, faultTo)}
                      required
                    />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Resumed At</span>
                    <Input
                      type="time"
                      className="h-8 text-xs bg-white"
                      value={faultTo}
                      onChange={(e) => handleFaultTimeChange(faultFrom, e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mr-1">
                    Presets ({faultMinutes}m):
                  </span>
                  {['15', '30', '45', '60', '90', '120'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleFaultPresetMinutes(m)}
                      className={`rounded-lg px-2 py-0.5 text-xs font-bold transition-all ${
                        faultMinutes === m
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-amber-100'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>

                <div>
                  <Label className="block text-xs font-bold text-zinc-800 mb-1">
                    Root Cause & Problem Description *
                  </Label>
                  <Input
                    type="text"
                    className="h-8 text-xs bg-white"
                    placeholder="e.g. Thermocouple wire detached causing temperature fluctuation"
                    value={faultRootCause}
                    onChange={(e) => setFaultRootCause(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label className="block text-xs font-bold text-zinc-800 mb-1">
                    Corrective Action Taken
                  </Label>
                  <Input
                    type="text"
                    className="h-8 text-xs bg-white"
                    placeholder="e.g. Reconnected sensor wire and tested heater zone 3"
                    value={faultActionTaken}
                    onChange={(e) => setFaultActionTaken(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={() => setIsFaultModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoggingFault}
                    className="h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs"
                  >
                    <Clock className="size-3.5" />
                    {isLoggingFault ? 'Saving Fault…' : 'Record Machine Fault'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {/* ========================================================================= */}
        {/* MODAL: FINALIZE RUN CONFIRMATION                                          */}
        {/* ========================================================================= */}
        {isFinalizeModalOpen && (
          <Dialog open={isFinalizeModalOpen} onOpenChange={setIsFinalizeModalOpen}>
            <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl shadow-2xl border-zinc-200">
              <div className="bg-gradient-to-r from-emerald-600/10 via-emerald-500/5 to-transparent border-b border-emerald-200 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-zinc-900">
                      Finalize & Complete Run
                    </DialogTitle>
                    <DialogDescription className="text-xs text-zinc-600 mt-0.5">
                      Confirm all issued material ({runDetail?.materialConsumed} kg) is consumed and complete this run.
                    </DialogDescription>
                  </div>
                </div>
              </div>

              {finalizeError && (
                <div className="mx-5 mt-4 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700 border border-red-200">
                  {finalizeError}
                </div>
              )}

              <div className="p-5 space-y-4 text-xs text-zinc-700">
                <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-200/80 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total Good Produced:</span>
                    <strong className="text-emerald-700 font-bold">
                      {fmt(scorecardQuery.data?.totals?.totalGood || runDetail?.qtyGood || 0)} pcs
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total Scrap / Waste:</span>
                    <strong className="text-red-600 font-bold">
                      {fmt(scorecardQuery.data?.totals?.totalReject || runDetail?.qtyReject || 0, 2)} kg
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total Operating Hours:</span>
                    <strong className="text-zinc-900">
                      {scorecardQuery.data?.totals?.totalRuntimeHours || ((runDetail?.runtimeMinutes || 0) / 60).toFixed(1)} hrs
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Total Downtime:</span>
                    <strong className="text-amber-800">
                      {scorecardQuery.data?.totals?.totalDowntimeMinutes || runDetail?.downtimeMinutes || 0} mins
                    </strong>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Completing the run closes all shifts on this machine and releases the batch to Finished Goods store.
                </p>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={() => setIsFinalizeModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={isFinalizing}
                    onClick={handleFinalizeRun}
                    className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="size-3.5" />
                    {isFinalizing ? 'Finalizing…' : 'Confirm & Complete Run'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {editingShift && (
          <Dialog open={Boolean(editingShift)} onOpenChange={(open) => !open && setEditingShift(null)}>
            <DialogContent className="max-w-md rounded-2xl border-zinc-200 p-0 overflow-visible">
              <div className="border-b border-zinc-100 px-5 py-4">
                <DialogTitle className="text-base font-bold text-zinc-900">Edit shift session</DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-zinc-600">
                  Correct the shift, operator, times, or output before this run is finalised.
                </DialogDescription>
              </div>
              <form onSubmit={handleSaveEditShift} className="space-y-3 p-5">
                {editError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                    {editError}
                  </p>
                )}
                <div>
                  <Label className="mb-1 block text-xs font-bold text-zinc-800">Shift</Label>
                  <Select
                    value={editShiftId || undefined}
                    onValueChange={(val) => {
                      setEditShiftId(val)
                      const shift = shiftsQuery.data?.find((s) => String(s.id) === val)
                      const start = toHhMm(shift?.startTime)
                      const end = toHhMm(shift?.endTime)
                      if (start) setEditClockIn(start)
                      if (end) setEditClockOut(end)
                    }}
                  >
                    <SelectTrigger className="h-9 w-full bg-white text-xs">
                      <SelectValue placeholder="Select shift…" />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftsQuery.data?.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name} {s.startTime && s.endTime ? `(${s.startTime} - ${s.endTime})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-bold text-zinc-800">Operator</Label>
                  <SearchableSelect
                    value={editOperatorId}
                    onChange={setEditOperatorId}
                    options={operatorOptions}
                    placeholder="Select operator…"
                    searchPlaceholder="Search operator name…"
                    emptyMessage="No operators found. Add them on the Operators page."
                    allowClear={false}
                    triggerClassName="h-9 px-2.5 py-1 text-xs bg-white"
                    onOpenChange={(open) => {
                      if (open) void operatorsQuery.refetch()
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="mb-1 block text-xs font-bold text-zinc-800">Clock in</Label>
                    <Input
                      type="time"
                      className="h-9 text-xs"
                      value={editClockIn}
                      onChange={(e) => setEditClockIn(e.target.value)}
                      required
                    />
                  </div>
                  {editingShift.status === 'COMPLETED' ? (
                    <div>
                      <Label className="mb-1 block text-xs font-bold text-zinc-800">Clock out</Label>
                      <Input
                        type="time"
                        className="h-9 text-xs"
                        value={editClockOut}
                        onChange={(e) => setEditClockOut(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="flex items-end">
                      <p className="pb-2 text-[11px] text-zinc-500">Still active — clock out when recording output.</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="mb-1 block text-xs font-bold text-zinc-800">Good pcs</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      className="h-9 text-xs tabular-nums"
                      value={editGood}
                      onChange={(e) => setEditGood(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs font-bold text-zinc-800">Scrap (kg)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      className="h-9 text-xs tabular-nums"
                      value={editReject}
                      onChange={(e) => setEditReject(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-bold text-zinc-800">Notes</Label>
                  <Input
                    className="h-9 text-xs"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    onClick={() => setEditingShift(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="h-8 text-xs font-semibold" disabled={isSavingShift}>
                    {isSavingShift ? 'Saving…' : 'Save shift'}
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
