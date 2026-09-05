import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, StatPill } from '@/components/ui'
import { SORT_COLORS } from '@/lib/sortColors'

function colorName(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

function fmt(value: string | number | null | undefined, digits = 1) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: digits })
    : String(value)
}

function fmtDozensPcs(totalPcs: number) {
  if (!totalPcs || totalPcs <= 0) return '0 pcs'
  const dz = Math.floor(totalPcs / 12)
  const pcs = Math.round(totalPcs % 12)
  if (dz > 0 && pcs > 0) return `${dz} dz ${pcs} pcs`
  if (dz > 0) return `${dz} dz`
  return `${pcs} pcs`
}

type MasterItem = {
  id: number
  name: string
  code?: string
  uom?: string
  startTime?: string
  endTime?: string
  ratedOutputPerHour?: string | number
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

type SingleStepFormValues = {
  machineId: string
  productId: string
  inputBatchNumber: string
  shiftId: string
  operatorName: string
  materialConsumed: string
  startTime: string
  endTime: string
  runtimeMinutes: string
  downtimeMinutes: string
  downtimeReason: string
  scheduledMinutes: string
  goodDozen: string
  goodPcs: string
  wasteDozen: string
  wastePcs: string
  qtyGood: string
  qtyReject: string
  qtyProduced: string
  labourRate: string
  labourCost: string
  energyCost: string
  otherCost: string
  notes: string
  autoRelease: boolean
}

function calculateMinutesBetween(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return 0

  let diff = eh * 60 + em - (sh * 60 + sm)
  if (diff < 0) {
    // Overnight shift (e.g. 22:00 to 06:00)
    diff += 24 * 60
  }
  return diff
}

export function RecordProductionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState('')
  const [warning, setWarning] = useState<{ rejectPercent: number } | null>(null)

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

  const form = useForm<SingleStepFormValues>({
    defaultValues: {
      machineId: '',
      productId: '',
      inputBatchNumber: '',
      shiftId: '',
      operatorName: '',
      materialConsumed: '',
      startTime: '06:00',
      endTime: '14:00',
      runtimeMinutes: '480',
      downtimeMinutes: '0',
      downtimeReason: '',
      scheduledMinutes: '480',
      goodDozen: '',
      goodPcs: '',
      wasteDozen: '',
      wastePcs: '',
      qtyGood: '0',
      qtyReject: '0',
      qtyProduced: '0',
      labourRate: '10',
      labourCost: '0',
      energyCost: '0',
      otherCost: '0',
      notes: '',
      autoRelease: true,
    },
  })

  // Watch shift changes to pre-populate start and end time
  const selectedShiftId = form.watch('shiftId')
  useEffect(() => {
    if (selectedShiftId && shifts.data) {
      const shift = shifts.data.find((s) => String(s.id) === selectedShiftId)
      if (shift && shift.startTime && shift.endTime) {
        form.setValue('startTime', shift.startTime)
        form.setValue('endTime', shift.endTime)
        const mins = calculateMinutesBetween(shift.startTime, shift.endTime)
        form.setValue('runtimeMinutes', String(mins))
        form.setValue('scheduledMinutes', String(mins))
      }
    }
  }, [selectedShiftId, shifts.data, form])

  // Watch time changes to calculate runtime
  const watchStartTime = form.watch('startTime')
  const watchEndTime = form.watch('endTime')
  const handleTimeChange = (start: string, end: string) => {
    const mins = calculateMinutesBetween(start, end)
    form.setValue('runtimeMinutes', String(mins))
    form.setValue('scheduledMinutes', String(mins))
  }

  // Watch dozen & pcs for good units and waste units
  const watchGoodDozen = form.watch('goodDozen')
  const watchGoodPcs = form.watch('goodPcs')
  const watchWasteDozen = form.watch('wasteDozen')
  const watchWastePcs = form.watch('wastePcs')

  useEffect(() => {
    const totalGood = Math.round(Number(watchGoodDozen || 0) * 12) + Number(watchGoodPcs || 0)
    form.setValue('qtyGood', String(totalGood))
  }, [watchGoodDozen, watchGoodPcs, form])

  useEffect(() => {
    const totalWaste = Math.round(Number(watchWasteDozen || 0) * 12) + Number(watchWastePcs || 0)
    form.setValue('qtyReject', String(totalWaste))
  }, [watchWasteDozen, watchWastePcs, form])

  // Calculate total produced automatically: Good + Reject = Total
  const watchGood = Number(form.watch('qtyGood') || 0)
  const watchReject = Number(form.watch('qtyReject') || 0)
  const totalProduced = watchGood + watchReject

  useEffect(() => {
    form.setValue('qtyProduced', String(totalProduced))
  }, [totalProduced, form])

  // Live metrics calculations
  const runtimeMins = Number(form.watch('runtimeMinutes') || 0)
  const scheduledMins = Number(form.watch('scheduledMinutes') || 0) || runtimeMins
  const selectedMachineId = form.watch('machineId')
  const selectedMachine = machines.data?.find((m) => String(m.id) === selectedMachineId)

  const liveMetrics = useMemo(() => {
    const yieldPct = totalProduced > 0 ? +((watchGood / totalProduced) * 100).toFixed(1) : 0
    const rejectPct = totalProduced > 0 ? +((watchReject / totalProduced) * 100).toFixed(1) : 0
    const hours = runtimeMins / 60
    const perHour = hours > 0 ? +(totalProduced / hours).toFixed(1) : 0
    const availability = scheduledMins > 0 ? +((runtimeMins / scheduledMins) * 100).toFixed(1) : 0
    const rated = Number(selectedMachine?.ratedOutputPerHour || 0)
    const performance = rated > 0 && hours > 0 ? +((totalProduced / (rated * hours)) * 100).toFixed(1) : 0
    const quality = totalProduced > 0 ? +((watchGood / totalProduced) * 100).toFixed(1) : 0
    const oee =
      availability && performance && quality
        ? +(((availability / 100) * (performance / 100) * (quality / 100)) * 100).toFixed(1)
        : 0
    return { yieldPct, rejectPct, perHour, oee }
  }, [totalProduced, watchGood, watchReject, runtimeMins, scheduledMins, selectedMachine])

  const onSubmit = async (values: SingleStepFormValues, confirmUnusualRun = false) => {
    setServerError('')
    setWarning(null)
    const good = Number(values.qtyGood || 0)
    const reject = Number(values.qtyReject || 0)
    const produced = good + reject

    if (produced <= 0) {
      setServerError('Please enter finished units produced (dozen and/or pieces)')
      return
    }

    try {
      await api.post('/production/runs', {
        machineId: Number(values.machineId),
        productId: Number(values.productId),
        inputBatchNumber: values.inputBatchNumber,
        shiftId: values.shiftId ? Number(values.shiftId) : null,
        operatorName: values.operatorName || null,
        materialConsumed: Number(values.materialConsumed),
        qtyProduced: produced,
        qtyGood: good,
        qtyReject: reject,
        runtimeMinutes: Number(values.runtimeMinutes || 0),
        downtimeMinutes: Number(values.downtimeMinutes || 0),
        downtimeReason: values.downtimeReason || null,
        scheduledMinutes: Number(values.scheduledMinutes || 0),
        labourCost: 0,
        energyCost: 0,
        otherCost: 0,
        autoRelease: values.autoRelease !== false,
        notes: values.notes || null,
        confirmUnusualRun,
      })
      await queryClient.invalidateQueries({ queryKey: ['production-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
      navigate('/production')
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number
          data?: {
            warning?: boolean
            message?: string
            rejectPercent?: number
            errors?: Record<string, string>
            err?: string
          }
        }
      }
      const res = axiosErr.response
      if (res?.status === 422 && res.data?.warning) {
        setWarning({ rejectPercent: res.data.rejectPercent ?? 0 })
        return
      }
      if (res?.data?.errors) {
        setServerError(Object.values(res.data.errors).join(' · '))
        return
      }
      setServerError(res?.data?.err || res?.data?.message || 'Failed to save production run')
    }
  }

  const selectedBatch = inputs.data?.find((b) => b.batchNumber === form.watch('inputBatchNumber'))

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-2 pb-3 border-b border-zinc-100 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/production"
            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
        </div>

        {serverError && (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
            {serverError}
          </div>
        )}

        {warning && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 border border-amber-200">
            <p className="text-xs font-semibold text-amber-900">
              Reject rate {warning.rejectPercent}% looks unusual. Confirm to save anyway?
            </p>
            <button
              type="button"
              className="dgn-btn dgn-btn-primary mt-2 text-xs"
              onClick={form.handleSubmit((vals) => onSubmit(vals, true))}
            >
              Confirm unusual run
            </button>
          </div>
        )}

        <form className="mt-3.5 space-y-3.5" onSubmit={form.handleSubmit((vals) => onSubmit(vals, false))}>
          {/* Section 1: Machine, Product & Staff */}
          <div>
            <div className="border-b border-zinc-100 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">1. Machine, Product & Staff</h2>
            </div>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              <Field label="Machine">
                <select className="dgn-input" {...form.register('machineId', { required: true })}>
                  <option value="">Select machine</option>
                  {machines.data?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.code})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Product">
                <select className="dgn-input" {...form.register('productId', { required: true })}>
                  <option value="">Select product</option>
                  {products.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.uom || 'pcs'})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Shift (Auto-sets standard times)">
                <select className="dgn-input" {...form.register('shiftId')}>
                  <option value="">Select shift</option>
                  {shifts.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime || ''} - {s.endTime || ''})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Operator">
                <select className="dgn-input" {...form.register('operatorName')}>
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
          </div>

          {/* Section 2: Shift Timing & Runtime */}
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">2. Shift Timing & Runtime</h2>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700">
                Runtime: {Math.floor(runtimeMins / 60)}h {runtimeMins % 60}m ({runtimeMins} min)
              </span>
            </div>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-4">
              <Field label="Start Time">
                <input
                  type="time"
                  className="dgn-input font-medium"
                  {...form.register('startTime', {
                    onChange: (e) => handleTimeChange(e.target.value, watchEndTime),
                  })}
                />
              </Field>

              <Field label="End Time">
                <input
                  type="time"
                  className="dgn-input font-medium"
                  {...form.register('endTime', {
                    onChange: (e) => handleTimeChange(watchStartTime, e.target.value),
                  })}
                />
              </Field>

              <Field label="Downtime (min)">
                <input
                  inputMode="numeric"
                  type="number"
                  placeholder="0"
                  className="dgn-input"
                  {...form.register('downtimeMinutes')}
                />
              </Field>

              <Field label="Downtime Reason">
                <input
                  className="dgn-input"
                  placeholder="e.g. Power, mould change"
                  {...form.register('downtimeReason')}
                />
              </Field>
            </div>
          </div>

          {/* Section 3: Material & Finished Pieces Output */}
          <div>
            <div className="border-b border-zinc-100 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">3. Material & Finished Pieces Output</h2>
            </div>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              <Field label="Raw Material Batch">
                <select
                  className="dgn-input"
                  {...form.register('inputBatchNumber', { required: true })}
                >
                  <option value="">Select raw material batch</option>
                  {inputs.data?.map((b) => (
                    <option key={b.id} value={b.batchNumber}>
                      {b.batchNumber} · {b.material?.name || b.batchType} ({fmt(b.qtyRemaining, 1)} {b.uom})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Material Consumed (kg)">
                <input
                  inputMode="decimal"
                  type="number"
                  step="any"
                  className="dgn-input font-bold"
                  placeholder="e.g. 100"
                  {...form.register('materialConsumed', { required: true })}
                />
              </Field>
            </div>

            {selectedBatch && (
              <div className="mt-2.5 rounded-xl border border-emerald-300 bg-emerald-50/90 p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Selected Material
                  </span>
                  <p className="text-sm font-black text-emerald-950">
                    {selectedBatch.material?.name || selectedBatch.batchType || 'Raw Material'}
                    {selectedBatch.sortColor ? ` · ${colorName(selectedBatch.sortColor)}` : ''}
                  </p>
                  <p className="text-xs font-semibold text-emerald-700">
                    Batch #{selectedBatch.batchNumber}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Available in Store
                  </span>
                  <p className="text-xl font-black text-emerald-900 tabular-nums">
                    {fmt(selectedBatch.qtyRemaining, 1)}{' '}
                    <span className="text-xs font-extrabold uppercase">{selectedBatch.uom || 'kg'}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Finished Units Breakdown (Dozen & Pieces for Good & Waste) */}
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                  Finished Units Breakdown
                </span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                  Total Output: {totalProduced.toLocaleString()} pcs {totalProduced > 0 ? `(${fmtDozensPcs(totalProduced)})` : ''}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Good Units: 2 inputs (Dozen & Pcs) */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Good Units
                    </span>
                    <span className="text-xs font-black text-emerald-800 tabular-nums">
                      = {watchGood.toLocaleString()} pcs
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Dozen (dz)">
                      <input
                        inputMode="decimal"
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        className="dgn-input font-bold text-emerald-800 bg-white"
                        {...form.register('goodDozen')}
                      />
                    </Field>
                    <Field label="Pieces (pcs)">
                      <input
                        inputMode="numeric"
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        className="dgn-input font-bold text-emerald-800 bg-white"
                        {...form.register('goodPcs')}
                      />
                    </Field>
                  </div>
                </div>

                {/* Waste Units: 2 inputs (Dozen & Pcs) */}
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-950 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-red-500" />
                      Waste Units
                    </span>
                    <span className="text-xs font-black text-red-700 tabular-nums">
                      = {watchReject.toLocaleString()} pcs
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Dozen (dz)">
                      <input
                        inputMode="decimal"
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        className="dgn-input font-semibold text-red-700 bg-white"
                        {...form.register('wasteDozen')}
                      />
                    </Field>
                    <Field label="Pieces (pcs)">
                      <input
                        inputMode="numeric"
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        className="dgn-input font-semibold text-red-700 bg-white"
                        {...form.register('wastePcs')}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div>
            <Field label="Notes / Shift Remarks">
              <textarea rows={2} className="dgn-input" placeholder="Optional notes on this run..." {...form.register('notes')} />
            </Field>
          </div>

          {/* Quality Control Auto-Approval Checkbox */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 transition-colors hover:bg-emerald-50/80">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                {...form.register('autoRelease')}
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  Auto-approve for sale (Skip Quality Control & ready to sell)
                </span>
                <p className="text-[11px] text-emerald-700">
                  When active, finishes with <strong>ACCEPTED</strong> status so it is immediately available for sale in the Sales module. Uncheck if this batch must go through manual inspection in the QC queue.
                </p>
              </div>
            </label>
          </div>

          {/* Live Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-100">
            <StatPill label="Yield %" value={`${liveMetrics.yieldPct}%`} tone="success" />
            <StatPill
              label="Reject %"
              value={`${liveMetrics.rejectPct}%`}
              tone={liveMetrics.rejectPct > 5 ? 'danger' : 'default'}
            />
            <StatPill label="Output / hr" value={String(liveMetrics.perHour)} />
            <StatPill
              label="OEE (live)"
              value={`${liveMetrics.oee}%`}
              tone={liveMetrics.oee >= 80 ? 'success' : liveMetrics.oee >= 60 ? 'accent' : 'default'}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
            <button
              type="button"
              className="dgn-btn dgn-btn-ghost text-xs"
              onClick={() => navigate('/production')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="dgn-btn dgn-btn-primary text-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              {form.formState.isSubmitting ? 'Saving…' : 'Save Completed Run'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
