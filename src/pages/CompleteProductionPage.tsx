import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Factory, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, StatPill } from '@/components/ui'

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
  scheduledMinutes: string
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
      scheduledMinutes: '480',
      qtyGood: '',
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
        scheduledMinutes: Number(values.scheduledMinutes || 0),
        labourCost: Number(values.labourCost || 0),
        energyCost: Number(values.energyCost || 0),
        otherCost: Number(values.otherCost || 0),
        autoRelease: values.autoRelease !== false,
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
    <div className="max-w-3xl mx-auto space-y-3">
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

      {/* Compact Run Summary Banner */}
      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-zinc-100">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Factory className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-zinc-900">
                {run.batch?.batchNumber || `Run #${run.id}`}
              </span>
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                In progress
              </span>
              {Number(run.downtimeMinutes || 0) > 0 && (
                <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                  Downtime: {run.downtimeMinutes}m{run.downtimeReason ? ` (${run.downtimeReason})` : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">Started {formatDateTime(run.startedAt)}</p>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
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
        <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 border border-red-200">
          {serverError}
        </div>
      )}

      {warning && (
        <div className="rounded-xl bg-amber-50 p-3 border border-amber-200">
          <p className="text-sm font-semibold text-amber-900">
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

      {/* SINGLE CARD FOR SHIFT COMPLETION */}
      <Card className="!p-4 shadow-xs border border-zinc-200">
        <form className="space-y-4" onSubmit={form.handleSubmit((vals) => onSubmit(vals, false))}>
          {/* Section 1: Shift Timing */}
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">1. Shift Timing & Runtime</h2>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-700">
                Runtime: {Math.floor(runtimeMins / 60)}h {runtimeMins % 60}m ({runtimeMins} min)
              </span>
            </div>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              <Field label="Shift Start Time">
                <input
                  type="time"
                  className="dgn-input font-medium"
                  {...form.register('startTime', {
                    onChange: (e) => handleTimeChange(e.target.value, watchEndTime),
                  })}
                />
              </Field>

              <Field label="Shift End Time">
                <input
                  type="time"
                  className="dgn-input font-medium"
                  {...form.register('endTime', {
                    onChange: (e) => handleTimeChange(watchStartTime, e.target.value),
                  })}
                />
              </Field>
            </div>
          </div>

          {/* Section 2: Output Pieces */}
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">2. Finished Units Breakdown</h2>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Total: {totalProduced.toLocaleString()} pcs
              </span>
            </div>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
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
                label="Total Produced (pcs)"
                hint="Good + Reject units (Auto)"
              >
                <input
                  readOnly
                  type="number"
                  value={totalProduced}
                  className="dgn-input font-bold bg-zinc-100 text-zinc-900 cursor-not-allowed text-base"
                />
              </Field>
            </div>
          </div>

          {/* Section 3: Labor Calculation */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/60">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                  3. Labor Calculation (Rate × 10 × kg used)
                </h2>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Formula: Rate ₦{labourRate} × 10 × {fmt(consumedKg, 1)} kg = ₦
                  {fmt(labourRate * 10 * consumedKg, 2)}
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                ₦{fmt(labourRate * 10 * consumedKg, 2)}
              </span>
            </div>

            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              <Field label="Labor Rate (₦)">
                <input
                  inputMode="decimal"
                  type="number"
                  step="any"
                  className="dgn-input bg-white"
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
                  className="dgn-input font-bold text-amber-950 bg-white"
                  {...form.register('labourCost')}
                />
              </Field>
            </div>
          </div>

          {/* Section 4: Other Costs */}
          <div>
            <div className="border-b border-zinc-100 pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">4. Energy & Other Costs</h2>
            </div>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
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
              {form.formState.isSubmitting ? 'Saving Output…' : 'Complete Run & Save Output'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
