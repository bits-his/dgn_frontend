import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Clock,
  Pencil,
  Save,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
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
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useOperators } from '@/lib/useOperators'
import { fmtDozenPcs } from '@/lib/units'
import { formatBusinessDate } from '@/lib/dates'

const FAULT_CATEGORIES = [
  { value: 'ELECTRICAL', label: 'Electrical & Sensors' },
  { value: 'MECHANICAL', label: 'Mechanical & Hydraulic' },
  { value: 'MOLD_TOOLING', label: 'Mold & Tooling' },
  { value: 'POWER_UTILITY', label: 'Power & Utilities' },
  { value: 'RAW_MATERIAL', label: 'Raw Material & Feed' },
  { value: 'OPERATOR_ERROR', label: 'Operational & Handling' },
  { value: 'OTHER', label: 'Other / General Stoppage' },
]

type ActiveRun = {
  id: number
  batchNumber: string | null
  productId?: number | null
  productName: string | null
  productCode: string | null
  materialConsumed: number
  materialUom: string
  materialName: string | null
  materialCode: string | null
  inputBatchNumber: string | null
  inputBatchColor: string | null
  startedAt: string | null
  downtimeMinutes: number
  qtyGood: number
  qtyReject: number
  notes: string | null
}

type ShiftLogRow = {
  id: number
  operatorId: number | null
  operatorName: string
  shiftId: number | null
  status: string
  qtyGood: number | string
  qtyReject: number | string
  clockInAt: string | null
  clockOutAt: string | null
  shift?: { id: number; name: string } | null
}

type FaultRow = {
  id: number
  category: string
  downtimeMinutes: number
  rootCause: string | null
  operatorName: string | null
  createdAt: string
}

