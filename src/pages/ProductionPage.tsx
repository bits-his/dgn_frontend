import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'

type MasterItem = { id: number; name: string; code?: string; uom?: string; ratedOutputPerHour?: number }

type InputBatch = {
  id: number
  batchNumber: string
  batchType: string
  qtyRemaining: number | string
  uom: string
  material?: { name: string }
}

type FormValues = {
  machineId: string
  productId: string
  inputBatchNumber: string
  shiftId: string
  operatorName: string
  materialConsumed: string
  qtyProduced: string
  qtyGood: string
  qtyReject: string
  runtimeMinutes: string
  downtimeMinutes: string
  downtimeReason: string
  scheduledMinutes: string
  labourCost: string
  energyCost: string
  otherCost: string
  notes: string
}

async function fetchMaster(path: string) {
  const { data } = await api.get(path)
  return data.data as MasterItem[]
}

export function ProductionPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [warning, setWarning] = useState<{ rejectPercent: number } | null>(null)
  const [success, setSuccess] = useState<{
    batchNumber: string
    oeePercent: number
    costPerUnit: number | null
  } | null>(null)

  const machines = useQuery({ queryKey: ['machines'], queryFn: () => fetchMaster('/masters/machines') })
  const products = useQuery({ queryKey: ['products'], queryFn: () => fetchMaster('/masters/products') })
  const shifts = useQuery({ queryKey: ['shifts'], queryFn: () => fetchMaster('/masters/shifts') })
  const staff = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data } = await api.get('/masters/employees')
      return data.data as Array<{
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
      return data.data as InputBatch[]
    },
  })

  const { register, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    defaultValues: {
      machineId: '',
      productId: '',
      inputBatchNumber: '',
      shiftId: '',
      operatorName: '',
      materialConsumed: '',
      qtyProduced: '',
      qtyGood: '',
      qtyReject: '0',
      runtimeMinutes: '',
      downtimeMinutes: '0',
      downtimeReason: '',
      scheduledMinutes: '',
      labourCost: '0',
      energyCost: '0',
      otherCost: '0',
      notes: '',
    },
  })

  useEffect(() => {
    if (shifts.data?.length && !watch('shiftId')) {
      setValue('shiftId', String(shifts.data[0].id))
    }
  }, [shifts.data, setValue, watch])

  const selectedBatch = inputs.data?.find((b) => b.batchNumber === watch('inputBatchNumber'))
  const selectedMachine = machines.data?.find((m) => String(m.id) === watch('machineId'))

  const produced = Number(watch('qtyProduced') || 0)
  const good = Number(watch('qtyGood') || 0)
  const reject = Number(watch('qtyReject') || 0)
  const consumed = Number(watch('materialConsumed') || 0)
  const runtime = Number(watch('runtimeMinutes') || 0)
  const downtime = Number(watch('downtimeMinutes') || 0)
  const scheduled = Number(watch('scheduledMinutes') || 0) || runtime + downtime

  const metrics = useMemo(() => {
    const quality = produced > 0 ? +((good / produced) * 100).toFixed(2) : 0
    const rejectPct = produced > 0 ? +((reject / produced) * 100).toFixed(2) : 0
    const hours = runtime / 60
    const perHour = hours > 0 ? +(produced / hours).toFixed(2) : 0
    const matPerUnit = produced > 0 ? +(consumed / produced).toFixed(4) : 0
    const availability = scheduled > 0 ? +((runtime / scheduled) * 100).toFixed(2) : 0
    const rated = Number(selectedMachine?.ratedOutputPerHour || 0)
    const performance = rated > 0 && hours > 0 ? +((produced / (rated * hours)) * 100).toFixed(2) : 0
    const oee =
      availability && performance && quality
        ? +(((availability / 100) * (performance / 100) * (quality / 100)) * 100).toFixed(2)
        : 0
    return { quality, rejectPct, perHour, matPerUnit, availability, performance, oee }
  }, [produced, good, reject, consumed, runtime, scheduled, selectedMachine])

  const submitPayload = async (values: FormValues, confirmUnusualRun = false) => {
    setServerError('')
    setWarning(null)
    try {
      const { data } = await api.post('/production/runs', {
        machineId: Number(values.machineId),
        productId: Number(values.productId),
        inputBatchNumber: values.inputBatchNumber,
        shiftId: values.shiftId ? Number(values.shiftId) : null,
        operatorName: values.operatorName || null,
        materialConsumed: Number(values.materialConsumed),
        qtyProduced: Number(values.qtyProduced),
        qtyGood: Number(values.qtyGood),
        qtyReject: Number(values.qtyReject || 0),
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
      setSuccess({
        batchNumber: data.batchNumber,
        oeePercent: data.calculated?.oeePercent ?? 0,
        costPerUnit: data.calculated?.costPerUnit ?? null,
      })
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
        setWarning({ rejectPercent: res.data.rejectPercent ?? metrics.rejectPct })
        return
      }
      if (res?.data?.errors) {
        setServerError(Object.values(res.data.errors).join(' · '))
        return
      }
      setServerError(res?.data?.err || res?.data?.message || 'Failed to save production run')
    }
  }

  if (success) {
    return (
      <Card className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
          Production batch created
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{success.batchNumber}</p>
        <div className="mx-auto mt-5 grid max-w-md gap-3 sm:grid-cols-2">
          <StatPill label="OEE" value={`${success.oeePercent}%`} tone="accent" />
          <StatPill
            label="Cost / unit"
            value={success.costPerUnit != null ? `₦${success.costPerUnit}` : '—'}
            tone="success"
          />
        </div>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            className="dgn-btn dgn-btn-primary"
            onClick={() => navigate(`/batches/${success.batchNumber}`)}
          >
            Open Batch 360°
          </button>
          <button
            type="button"
            className="dgn-btn dgn-btn-secondary"
            onClick={() => window.location.reload()}
          >
            New production run
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Manufacturing"
        title="Production sheet"
        description="Consume a dried factory lot, record good and waste pieces, and issue a production batch for the product that came off the machine."
      />

      <form className="space-y-4" onSubmit={handleSubmit((values) => submitPayload(values, false))}>
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Machine & product</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Machine">
              <select className="dgn-input" {...register('machineId', { required: true })}>
                <option value="">Select machine</option>
                {machines.data?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.code ? ` (${m.code})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Product">
              <select className="dgn-input" {...register('productId', { required: true })}>
                <option value="">Select product</option>
                {products.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Shift">
              <select className="dgn-input" {...register('shiftId')}>
                <option value="">Select shift</option>
                {shifts.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Operator">
              <select className="dgn-input" {...register('operatorName')}>
                <option value="">Select staff</option>
                {(staff.data || []).map((e) => {
                  const name = `${e.firstname || ''} ${e.lastname || ''}`.trim() || e.employeeCode || `Staff ${e.id}`
                  return (
                    <option key={e.id} value={name}>
                      {name}
                      {e.employeeCode ? ` (${e.employeeCode})` : ''}
                    </option>
                  )
                })}
              </select>
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Material batch (DRY)</h2>
          <div className="mt-4 grid gap-4">
            <Field label="Select dried material batch">
              <select className="dgn-input" {...register('inputBatchNumber', { required: true })}>
                <option value="">Choose material batch</option>
                {inputs.data?.map((b) => (
                  <option key={b.id} value={b.batchNumber}>
                    {b.batchNumber} · {b.material?.name || b.batchType} · {b.qtyRemaining} {b.uom}
                  </option>
                ))}
              </select>
            </Field>
            {selectedBatch && (
              <div className="grid gap-3 sm:grid-cols-3">
                <StatPill label="Available" value={`${selectedBatch.qtyRemaining} ${selectedBatch.uom}`} />
                <StatPill label="Type" value={selectedBatch.batchType} tone="accent" />
                <StatPill label="Material" value={selectedBatch.material?.name || '—'} />
              </div>
            )}
            {!inputs.isLoading && !inputs.data?.length && (
              <p className="text-sm text-[var(--ink-muted)]">
                No dried material available. Complete a drying run first.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Output & runtime</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Material consumed (kg)">
              <input inputMode="decimal" className="dgn-input" {...register('materialConsumed', { required: true })} />
            </Field>
            <Field label="Produced (pcs)">
              <input inputMode="decimal" className="dgn-input" {...register('qtyProduced', { required: true })} />
            </Field>
            <Field label="Good (pcs)">
              <input inputMode="decimal" className="dgn-input" {...register('qtyGood', { required: true })} />
            </Field>
            <Field label="Waste (pcs)">
              <input inputMode="decimal" className="dgn-input" {...register('qtyReject')} />
            </Field>
            <Field label="Runtime (min)">
              <input inputMode="numeric" className="dgn-input" {...register('runtimeMinutes')} />
            </Field>
            <Field label="Downtime (min)">
              <input inputMode="numeric" className="dgn-input" {...register('downtimeMinutes')} />
            </Field>
            <Field label="Scheduled (min)" hint="Defaults to runtime + downtime">
              <input inputMode="numeric" className="dgn-input" {...register('scheduledMinutes')} />
            </Field>
            <Field label="Downtime reason">
              <input className="dgn-input" {...register('downtimeReason')} />
            </Field>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatPill label="Quality" value={`${metrics.quality}%`} tone="success" />
            <StatPill label="Waste" value={`${metrics.rejectPct}%`} tone="danger" />
            <StatPill label="Output / hr" value={String(metrics.perHour)} />
            <StatPill label="Material / unit" value={`${metrics.matPerUnit} kg`} />
            <StatPill label="Availability" value={`${metrics.availability}%`} />
            <StatPill label="Performance" value={`${metrics.performance}%`} />
            <StatPill label="OEE (live)" value={`${metrics.oee}%`} tone="accent" />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Run costs</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Labour / kg (₦)">
              <input inputMode="decimal" className="dgn-input" {...register('labourCost')} />
            </Field>
            <Field label="Energy ₦">
              <input inputMode="decimal" className="dgn-input" {...register('energyCost')} />
            </Field>
            <Field label="Other ₦">
              <input inputMode="decimal" className="dgn-input" {...register('otherCost')} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Notes">
              <textarea className="dgn-input" rows={3} {...register('notes')} />
            </Field>
          </div>
        </Card>

        {serverError && <Card className="border-red-200 bg-red-50 text-red-700">{serverError}</Card>}

        {warning && (
          <Card className="border-amber-200 bg-amber-50 text-amber-950">
            <p className="text-sm">
              Waste rate {warning.rejectPercent}% looks unusual. Confirm to save anyway?
            </p>
            <button
              type="button"
              className="dgn-btn dgn-btn-primary mt-3"
              onClick={handleSubmit((values) => submitPayload(values, true))}
            >
              Confirm unusual run
            </button>
          </Card>
        )}

        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="dgn-btn dgn-btn-primary w-full sm:w-auto"
        >
          {formState.isSubmitting ? 'Saving…' : 'Save production run & create batch'}
        </button>
      </form>
    </div>
  )
}
