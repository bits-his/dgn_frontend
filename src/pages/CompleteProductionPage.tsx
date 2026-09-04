import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Factory, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'

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
  startedAt: string | null
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
    ratedOutputPerHour?: string | number
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
    startTime?: string
    endTime?: string
  }
}

type CompleteFormValues = {
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

export function CompleteProductionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState('')
  const [warning, setWarning] = useState<{ rejectPercent: number } | null>(null)

  // Fetch production runs to find this run
  const runsQuery = useQuery({
    queryKey: ['production-runs'],
    queryFn: async () => {
      const { data } = await api.get('/production/runs')
      return (data.data || []) as ProductionRunRow[]
    },
  })

  const run = useMemo(() => {
    return runsQuery.data?.find((r) => String(r.id) === id) || null
  }, [runsQuery.data, id])

  const form = useForm<CompleteFormValues>({
    defaultValues: {
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

  // When run data arrives, initialize times and labor
  useEffect(() => {
    if (run) {
      const consumed = Number(run.materialConsumed || 0)
      const rate = 10
      const calculated = (rate * 10 * consumed).toFixed(2)
      form.setValue('labourRate', '10')
      form.setValue('labourCost', calculated)

      if (run.shift?.startTime && run.shift?.endTime) {
        form.setValue('startTime', run.shift.startTime)
        form.setValue('endTime', run.shift.endTime)
        const mins = calculateMinutesBetween(run.shift.startTime, run.shift.endTime)
        form.setValue('runtimeMinutes', String(mins))
        form.setValue('scheduledMinutes', String(mins))
      }
    }
  }, [run, form])

  const consumedKg = Number(run?.materialConsumed || 0)
  const watchGood = Number(form.watch('qtyGood') || 0)
  const watchReject = Number(form.watch('qtyReject') || 0)
  const totalProduced = watchGood + watchReject

  useEffect(() => {
    form.setValue('qtyProduced', String(totalProduced))
  }, [totalProduced, form])

  const watchStartTime = form.watch('startTime')
  const watchEndTime = form.watch('endTime')
  const handleTimeChange = (start: string, end: string) => {
    const mins = calculateMinutesBetween(start, end)
    form.setValue('runtimeMinutes', String(mins))
    form.setValue('scheduledMinutes', String(mins))
  }

  const runtimeMins = Number(form.watch('runtimeMinutes') || 0)
  const scheduledMins = Number(form.watch('scheduledMinutes') || 0) || runtimeMins
  const labourRate = Number(form.watch('labourRate') || 0)

  // Recalculate labor whenever rate changes
  const handleRateChange = (newRate: string) => {
    const r = Number(newRate) || 0
    const calculated = +(r * 10 * consumedKg).toFixed(2)
    form.setValue('labourCost', String(calculated))
  }

  // Live metrics preview
  const liveMetrics = useMemo(() => {
    const yieldPct = totalProduced > 0 ? +((watchGood / totalProduced) * 100).toFixed(1) : 0
    const rejectPct = totalProduced > 0 ? +((watchReject / totalProduced) * 100).toFixed(1) : 0
    const hours = runtimeMins / 60
    const perHour = hours > 0 ? +(totalProduced / hours).toFixed(1) : 0
    const availability = scheduledMins > 0 ? +((runtimeMins / scheduledMins) * 100).toFixed(1) : 0
    const rated = Number(run?.machine?.ratedOutputPerHour || 0)
    const performance = rated > 0 && hours > 0 ? +((totalProduced / (rated * hours)) * 100).toFixed(1) : 0
    const quality = totalProduced > 0 ? +((watchGood / totalProduced) * 100).toFixed(1) : 0
    const oee =
      availability && performance && quality
        ? +(((availability / 100) * (performance / 100) * (quality / 100)) * 100).toFixed(1)
        : 0
    return { yieldPct, rejectPct, perHour, oee }
  }, [totalProduced, watchGood, watchReject, runtimeMins, scheduledMins, run])

  const onSubmit = async (values: CompleteFormValues, confirmUnusualRun = false) => {
    if (!id) return
    setServerError('')
    setWarning(null)
    const good = Number(values.qtyGood || 0)
    const reject = Number(values.qtyReject || 0)
    const produced = good + reject

    try {
      await api.post(`/production/runs/${id}/complete`, {
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
      setServerError(res?.data?.err || res?.data?.message || 'Failed to complete production run')
    }
  }

  if (runsQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-2">
        <Clock className="size-6 animate-spin text-[var(--accent)]" />
        <p>Loading production run details…</p>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <p className="text-base font-semibold text-zinc-800">Production run not found.</p>
        <Link to="/production" className="dgn-btn dgn-btn-primary">
          Return to Production
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back link */}
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
        eyebrow="Shift Completion"
        title={`Complete Production — ${run.batch?.batchNumber || `Run #${run.id}`}`}
        description="Select shift start and end times, enter good pieces and defective rejects, calculate labor cost, and issue the completed goods batch."
      />

      {/* Compact Run Summary Banner */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Factory className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900">
                {run.batch?.batchNumber || `Run #${run.id}`}
              </span>
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                In progress
              </span>
            </div>
            <p className="text-xs text-zinc-400">Started {formatDateTime(run.startedAt)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Machine</span>
            <span className="font-semibold text-zinc-800">{run.machine?.name || '—'}</span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">Product</span>
            <span className="font-semibold text-zinc-800">
              {run.product?.name || '—'} ({run.product?.uom || 'pcs'})
            </span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">
              Operator & Shift
            </span>
            <span className="font-semibold text-zinc-800">
              {run.operatorName || '—'} {run.shift?.name ? `(${run.shift.name})` : ''}
            </span>
          </div>
          <div>
            <span className="text-zinc-400 block text-[10px] uppercase font-bold">
              Material Issued
            </span>
            <span className="font-bold text-amber-700">{fmt(run.materialConsumed, 1)} kg</span>
          </div>
        </div>
      </div>

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
        {/* Shift Timing & Runtime Selection */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Shift Timing & Runtime</h2>
            <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-700">
              Runtime: {Math.floor(runtimeMins / 60)} hrs {runtimeMins % 60} mins ({runtimeMins} min)
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Times default to shift standards ({run.shift?.name || 'Shift'}). Adjust start and end
            times as needed.
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
                placeholder="e.g. Power, mould jammed"
                {...form.register('downtimeReason')}
              />
            </Field>
          </div>
        </Card>

        {/* Output Pieces with automatic total */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">Finished Units Breakdown</h2>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              Total Produced: {totalProduced.toLocaleString()} pcs
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Good Units (pcs)">
              <input
                inputMode="decimal"
                type="number"
                placeholder="e.g. 480"
                className="dgn-input font-bold text-emerald-700 text-base"
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
              hint="Good + Reject units"
            >
              <input
                readOnly
                type="number"
                value={totalProduced}
                className="dgn-input font-bold bg-zinc-100 text-zinc-900 cursor-not-allowed text-base"
              />
            </Field>
          </div>
        </Card>

        {/* Labor Calculation Section */}
        <Card className="border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-amber-950">
                Labor Calculation (Rate × 10 × kg used)
              </h2>
              <p className="mt-0.5 text-xs text-amber-800">
                Formula: Rate ₦{labourRate} × 10 × {fmt(consumedKg, 1)} kg = ₦
                {fmt(labourRate * 10 * consumedKg, 2)}
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
              ₦{fmt(labourRate * 10 * consumedKg, 2)}
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
                  onChange: (e) => handleRateChange(e.target.value),
                })}
              />
            </Field>

            <Field label="Calculated Labour Cost ₦ (Editable)">
              <input
                inputMode="decimal"
                type="number"
                step="any"
                className="dgn-input font-bold text-amber-950"
                {...form.register('labourCost')}
              />
            </Field>
          </div>
        </Card>

        {/* Other Costs */}
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
            <Field label="Shift Completion Notes">
              <textarea
                rows={2}
                className="dgn-input"
                placeholder="Machine performance, operator feedback, mould condition..."
                {...form.register('notes')}
              />
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
            {form.formState.isSubmitting ? 'Saving Output…' : 'Complete Run & Save Output'}
          </button>
        </div>
      </form>
    </div>
  )
}