type DetailPayload = {
  machine: {
    id: number
    name: string
    code: string | null
    machineType: string | null
  }
  activeRuns: ActiveRun[]
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function errMsg(err: any) {
  return (
    err?.response?.data?.err ||
    err?.response?.data?.message ||
    (err?.response?.data?.errors ? Object.values(err.response.data.errors).join(', ') : null) ||
    err?.message ||
    'Something went wrong'
  )
}

function splitToDozenPcs(totalPcs: number) {
  const n = Math.max(0, Math.round(Number(totalPcs) || 0))
  return { dozen: Math.floor(n / 12), pcs: n % 12 }
}

export function MachineWorkLogPage() {
  const { machineId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const detail = useQuery({
    queryKey: ['production-machine-detail', machineId, 'work'],
    enabled: Boolean(machineId),
    queryFn: async () => {
      const { data } = await api.get(`/production/machines/${machineId}`, {
        params: { rangePreset: 'today' },
      })
      return data.data as DetailPayload
    },
    refetchInterval: 15_000,
  })

  const shiftsQuery = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data } = await api.get('/masters/shifts')
      return (data.data || []) as Array<{ id: number; name: string; startTime?: string; endTime?: string }>
    },
  })

  const machinesQuery = useQuery({
    queryKey: ['machines-list'],
    queryFn: async () => {
      const { data } = await api.get('/machines')
      return (data.data || []) as Array<{ id: number; name: string; code?: string; isActive?: boolean }>
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

  const machineOptions = useMemo(
    () =>
      (machinesQuery.data || [])
        .filter((m) => m.isActive !== false && String(m.id) !== String(machineId))
        .map((m) => ({
          value: String(m.id),
          label: m.name,
          sublabel: m.code || undefined,
        })),
    [machinesQuery.data, machineId],
  )

  const activeRuns = detail.data?.activeRuns || []
  const [runId, setRunId] = useState('')
  const selectedRun = activeRuns.find((r) => String(r.id) === runId) || activeRuns[0] || null

  useEffect(() => {
    if (activeRuns.length && !runId) setRunId(String(activeRuns[0].id))
  }, [activeRuns, runId])

  useEffect(() => {
    if (runId && activeRuns.length && !activeRuns.some((r) => String(r.id) === runId)) {
      setRunId(String(activeRuns[0].id))
    }
  }, [activeRuns, runId])

  const mergedTotals = useMemo(() => {
    if (!activeRuns.length) return null
    return {
      materialConsumed: activeRuns.reduce((s, r) => s + Number(r.materialConsumed || 0), 0),
      qtyGood: activeRuns.reduce((s, r) => s + Number(r.qtyGood || 0), 0),
      qtyReject: activeRuns.reduce((s, r) => s + Number(r.qtyReject || 0), 0),
      downtimeMinutes: activeRuns.reduce((s, r) => s + Number(r.downtimeMinutes || 0), 0),
      materialUom: activeRuns[0]?.materialUom || 'kg',
      inputBatchNumber: activeRuns.map((r) => r.inputBatchNumber).filter(Boolean).join(' + ') || null,
      inputBatchColor: activeRuns.map((r) => r.inputBatchColor).filter(Boolean).join(' + ') || null,
      materialName: activeRuns[0]?.materialName || null,
      productName: activeRuns[0]?.productName || null,
      batchNumber: activeRuns.map((r) => r.batchNumber || `RUN-${r.id}`).join(' + '),
    }
  }, [activeRuns])

  const runDetail = useQuery({
    queryKey: ['run-shifts-and-faults', selectedRun?.id],
    enabled: Boolean(selectedRun?.id),
    queryFn: async () => {
      const { data } = await api.get(`/production/runs/${selectedRun!.id}/shifts-and-faults`)
      return data.data as {
        shiftLogs: ShiftLogRow[]
        faultLogs: FaultRow[]
      }
    },
    refetchInterval: 15_000,
  })

  const [operatorId, setOperatorId] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [goodDozen, setGoodDozen] = useState('')
  const [goodPcs, setGoodPcs] = useState('')
  const [damagePcs, setDamagePcs] = useState('')
  const [wasteKg, setWasteKg] = useState('')
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [faultCategory, setFaultCategory] = useState('OTHER')
  const [faultMinutes, setFaultMinutes] = useState('')
  const [faultNotes, setFaultNotes] = useState('')

  const [transferOpen, setTransferOpen] = useState(false)
  const [transferMachineId, setTransferMachineId] = useState('')
  const [transferKg, setTransferKg] = useState('')
  const [transferProductId, setTransferProductId] = useState('')

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get('/masters/products')
      return (data.data || []) as Array<{ id: number; name: string; isActive?: boolean }>
    },
  })

  const productOptions = useMemo(
    () =>
      (productsQuery.data || [])
        .filter((p) => p.isActive !== false)
        .map((p) => ({ value: String(p.id), label: p.name })),
    [productsQuery.data],
  )

  const [editing, setEditing] = useState<ShiftLogRow | null>(null)
  const [editOperatorId, setEditOperatorId] = useState('')
  const [editShiftId, setEditShiftId] = useState('')
  const [editGoodDozen, setEditGoodDozen] = useState('')
  const [editGoodPcs, setEditGoodPcs] = useState('')
  const [editDamagePcs, setEditDamagePcs] = useState('')

  useEffect(() => {
    if (shiftsQuery.data?.length && !shiftId) setShiftId(String(shiftsQuery.data[0].id))
  }, [shiftsQuery.data, shiftId])

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['production-machine-detail', machineId] })
    await qc.invalidateQueries({ queryKey: ['production-machines-overview'] })
    if (selectedRun?.id) {
      await qc.invalidateQueries({ queryKey: ['run-shifts-and-faults', selectedRun.id] })
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selectedRun) throw new Error('No open run on this machine')
      if (!operatorId) throw new Error('Select an operator')
      if (!shiftId) throw new Error('Select a shift')
      const good = (Number(goodDozen) || 0) * 12 + (Number(goodPcs) || 0)
      const damage = Number(damagePcs) || 0
      const waste = Number(wasteKg) || 0
      if (!(good > 0) && !(damage > 0)) throw new Error('Enter quantity produced and/or damage')

      const { data } = await api.post(`/production/runs/${selectedRun.id}/record`, {
        operatorId: Number(operatorId),
        shiftId: Number(shiftId),
        qtyGood: good,
        qtyReject: damage,
        qtyWaste: waste,
        complete: false,
      })
      return data
    },
    onSuccess: async () => {
      setBanner({
        type: 'ok',
        text: 'Production recorded',
      })
      setGoodDozen('')
      setGoodPcs('')
      setDamagePcs('')
      setWasteKg('')
      await invalidate()
    },
    onError: (err) => setBanner({ type: 'err', text: errMsg(err) }),
  })

  const downtimeMut = useMutation({
    mutationFn: async () => {
      if (!selectedRun) throw new Error('No open run')
      const mins = Number(faultMinutes) || 0
      if (!(mins > 0)) throw new Error('Enter downtime minutes')
      const emp = (operatorsQuery.data || []).find((e) => String(e.id) === operatorId)
      const operatorName = emp
        ? `${emp.firstname || ''} ${emp.lastname || ''}`.trim() || emp.employeeCode
        : undefined
      const { data } = await api.post(`/production/runs/${selectedRun.id}/faults`, {
        category: faultCategory,
        downtimeMinutes: mins,
        rootCause: faultNotes || null,
        operatorName: operatorName || undefined,
        shiftId: shiftId ? Number(shiftId) : undefined,
      })
      return data
    },
    onSuccess: async () => {
      setFaultMinutes('')
      setFaultNotes('')
      setBanner({ type: 'ok', text: 'Downtime logged' })
      await invalidate()
    },
    onError: (err) => setBanner({ type: 'err', text: errMsg(err) }),
  })

  const finalizeMut = useMutation({
    mutationFn: async () => {
      if (!selectedRun) throw new Error('No open run')
      const totalGood = Number(selectedRun.qtyGood || 0)
      const totalReject = Number(selectedRun.qtyReject || 0)
      const { data } = await api.post(`/production/runs/${selectedRun.id}/complete`, {
        qtyProduced: totalGood > 0 ? totalGood : 1,
        qtyGood: totalGood,
        qtyReject: totalReject,
        runtimeMinutes: 0,
        downtimeMinutes: Number(selectedRun.downtimeMinutes || 0),
        autoRelease: true,
        confirmUnusualRun: true,
      })
      return data
    },
    onSuccess: async () => {
      setFinalizeOpen(false)
      setBanner({ type: 'ok', text: 'Run finalized — goods released to finished store' })
      await invalidate()
      navigate('/production')
    },
    onError: (err) => setBanner({ type: 'err', text: errMsg(err) }),
  })

  const transferMut = useMutation({
    mutationFn: async () => {
      if (!selectedRun) throw new Error('No open run')
      if (!transferMachineId) throw new Error('Select a destination machine')
      const kg = Number(transferKg)
      if (!(kg > 0)) throw new Error('Enter the weighed leftover kg')
      const maxKg = Number(selectedRun.materialConsumed || 0)
      if (kg - maxKg > 0.001) {
        throw new Error(`Only ${fmt(maxKg)} kg issued on this run`)
      }
      const { data } = await api.patch(`/production/runs/${selectedRun.id}/machine`, {
        machineId: Number(transferMachineId),
        materialKg: kg,
        productId: transferProductId ? Number(transferProductId) : selectedRun.productId,
      })
      return data
    },
    onSuccess: async (data) => {
      const kg = Number(data?.materialKg || transferKg)
      const destName = data?.data?.machine?.name || 'destination machine'
      setTransferOpen(false)
      setTransferMachineId('')
      setTransferKg('')
      setTransferProductId('')
      setBanner({
        type: 'ok',
        text: `Moved ${fmt(kg)} kg leftover to ${destName}. Production already made stays on this machine.`,
      })
      await invalidate()
    },
    onError: (err) => setBanner({ type: 'err', text: errMsg(err) }),
  })

  const editMut = useMutation({
    mutationFn: async () => {
      if (!selectedRun || !editing) throw new Error('Nothing to edit')
      if (!editOperatorId) throw new Error('Select an operator')
      if (!editShiftId) throw new Error('Select a shift')
      const emp = (operatorsQuery.data || []).find((e) => String(e.id) === editOperatorId)
      const operatorName = emp
        ? `${emp.firstname || ''} ${emp.lastname || ''}`.trim() || emp.employeeCode || ''
        : ''
      const good = (Number(editGoodDozen) || 0) * 12 + (Number(editGoodPcs) || 0)
      const damage = Number(editDamagePcs) || 0
      const { data } = await api.patch(
        `/production/runs/${selectedRun.id}/shift-logs/${editing.id}`,
        {
          operatorId: Number(editOperatorId),
          operatorName,
          shiftId: Number(editShiftId),
          qtyGood: good,
          qtyReject: damage,
        },
      )
      return data
    },
    onSuccess: async () => {
      setEditing(null)
      setBanner({ type: 'ok', text: 'Record updated' })
      await invalidate()
    },
    onError: (err) => setBanner({ type: 'err', text: errMsg(err) }),
  })

  const openEdit = (row: ShiftLogRow) => {
    const split = splitToDozenPcs(Number(row.qtyGood || 0))
    setEditing(row)
    setEditOperatorId(row.operatorId ? String(row.operatorId) : '')
    setEditShiftId(row.shiftId ? String(row.shiftId) : shiftId)
    setEditGoodDozen(String(split.dozen || ''))
    setEditGoodPcs(String(split.pcs || ''))
    setEditDamagePcs(String(Number(row.qtyReject || 0) || ''))
  }

  const machine = detail.data?.machine
  const shiftLogs = (runDetail.data?.shiftLogs || []).filter((s) => s.status !== 'ACTIVE')
  const faultLogs = runDetail.data?.faultLogs || []

  return (
    <PageLayout
      title={machine ? `${machine.name} · Work & Log` : 'Work & Log'}
      description={undefined}
      back
      backTo="/production"
      backLabel="Back to production"
      actions={
        selectedRun ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 sm:h-8 px-2 sm:px-3 text-[11px] sm:text-xs gap-1 bg-white"
              onClick={() => {
                setBanner(null)
                setTransferKg('')
                setTransferProductId(
                  selectedRun?.productId ? String(selectedRun.productId) : '',
                )
                setTransferMachineId('')
                setTransferOpen(true)
              }}
            >
              <ArrowRightLeft className="size-3.5" />
              Transfer kg
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 sm:h-8 px-2 sm:px-3 text-[11px] sm:text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setBanner(null)
                setFinalizeOpen(true)
              }}
            >
              <CheckCircle2 className="size-3.5" />
              Finalize
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-3">
        {banner ? (
          <p
            className={`text-xs rounded-md px-2.5 py-2 border ${
              banner.type === 'ok'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                : 'bg-red-50 border-red-100 text-red-700'
            }`}
          >
            {banner.text}
          </p>
        ) : null}

        {detail.isLoading ? (
          <p className="text-xs text-zinc-500 py-10 text-center">Loading…</p>
        ) : activeRuns.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 space-y-2">
            <p>No open run on this machine.</p>
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs px-0">
              <Link to={`/production/machines/${machineId}`}>Back to view</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Main column */}
            <div className="lg:col-span-8 space-y-3">
              {/* Material issued / run summary — compact on mobile */}
              <div className="rounded-xl border border-zinc-200 bg-white p-2.5 sm:p-3.5 shadow-xs">
                {selectedRun && mergedTotals ? (
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <div className="rounded-md sm:rounded-lg bg-sky-50/70 border border-sky-100 px-1.5 py-1.5 sm:px-2.5 sm:py-2 min-w-0">
                      <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-sky-700 truncate">
                        Material
                      </p>
                      <p className="text-xs sm:text-sm font-bold tabular-nums text-sky-950 mt-0.5 truncate">
                        {fmt(mergedTotals.materialConsumed)} {mergedTotals.materialUom || 'kg'}
                      </p>
                      <p className="text-[9px] sm:text-[11px] text-sky-800/80 truncate mt-0.5">
                        {mergedTotals.inputBatchNumber || mergedTotals.materialName || '—'}
                        {mergedTotals.inputBatchColor ? ` · ${mergedTotals.inputBatchColor}` : ''}
                      </p>
                    </div>
                    <div className="rounded-md sm:rounded-lg bg-zinc-50 border border-zinc-100 px-1.5 py-1.5 sm:px-2.5 sm:py-2 min-w-0">
                      <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-zinc-400 truncate">
                        Product
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-zinc-900 mt-0.5 truncate">
                        {mergedTotals.productName || '—'}
                      </p>
                      <p className="text-[9px] sm:text-[11px] text-zinc-500 font-mono truncate">
                        {selectedRun.batchNumber || `RUN-${selectedRun.id}`}
                      </p>
                    </div>
                    <div className="rounded-md sm:rounded-lg bg-zinc-50 border border-zinc-100 px-1.5 py-1.5 sm:px-2.5 sm:py-2 min-w-0">
                      <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-zinc-400 truncate">
                        So far
                      </p>
                      <p className="text-xs sm:text-sm font-bold tabular-nums text-emerald-700 mt-0.5 truncate">
                        {fmtDozenPcs(mergedTotals.qtyGood)}
                      </p>
                      <p className="text-[9px] sm:text-[11px] text-zinc-500 truncate">
                        {fmt(mergedTotals.qtyReject)} dmg
                        {mergedTotals.downtimeMinutes > 0
                          ? ` · ${mergedTotals.downtimeMinutes}m`
                          : ''}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Single record form */}
              <form
                className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  setBanner(null)
                  saveMut.mutate()
                }}
              >
                <div>
                  <h3 className="text-xs font-bold text-zinc-900">Record production</h3>
                  <p className="text-[11px] text-zinc-500">
                    Fill operator, shift, and output once. You can edit the record afterwards.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">Operator</Label>
                    <SearchableSelect
                      value={operatorId}
                      onChange={setOperatorId}
                      options={operatorOptions}
                      placeholder="Select operator…"
                      searchPlaceholder="Search operator…"
                      allowClear={false}
                      triggerClassName="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">Shift</Label>
                    <Select value={shiftId} onValueChange={setShiftId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select shift…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(shiftsQuery.data || []).map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                            {s.startTime && s.endTime ? ` (${s.startTime}–${s.endTime})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5 space-y-1.5">
                  <Label className="text-xs font-bold text-emerald-900">Quantity produced</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-emerald-800 font-semibold">Dozen</span>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-xs bg-white mt-0.5"
                        value={goodDozen}
                        onChange={(e) => setGoodDozen(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-800 font-semibold">Pieces</span>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-xs bg-white mt-0.5"
                        value={goodPcs}
                        onChange={(e) => setGoodPcs(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-red-200 bg-red-50/40 p-2.5">
                    <Label className="text-xs font-bold text-red-900 mb-1 block">
                      Damage (pcs)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-xs bg-white"
                      value={damagePcs}
                      onChange={(e) => setDamagePcs(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-2.5">
                    <Label className="text-xs font-bold text-amber-900 mb-1 block">
                      Waste (kg)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      className="h-8 text-xs bg-white"
                      value={wasteKg}
                      onChange={(e) => setWasteKg(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={saveMut.isPending}
                  className="h-9 w-full sm:w-auto sm:min-w-[180px] text-xs font-semibold gap-1.5"
                >
                  <Save className="size-3.5" />
                  {saveMut.isPending ? 'Saving…' : 'Save production'}
                </Button>
              </form>

              {/* Recorded sessions */}
              <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Recorded on this run
                </h3>
                {runDetail.isLoading ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">Loading records…</p>
                ) : shiftLogs.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-4 text-center">
                    No production recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {shiftLogs.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/60 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-900 truncate">
                            {row.operatorName}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {row.shift?.name || 'Shift'}
                            {row.clockOutAt
                              ? ` · ${new Date(row.clockOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-xs font-bold tabular-nums text-emerald-700">
                              {fmtDozenPcs(Number(row.qtyGood || 0))}
                            </p>
                            <p className="text-[10px] tabular-nums text-red-600">
                              {fmt(Number(row.qtyReject || 0))} dmg
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] gap-1 bg-white"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="size-3" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Side: downtime */}
            <div className="lg:col-span-4 space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs space-y-3 lg:sticky lg:top-2">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-amber-600" />
                    Downtime
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Log stoppages while the run is open.
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Category</Label>
                  <Select value={faultCategory} onValueChange={setFaultCategory}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FAULT_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Minutes</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 text-xs"
                    value={faultMinutes}
                    onChange={(e) => setFaultMinutes(e.target.value)}
                    placeholder="e.g. 15"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1 block">Notes (optional)</Label>
                  <Input
                    className="h-8 text-xs"
                    value={faultNotes}
                    onChange={(e) => setFaultNotes(e.target.value)}
                    placeholder="What happened…"
                  />
                </div>

                <Button
                  type="button"
                  size="sm"
                  className="h-8 w-full text-xs gap-1.5"
                  disabled={downtimeMut.isPending}
                  onClick={() => {
                    setBanner(null)
                    downtimeMut.mutate()
                  }}
                >
                  <Check className="size-3.5" />
                  {downtimeMut.isPending ? 'Saving…' : 'Log downtime'}
                </Button>

                <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Clock className="size-3" />
                    History
                    {(selectedRun?.downtimeMinutes || 0) > 0
                      ? ` · ${selectedRun?.downtimeMinutes}m total`
                      : ''}
                  </p>
                  {faultLogs.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 py-2">No downtime logged yet.</p>
                  ) : (
                    faultLogs.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-lg border border-amber-100 bg-amber-50/50 px-2 py-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-zinc-800 truncate">
                            {FAULT_CATEGORIES.find((c) => c.value === f.category)?.label ||
                              f.category}
                          </span>
                          <span className="text-[11px] font-bold tabular-nums text-amber-800 shrink-0">
                            {f.downtimeMinutes}m
                          </span>
                        </div>
                        {f.rootCause ? (
                          <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{f.rootCause}</p>
                        ) : null}
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {f.createdAt ? formatBusinessDate(f.createdAt) : ''}
                          {f.operatorName ? ` · ${f.operatorName}` : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transfer */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md rounded-2xl border-zinc-200 p-0 overflow-visible">
          <div className="p-4 space-y-3">
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <ArrowRightLeft className="size-4" />
                Transfer leftover material
              </DialogTitle>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">To machine</Label>
              <SearchableSelect
                value={transferMachineId}
                onChange={setTransferMachineId}
                options={machineOptions}
                placeholder="Select machine…"
                searchPlaceholder="Search machine…"
                allowClear={false}
                triggerClassName="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Leftover kg (weighed)</Label>
              <Input
                type="number"
                step="any"
                min={0}
                className="h-8 text-xs"
                placeholder="e.g. 45"
                value={transferKg}
                onChange={(e) => setTransferKg(e.target.value)}
              />
              {selectedRun ? (
                <p className="text-[10px] text-zinc-500 mt-1">
                  Issued on this run: {fmt(selectedRun.materialConsumed)}{' '}
                  {selectedRun.materialUom || 'kg'} · enter only what you weighed out
                </p>
              ) : null}
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">
                Product on destination (if starting fresh)
              </Label>
              <SearchableSelect
                value={transferProductId}
                onChange={setTransferProductId}
                options={productOptions}
                placeholder="Product they will run…"
                searchPlaceholder="Search product…"
                allowClear={false}
                triggerClassName="h-8 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setTransferOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={transferMut.isPending}
                onClick={() => transferMut.mutate()}
              >
                <Check className="size-3.5" />
                {transferMut.isPending ? 'Moving kg…' : 'Transfer kg'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent className="max-w-md rounded-2xl border-zinc-200 p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600/10 via-emerald-500/5 to-transparent border-b border-emerald-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-zinc-900">
                  Finalize & complete run
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-600 mt-0.5">
                  Close this run and release goods to finished store.
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3 text-xs text-zinc-700">
            {selectedRun ? (
              <div className="rounded-xl bg-zinc-50 p-3 border border-zinc-200/80 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Material issued</span>
                  <strong className="tabular-nums">
                    {fmt(selectedRun.materialConsumed)} {selectedRun.materialUom || 'kg'}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Good produced</span>
                  <strong className="text-emerald-700 tabular-nums">
                    {fmtDozenPcs(selectedRun.qtyGood)}
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Damage</span>
                  <strong className="text-red-600 tabular-nums">
                    {fmt(selectedRun.qtyReject)} pcs
                  </strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-500">Batch</span>
                  <strong className="font-mono">
                    {selectedRun.batchNumber || `RUN-${selectedRun.id}`}
                  </strong>
                </div>
              </div>
            ) : null}
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Make sure all production for this run is recorded before finalizing.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold"
                onClick={() => setFinalizeOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={finalizeMut.isPending}
                onClick={() => finalizeMut.mutate()}
                className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <CheckCircle2 className="size-3.5" />
                {finalizeMut.isPending ? 'Finalizing…' : 'Confirm & complete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit record */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md rounded-2xl border-zinc-200 p-0 overflow-visible">
          <div className="p-4 space-y-3">
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900">Edit record</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-zinc-600">
                Adjust operator, shift, or quantities for this saved entry.
              </DialogDescription>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Operator</Label>
              <SearchableSelect
                value={editOperatorId}
                onChange={setEditOperatorId}
                options={operatorOptions}
                placeholder="Select operator…"
                searchPlaceholder="Search operator…"
                allowClear={false}
                triggerClassName="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Shift</Label>
              <Select value={editShiftId} onValueChange={setEditShiftId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(shiftsQuery.data || []).map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold mb-1 block">Dozen</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 text-xs"
                  value={editGoodDozen}
                  onChange={(e) => setEditGoodDozen(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Pieces</Label>
                <Input
                  type="number"
                  min={0}
                  className="h-8 text-xs"
                  value={editGoodPcs}
                  onChange={(e) => setEditGoodPcs(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">Damage (pcs)</Label>
              <Input
                type="number"
                min={0}
                className="h-8 text-xs"
                value={editDamagePcs}
                onChange={(e) => setEditDamagePcs(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={editMut.isPending}
                onClick={() => {
                  setBanner(null)
                  editMut.mutate()
                }}
              >
                <Check className="size-3.5" />
                {editMut.isPending ? 'Saving…' : 'Update'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
