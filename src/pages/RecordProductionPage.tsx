import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Palette } from 'lucide-react'
import { api } from '@/lib/api'
import { Field, StatPill } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Label } from '@/components/ui/label'
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
  colorType: '' | 'master' | 'normal'
  masterbatchColor?: string
  masterbatchKg: string
  masterbatchPrice?: string
  normalColorName?: string
  pigmentKg: string
  pigmentPrice?: string
  colorName: string
  colorQty: string
  colorCost: string
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
      colorType: '',
      masterbatchColor: '',
      masterbatchKg: '',
      masterbatchPrice: '',
      normalColorName: '',
      pigmentKg: '',
      pigmentPrice: '',
      colorName: '',
      colorQty: '',
      colorCost: '',
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

  // Additives & Production Material calculations
  const watchMbKg = form.watch('masterbatchKg') || ''
  const watchMbPrice = form.watch('masterbatchPrice') || ''
  const watchPigmentKg = form.watch('pigmentKg') || ''
  const watchPigmentPrice = form.watch('pigmentPrice') || ''
  const watchMaterialConsumed = form.watch('materialConsumed') || ''

  const mbSubtotal = useMemo(() => {
    return Number(watchMbKg || 0) * Number(watchMbPrice || 0)
  }, [watchMbKg, watchMbPrice])

  const pigSubtotal = useMemo(() => {
    return Number(watchPigmentKg || 0) * Number(watchPigmentPrice || 0)
  }, [watchPigmentKg, watchPigmentPrice])

  const totalAdditiveCost = useMemo(() => {
    return Math.round(mbSubtotal + pigSubtotal)
  }, [mbSubtotal, pigSubtotal])

  const totalAdditiveKg = useMemo(() => {
    return +(Number(watchMbKg || 0) + Number(watchPigmentKg || 0)).toFixed(2)
  }, [watchMbKg, watchPigmentKg])

  const totalMaterialMix = useMemo(() => {
    return +(Number(watchMaterialConsumed || 0) + totalAdditiveKg).toFixed(2)
  }, [watchMaterialConsumed, totalAdditiveKg])

  useEffect(() => {
    if (totalAdditiveCost > 0) {
      form.setValue('colorCost', String(totalAdditiveCost))
    }
  }, [totalAdditiveCost, form])

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
    const materialPerUnit = totalProduced > 0 ? +(totalMaterialMix / totalProduced).toFixed(3) : 0
    return { yieldPct, rejectPct, perHour, oee, materialPerUnit }
  }, [totalProduced, watchGood, watchReject, runtimeMins, scheduledMins, selectedMachine, totalMaterialMix])

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
      const mbKg = Number(values.masterbatchKg || 0)
      const mbPrice = Number(values.masterbatchPrice || 0)
      const pigKg = Number(values.pigmentKg || 0)
      const pigPrice = Number(values.pigmentPrice || 0)
      const computedAdditiveCost = Math.round(mbKg * mbPrice + pigKg * pigPrice)
      const finalAdditiveCost = computedAdditiveCost > 0 ? computedAdditiveCost : Number(values.colorCost || 0)

      const colorParts = []
      if (pigKg > 0) colorParts.push(`Normal Pigment (${pigKg}kg${pigPrice > 0 ? ` @ ₦${pigPrice.toLocaleString()}/kg` : ''})`)
      if (mbKg > 0) colorParts.push(`Masterbatch (${mbKg}kg${mbPrice > 0 ? ` @ ₦${mbPrice.toLocaleString()}/kg` : ''})`)
      const finalColorName = colorParts.join(' + ') || undefined

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
        colorType: mbKg > 0 && pigKg > 0 ? 'both' : mbKg > 0 ? 'master' : pigKg > 0 ? 'normal' : undefined,
        colorName: finalColorName,
        masterbatchColor: mbKg > 0 ? `Masterbatch (${mbKg}kg)` : undefined,
        normalColorName: pigKg > 0 ? `Normal Pigment (${pigKg}kg)` : undefined,
        masterbatchKg: mbKg,
        pigmentKg: pigKg,
        colorQty: +(mbKg + pigKg).toFixed(2),
        colorCost: finalAdditiveCost,
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
    <PageLayout
      title="Record Production Run"
      description="One-step completion of machine run, material consumption, finished pieces and waste breakdown."
      back={true}
      backTo="/production"
      backLabel="Back to Runs"
      className="max-w-7xl mx-auto"
    >

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
                <SearchableSelect
                  size="sm"
                  value={form.watch('machineId') || ''}
                  onChange={(val) =>
                    form.setValue('machineId', val, { shouldValidate: true, shouldDirty: true })
                  }
                  options={machineOptions}
                  placeholder="Select machine…"
                  searchPlaceholder="Search machine name or code…"
                />
              </Field>

              <Field label="Product">
                <SearchableSelect
                  size="sm"
                  value={form.watch('productId') || ''}
                  onChange={(val) =>
                    form.setValue('productId', val, { shouldValidate: true, shouldDirty: true })
                  }
                  options={productOptions}
                  placeholder="Select product…"
                  searchPlaceholder="Search product name or code…"
                />
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
                <SearchableSelect
                  size="sm"
                  value={form.watch('operatorName') || ''}
                  onChange={(val) =>
                    form.setValue('operatorName', val, { shouldValidate: true, shouldDirty: true })
                  }
                  options={operatorOptions}
                  placeholder="Select staff…"
                  searchPlaceholder="Search staff by name or code…"
                />
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
                <SearchableSelect
                  size="sm"
                  value={form.watch('inputBatchNumber') || ''}
                  onChange={(val) =>
                    form.setValue('inputBatchNumber', val, { shouldValidate: true, shouldDirty: true })
                  }
                  options={inputBatchOptions}
                  placeholder="Select raw material batch…"
                  searchPlaceholder="Search batch number or material…"
                />
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

              {totalAdditiveKg > 0 && (
                <div className="sm:col-span-2 flex items-center justify-between rounded-lg bg-zinc-100/90 px-3 py-1.5 text-xs text-zinc-700">
                  <span>
                    Total Production Material Mix: <strong>{totalMaterialMix} kg</strong>
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    (Base: {Number(watchMaterialConsumed || 0).toFixed(1)} kg + Additives: {totalAdditiveKg} kg)
                  </span>
                </div>
              )}
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

            {/* Color Formulation Inputs (Masterbatch & Normal Pigment) */}
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Palette className="size-3.5 text-violet-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                    Color Formulation & Additives (Masterbatch & Normal Pigment)
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500">
                  Enter quantity and unit price to compute additive cost and mix
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Masterbatch Column */}
                <div className="rounded-lg border border-zinc-200/80 bg-white p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800">Masterbatch</span>
                    {mbSubtotal > 0 && (
                      <span className="text-[10px] font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">
                        ₦{mbSubtotal.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2 grid-cols-2">
                    <div>
                      <Label className="text-[10px] text-zinc-500 mb-1 block">Quantity (kg)</Label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.0"
                        className="dgn-input text-xs font-semibold h-8"
                        {...form.register('masterbatchKg')}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-zinc-500 mb-1 block">Price / kg (₦)</Label>
                      <input
                        type="number"
                        step="any"
                        placeholder="₦/kg"
                        className="dgn-input text-xs font-semibold h-8"
                        {...form.register('masterbatchPrice')}
                      />
                    </div>
                  </div>
                </div>

                {/* Normal Pigment Column */}
                <div className="rounded-lg border border-zinc-200/80 bg-white p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800">Normal Pigment</span>
                    {pigSubtotal > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        ₦{pigSubtotal.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2 grid-cols-2">
                    <div>
                      <Label className="text-[10px] text-zinc-500 mb-1 block">Quantity (kg)</Label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.0"
                        className="dgn-input text-xs font-semibold h-8"
                        {...form.register('pigmentKg')}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-zinc-500 mb-1 block">Price / kg (₦)</Label>
                      <input
                        type="number"
                        step="any"
                        placeholder="₦/kg"
                        className="dgn-input text-xs font-semibold h-8"
                        {...form.register('pigmentPrice')}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Additive Cost & Mix Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200/80 text-xs">
                <div className="text-zinc-600 text-[11px] flex flex-wrap items-center gap-2">
                  <span>
                    Total Material Mix:{' '}
                    <strong className="text-zinc-900 font-bold">{totalMaterialMix} kg</strong>
                  </span>
                  {totalAdditiveKg > 0 && (
                    <span className="text-[10px] text-zinc-500">
                      (Base: {Number(watchMaterialConsumed || 0).toFixed(1)}kg + Additives: {totalAdditiveKg}kg)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-700 text-xs">Additive Cost (₦):</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    className="dgn-input text-xs font-bold w-28 h-8 text-right text-emerald-700"
                    {...form.register('colorCost')}
                  />
                </div>
              </div>
            </div>

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
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-zinc-100">
            <StatPill label="Yield %" value={`${liveMetrics.yieldPct}%`} tone="success" />
            <StatPill
              label="Reject %"
              value={`${liveMetrics.rejectPct}%`}
              tone={liveMetrics.rejectPct > 5 ? 'danger' : 'default'}
            />
            <StatPill label="Output / hr" value={String(liveMetrics.perHour)} />
            <StatPill label="Total Mix (kg)" value={`${totalMaterialMix} kg`} />
            <StatPill label="Mix / Unit" value={`${liveMetrics.materialPerUnit} kg`} />
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
    </PageLayout>
  )
}
