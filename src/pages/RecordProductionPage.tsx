import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'

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
  qtyGood: string
  qtyReject: string
  qtyProduced: string
  labourRate: string
  labourCost: string
  energyCost: string
  otherCost: string
  notes: string
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
      qtyGood: '',
      qtyReject: '0',
      qtyProduced: '0',
      labourRate: '10',
      labourCost: '0',
      energyCost: '0',
      otherCost: '0',
      notes: '',
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

  // Calculate total produced automatically: Good + Reject = Total
  const watchGood = Number(form.watch('qtyGood') || 0)
  const watchReject = Number(form.watch('qtyReject') || 0)
  const totalProduced = watchGood + watchReject

  useEffect(() => {
    form.setValue('qtyProduced', String(totalProduced))
  }, [totalProduced, form])

  // Watch material consumed and rate to calculate labor cost
  const watchConsumed = Number(form.watch('materialConsumed') || 0)
  const watchRate = Number(form.watch('labourRate') || 0)
  const handleLabourRateChange = (rateStr: string, consumedKg: number) => {
    const r = Number(rateStr) || 0
    const calculated = +(r * 10 * consumedKg).toFixed(2)
    form.setValue('labourCost', String(calculated))
  }

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
        labourCost: Number(values.labourCost || 0),
        energyCost: Number(values.energyCost || 0),
        otherCost: Number(values.otherCost || 0),
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
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back Link */}
      <div>
        <Link
          to="/production"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Production Runs
        </Link>
      </div>

      <PageHeader
        eyebrow="Shop Floor Manufacturing"
        title="Record Production (1-Step Completed)"
        description="Log a complete production run with material consumed, shift time selection, good and reject pieces, and labor cost."
      />

      {serverError && (
        <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 border border-red-200">
          {serverError}
        </div>
      )}

      {warning && (
        <div className="rounded-xl bg-amber-50 p-4 border border-amber-200">
          <p className="text-sm font-semibold text-amber-900">
            Reject rate {warning.rejectPercent}% looks unusual. Confirm to save anyway?
          </p>
          <button
            type="button"
            className="dgn-btn dgn-btn-primary mt-3 text-xs"
            onClick={form.handleSubmit((vals) => onSubmit(vals, true))}
          >
            Confirm unusual run
          </button>
        </div>
      )}

      <form className="space-y-4" onSubmit={form.handleSubmit((vals) => onSubmit(vals, false))}>
        {/* Machine & Product */}
        <Card>
          <h2 className="text-base font-semibold text-zinc-900">Machine, Product & Staff</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
        </Card>

        {/* Shift Timing & Runtime Selection */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Shift Timing & Runtime</h2>
            <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700">
              Runtime: {Math.floor(runtimeMins / 60)} hrs {runtimeMins % 60} mins ({runtimeMins} min)
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Times pre-fill based on the selected shift. You can adjust the start and end times
            freely.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
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
                placeholder="e.g. Power, mould adjustment"
                {...form.register('downtimeReason')}
              />
            </Field>
          </div>
        </Card>

        {/* Material & Output Units */}
        <Card>
          <h2 className="text-base font-semibold text-zinc-900">Material & Finished Pieces</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Dried Material Batch (Input)">
              <select
                className="dgn-input"
                {...form.register('inputBatchNumber', { required: true })}
              >
                <option value="">Choose batch</option>
                {inputs.data?.map((b) => (
                  <option key={b.id} value={b.batchNumber}>
                    {b.batchNumber} · {b.material?.name || b.batchType} · {b.qtyRemaining} {b.uom}{' '}
                    available
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
                {...form.register('materialConsumed', {
                  required: true,
                  onChange: (e) => {
                    handleLabourRateChange(form.getValues('labourRate'), Number(e.target.value) || 0)
                  },
                })}
              />
            </Field>
          </div>

          {selectedBatch && (
            <p className="mt-2 text-xs text-zinc-500">
              Selected: <strong>{selectedBatch.batchNumber}</strong> · Available:{' '}
              <strong>{selectedBatch.qtyRemaining} kg</strong>
            </p>
          )}

          {/* Automatic Output Calculation: Good + Bad = Total */}
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                Units Produced Breakdown
              </p>
              <span className="text-xs font-semibold text-emerald-800">
                Total Produced: <strong>{totalProduced.toLocaleString()} pcs</strong>
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Good Units (pcs)">
                <input
                  inputMode="decimal"
                  type="number"
                  placeholder="e.g. 480"
                  className="dgn-input font-bold text-emerald-700"
                  {...form.register('qtyGood', { required: true })}
                />
              </Field>

              <Field label="Reject Units (pcs)">
                <input
                  inputMode="decimal"
                  type="number"
                  placeholder="0"
                  className="dgn-input font-semibold text-red-600"
                  {...form.register('qtyReject')}
                />
              </Field>

              <Field
                label="Total Produced (pcs) — Auto Calculated"
                hint="Automatically calculated: Good + Reject"
              >
                <input
                  readOnly
                  type="number"
                  value={totalProduced}
                  className="dgn-input font-bold bg-zinc-100 text-zinc-900 cursor-not-allowed"
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* Labor calculation */}
        <Card className="border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-amber-950">
                Labor Calculation (Rate × 10 × kg used)
              </h2>
              <p className="mt-0.5 text-xs text-amber-800">
                Formula: Rate ₦{watchRate} × 10 × {watchConsumed} kg = ₦
                {(watchRate * 10 * watchConsumed).toFixed(2)}
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
              ₦{(watchRate * 10 * watchConsumed).toFixed(2)}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Labor Rate (₦)">
              <input
                inputMode="decimal"
                type="number"
                step="any"
                className="dgn-input"
                placeholder="e.g. 10"
                {...form.register('labourRate', {
                  onChange: (e) => {
                    handleLabourRateChange(
                      e.target.value,
                      Number(form.getValues('materialConsumed')) || 0
                    )
                  },
                })}
              />
            </Field>

            <Field label="Calculated Labour Cost ₦ (Editable)">
              <input
                inputMode="decimal"
                type="number"
                step="any"
                className="dgn-input font-bold text-amber-900"
                {...form.register('labourCost')}
              />
            </Field>
          </div>
        </Card>

        {/* Costs & Notes */}
        <Card>
          <h2 className="text-base font-semibold text-zinc-900">Energy & Other Costs</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Energy ₦">
              <input
                inputMode="decimal"
                type="number"
                step="any"
                className="dgn-input"
                {...form.register('energyCost')}
              />
            </Field>
            <Field label="Other Cost ₦">
              <input
                inputMode="decimal"
                type="number"
                step="any"
                className="dgn-input"
                {...form.register('otherCost')}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Notes">
              <textarea rows={2} className="dgn-input" {...form.register('notes')} />
            </Field>
          </div>
        </Card>

        {/* Live Metrics Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="dgn-btn dgn-btn-ghost"
            onClick={() => navigate('/production')}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="dgn-btn dgn-btn-primary flex items-center gap-2"
          >
            <CheckCircle2 className="size-4" />
            {form.formState.isSubmitting ? 'Saving…' : 'Save Completed Run'}
          </button>
        </div>
      </form>
    </div>
  )
}
