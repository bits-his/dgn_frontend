import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Warehouse, RotateCcw, ArrowRight, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, StatPill, ErrorBanner } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'

import { SORT_COLORS } from '@/lib/sortColors'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'
import { ColorCombobox } from '@/components/ui/color-combobox'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Button } from '@/components/ui/button'

export const STAGE_META: Record<
  string,
  {
    title: string
    eyebrow: string
    queueTitle: string
    emptyHint: string
    showWashFields?: boolean
    showDryFields?: boolean
    showMachine?: boolean
    showTeam?: boolean
    showOperator?: boolean
    operatorLabel?: string
    machineLabel?: string
    showDowntime?: boolean
    showLabourCost?: boolean
    showEnergyCost?: boolean
  }
> = {
  sorting: {
    title: 'Sorting',
    eyebrow: 'Recycling stage',
    queueTitle: 'Scrap tickets waiting to sort',
    emptyHint: 'No scrap tickets waiting. Buy raw scrap first.',
    showTeam: true,
    showOperator: false,
    operatorLabel: 'Sorting Lead',
    showDowntime: false,
    showLabourCost: true,
    showEnergyCost: true,
  },
  crushing: {
    title: 'Crushing',
    eyebrow: 'Recycling stage',
    queueTitle: 'Sorted lots waiting to crush',
    emptyHint: 'No sorted lots waiting. Finish sorting first.',
    showMachine: true,
    showTeam: false,
    showOperator: true,
    operatorLabel: 'Crusher Operator',
    machineLabel: 'Crushing Machine',
    showDowntime: true,
    showLabourCost: true,
    showEnergyCost: true,
  },
  washing: {
    title: 'Washing',
    eyebrow: 'Recycling stage',
    queueTitle: 'Crushed lots waiting to wash',
    emptyHint: 'No crushed lots waiting. Crush a sorted lot, or buy already crushed.',
    showWashFields: true,
    showMachine: true,
    showTeam: false,
    showOperator: true,
    operatorLabel: 'Washer Operator',
    machineLabel: 'Washing Machine',
    showDowntime: true,
    showLabourCost: true,
    showEnergyCost: true,
  },
  drying: {
    title: 'Drying',
    eyebrow: 'Recycling stage',
    queueTitle: 'Washed lots waiting to dry',
    emptyHint: 'No washed lots waiting. Finish washing first.',
    showDryFields: true,
    showMachine: false,
    showTeam: false,
    showOperator: true,
    operatorLabel: 'Drying Attendant',
    showDowntime: false,
    showLabourCost: false,
    showEnergyCost: false,
  },
  recrushing: {
    title: 'Re-crushing',
    eyebrow: 'Recycling stage',
    queueTitle: 'Dried lots waiting to re-crush',
    emptyHint: 'No dried lots waiting. Finish drying first.',
    showMachine: true,
    showTeam: false,
    showOperator: true,
    operatorLabel: 'Re-crushing Operator',
    machineLabel: 'Re-crushing Machine',
    showDowntime: false,
    showLabourCost: true,
    showEnergyCost: false,
  },
}

export type FormValues = {
  inputBatchNumber: string
  qtyInput: string
  qtyUsable: string
  qtyReject: string
  qtyWaste: string
  machineName: string
  operatorName: string
  teamName: string
  labourCost: string
  energyCost: string
  waterQty: string
  chemicalCost: string
  detergentCost: string
  moistureReading: string
  downtimeMinutes: string
  downtimeReason: string
  notes: string
}

export type InputBatch = {
  id: number
  batchNumber: string
  batchType: string
  qtyRemaining: number | string
  qtyIn?: number | string
  uom: string
  sortColor?: string | null
  businessDate?: string | null
  createdAt?: string
  material?: { name: string }
  location?: { name: string }
  effectiveCostPerKg?: number | null
  pricePerKg?: number | null
}

export type ColorLine = { color: string; qtyKg: number }
export type ColorLot = { batchNumber: string; color: string; qtyKg: number }

export function colorName(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

export function formatBusinessDate(raw?: string | null) {
  if (!raw || raw.length !== 6) return null
  const yy = Number(raw.slice(0, 2))
  const mm = Number(raw.slice(2, 4))
  const dd = Number(raw.slice(4, 6))
  if (!yy || !mm || !dd) return null
  return new Date(2000 + yy, mm - 1, dd).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatCreatedAt(raw?: string) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function qtyLabel(value: string | number | undefined, uom: string) {
  if (value == null || value === '') return '—'
  return `${Number(value).toLocaleString()} ${uom || 'kg'}`
}

const emptyForm = (batchNumber = ''): FormValues => ({
  inputBatchNumber: batchNumber,
  qtyInput: '',
  qtyUsable: '',
  qtyReject: '0',
  qtyWaste: '0',
  machineName: '',
  operatorName: '',
  teamName: '',
  labourCost: '0',
  energyCost: '0',
  waterQty: '0',
  chemicalCost: '0',
  detergentCost: '0',
  moistureReading: '',
  downtimeMinutes: '0',
  downtimeReason: '',
  notes: '',
})

export function ProcessStageForm({
  stage = 'sorting',
  presetBatchNumber = '',
}: {
  stage?: string
  presetBatchNumber?: string
  compact?: boolean
}) {
  const isSorting = stage === 'sorting'
  const isWashing = stage === 'washing'
  const isCrushing = stage === 'crushing'
  const isDrying = stage === 'drying'
  const isRecrushing = stage === 'recrushing'
  /** Crushing / drying / recrushing: weigh after the stage; washing/sorting use waste where applicable. */
  const showsMeasuredOut = isCrushing || isDrying || isRecrushing
  const showsWaste = isSorting || isWashing
  const meta = STAGE_META[stage] || STAGE_META.sorting
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeBatch, setActiveBatch] = useState<string | null>(
    () => presetBatchNumber || searchParams.get('batch') || null,
  )
  const [serverErrors, setServerErrors] = useState<ErrorItem[]>([])
  const [warning, setWarning] = useState<{ yieldPercent: number } | null>(null)
  const [successBatch, setSuccessBatch] = useState<string | null>(null)
  const [dryingDestination, setDryingDestination] = useState<'recrushing' | 'production' | null>(null)
  const [submitAction, setSubmitAction] = useState<string | null>(null)
  const [colorLots, setColorLots] = useState<ColorLot[]>([])
  const [scrapTicket, setScrapTicket] = useState<string | null>(null)
  const [colorLines, setColorLines] = useState<ColorLine[]>([])
  const [pickColor, setPickColor] = useState('')
  const [pickKg, setPickKg] = useState('')
  const [editingColor, setEditingColor] = useState<string | null>(null)
  const [editingKg, setEditingKg] = useState('')

  const staff = useQuery({
    queryKey: ['masters-employees'],
    queryFn: async () => {
      const { data } = await api.get('/masters/employees')
      return data.data as Array<{
        id: number
        firstname?: string
        lastname?: string
        employeeCode?: string
      }>
    },
    enabled: STAGE_META[stage]?.showOperator !== false,
  })

  const machines = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const { data } = await api.get('/masters/machines')
      return data.data as Array<{ id: number; name: string; code?: string }>
    },
    enabled: Boolean(STAGE_META[stage]?.showMachine),
  })

  const inputs = useQuery({
    queryKey: ['process-inputs', stage],
    queryFn: async () => {
      const { data } = await api.get(`/process/${stage}/inputs`)
      return data.data as InputBatch[]
    },
  })

  // Fetch batch cost data when a batch is selected (for price/kg stat)
  const batchDetail = useQuery({
    queryKey: ['batch-detail-cost', activeBatch],
    queryFn: async () => {
      if (!activeBatch) return null
      const { data } = await api.get(`/batches/${activeBatch}`)
      const receipt = data?.data?.scrapReceipt
      return {
        pricePerKg: receipt?.pricePerKg ?? null,
        effectiveCostPerKg: receipt
          ? Number(
              (
                ((receipt.purchaseCost ?? 0) +
                  (receipt.transportCost ?? 0) +
                  (receipt.loadingCost ?? 0) +
                  (receipt.otherCost ?? 0)) /
                (receipt.netWeight || 1)
              ).toFixed(2),
            )
          : null,
      }
    },
    enabled: Boolean(activeBatch && (isCrushing || isSorting || isWashing)),
    staleTime: 60_000,
  })

  const staffOptions = useMemo(() => {
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

  const machineOptions = useMemo(() => {
    return (machines.data || []).map((m) => ({
      value: m.name,
      label: m.name,
      sublabel: m.code ? `Code: ${m.code}` : undefined,
    }))
  }, [machines.data])

  const batchOptions = useMemo(() => {
    return (inputs.data || []).map((b) => ({
      value: b.batchNumber,
      label: `${b.batchNumber} - ${colorName(b.sortColor)} (${qtyLabel(b.qtyRemaining, b.uom)})`,
      sublabel: `${b.material?.name || b.batchType} · Loc: ${b.location?.name || 'Processing Area'}`,
    }))
  }, [inputs.data])

  const { register, handleSubmit, watch, setValue, formState, reset } = useForm<FormValues>({
    defaultValues: emptyForm(activeBatch || ''),
  })

  // Reset when stage changes; keep ?batch= if present for this stage.
  useEffect(() => {
    const fromUrl = searchParams.get('batch') || presetBatchNumber || null
    setActiveBatch(fromUrl)
    setSuccessBatch(null)
    setDryingDestination(null)
    setColorLots([])
    setScrapTicket(null)
    setServerErrors([])
    setWarning(null)
    setColorLines([])
    setPickColor('')
    setPickKg('')
    setEditingColor(null)
    setEditingKg('')
    reset(emptyForm(fromUrl || ''))
  }, [stage, presetBatchNumber, reset]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = inputs.data?.find((b) => b.batchNumber === activeBatch)

  const openBatch = (batchNumber: string) => {
    setActiveBatch(batchNumber)
    setSuccessBatch(null)
    setDryingDestination(null)
    setServerErrors([])
    setWarning(null)
    setColorLines([])
    setPickColor('')
    setPickKg('')
    reset(emptyForm(batchNumber))
    setSearchParams({ batch: batchNumber }, { replace: true })
  }

  const backToQueue = () => {
    navigate(`/process/${stage}`)
  }

  useEffect(() => {
    if (selected && activeBatch) {
      setValue('inputBatchNumber', selected.batchNumber)
      setValue('qtyInput', String(selected.qtyRemaining))
      if (showsMeasuredOut) {
        setValue('qtyUsable', String(selected.qtyRemaining))
      }
    }
  }, [selected, activeBatch, setValue, showsMeasuredOut])

  const isSplittingCrush = isCrushing && (selected?.batchType === 'SCRAP' || colorLines.length > 0 || !selected?.sortColor)
  const isColorAllocation = isSorting || isSplittingCrush

  const qtyInput = Number(watch('qtyInput') || 0)
  const qtyWaste = Number(watch('qtyWaste') || 0)
  const colorUsable = useMemo(
    () => +colorLines.reduce((sum, line) => sum + line.qtyKg, 0).toFixed(3),
    [colorLines],
  )
  const qtyUsable = isColorAllocation ? colorUsable : Number(watch('qtyUsable') || 0)

  const qtyReject = isColorAllocation
    ? Math.max(0, +(qtyInput - colorUsable).toFixed(3))
    : showsWaste
    ? Math.max(0, +(qtyInput - qtyUsable - qtyWaste).toFixed(3))
    : 0
  const measuredShrink = showsMeasuredOut
    ? Math.max(0, +(qtyInput - qtyUsable).toFixed(3))
    : 0
  const measuredOverIn = showsMeasuredOut && !isColorAllocation && qtyUsable - qtyInput > 0.001

  useEffect(() => {
    setValue('qtyReject', String(qtyReject))
  }, [qtyReject, setValue])

  const colorRoomLeft = useMemo(
    () => Math.max(0, +(qtyInput - colorUsable).toFixed(3)),
    [qtyInput, colorUsable],
  )
  const colorsOverLot = colorUsable - qtyInput > 0.001
  const yieldPercent = useMemo(
    () => (qtyInput > 0 ? +((qtyUsable / qtyInput) * 100).toFixed(2) : 0),
    [qtyInput, qtyUsable],
  )

  const addColorLine = () => {
    const kg = Number(pickKg)
    if (!pickColor || !(kg > 0)) return
    if (colorLines.some((l) => l.color === pickColor)) {
      setColorLines((prev) =>
        prev.map((l) => (l.color === pickColor ? { ...l, qtyKg: +(l.qtyKg + kg).toFixed(3) } : l)),
      )
    } else {
      setColorLines((prev) => [...prev, { color: pickColor, qtyKg: +kg.toFixed(3) }])
    }
    setPickColor('')
    setPickKg('')
  }

  const saveEditColorLine = (color: string) => {
    const kg = Number(editingKg)
    if (!(kg > 0)) return
    setColorLines((prev) =>
      prev.map((l) => (l.color === color ? { ...l, qtyKg: +kg.toFixed(3) } : l)),
    )
    setEditingColor(null)
    setEditingKg('')
  }

  const removeColorLine = (color: string) => {
    setColorLines((prev) => prev.filter((line) => line.color !== color))
  }

  const submitPayload = async (
    values: FormValues,
    confirmUnusualYield = false,
    destination?: 'recrushing' | 'production',
  ) => {
    setServerErrors([])
    setWarning(null)
    setSubmitAction(destination || 'save')

    if (isColorAllocation) {
      if (!colorLines.length) {
        setServerErrors([
          {
            label: 'Colours',
            message: 'Add at least one colour with kg. Each colour becomes its own BAT- lot for washing.',
          },
        ])
        setSubmitAction(null)
        return
      }
      if (colorsOverLot) {
        setServerErrors([
          {
            label: 'Colours',
            message: `Colour total is ${colorUsable} kg but the input batch is only ${qtyInput} kg (over by ${(colorUsable - qtyInput).toFixed(3)} kg).`,
          },
        ])
        setSubmitAction(null)
        return
      }
      if (!values.inputBatchNumber) {
        setServerErrors([
          { label: 'Input batch', message: 'Select the batch you are processing.' },
        ])
        setSubmitAction(null)
        return
      }
    } else if (isCrushing) {
      const measured = Number(values.qtyUsable)
      const inbound = Number(values.qtyInput)
      if (!(measured > 0)) {
        setServerErrors([
          {
            label: 'Measured after crushing',
            message: 'Enter the measured kg after crushing.',
          },
        ])
        setSubmitAction(null)
        return
      }
      if (measured - inbound > 0.001) {
        setServerErrors([
          {
            label: 'Measured after crushing',
            message: `Measured (${measured} kg) cannot be more than qty in (${inbound} kg).`,
          },
        ])
        setSubmitAction(null)
        return
      }
    }

    if (isDrying || isRecrushing) {
      const measured = Number(values.qtyUsable)
      const inbound = Number(values.qtyInput)
      const stageName = isRecrushing ? 're-crushing' : 'drying'
      if (!(measured > 0)) {
        setServerErrors([
          {
            label: `Measured after ${stageName}`,
            message: `Enter the measured kg after ${stageName}.`,
          },
        ])
        setSubmitAction(null)
        return
      }
      if (measured - inbound > 0.001) {
        setServerErrors([
          {
            label: `Measured after ${stageName}`,
            message: `Measured (${measured} kg) cannot be more than qty in (${inbound} kg).`,
          },
        ])
        setSubmitAction(null)
        return
      }
    }

    try {
      const isSplitting = isColorAllocation && colorLines.length > 0
      const { data } = await api.post(`/process/${stage}`, {
        ...values,
        inputBatchNumber: activeBatch || values.inputBatchNumber,
        qtyInput: Number(values.qtyInput),
        qtyUsable: isSplitting ? colorUsable : Number(values.qtyUsable),
        qtyReject: showsWaste ? qtyReject : 0,
        qtyWaste: 0,
        colorLines: isSplitting ? colorLines : undefined,
        labourCost: meta.showLabourCost !== false ? Number(values.labourCost || 0) : 0,
        energyCost: meta.showEnergyCost !== false ? Number(values.energyCost || 0) : 0,
        waterQty: Number(values.waterQty || 0),
        chemicalCost: Number(values.chemicalCost || 0),
        detergentCost: Number(values.detergentCost || 0),
        moistureReading: values.moistureReading === '' ? null : Number(values.moistureReading),
        downtimeMinutes: meta.showDowntime ? Number(values.downtimeMinutes || 0) : 0,
        downtimeReason: meta.showDowntime ? values.downtimeReason || null : null,
        operatorName: meta.showOperator ? values.operatorName || null : null,
        machineName: meta.showMachine ? values.machineName || null : null,
        teamName: meta.showTeam ? values.teamName : undefined,
        confirmUnusualYield,
      })

      const resultingBatch = data.batchNumber || activeBatch || values.inputBatchNumber

      // If drying and user clicked "Move to Production", immediately handover to Production Store
      if (isDrying && destination === 'production') {
        try {
          await api.post('/production/store/transfer', { batchNumber: resultingBatch })
          await queryClient.invalidateQueries({ queryKey: ['production-store'] })
          await queryClient.invalidateQueries({ queryKey: ['production-store-pending'] })
          await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
        } catch (transferErr: any) {
          console.error('Failed to auto-transfer to production store:', transferErr)
          alert(
            `Drying saved as batch ${resultingBatch}, but transfer to Production Store had an issue: ` +
              (transferErr.response?.data?.err || transferErr.response?.data?.message || transferErr.message),
          )
        }
        setDryingDestination('production')
      } else if (isDrying && destination === 'recrushing') {
        setDryingDestination('recrushing')
      }

      if (Array.isArray(data.colorLots) && data.colorLots.length > 0) {
        setColorLots(data.colorLots)
        setScrapTicket(data.scrapTicket || values.inputBatchNumber)
      }
      setSuccessBatch(resultingBatch)
      queryClient.invalidateQueries({ queryKey: ['process-inputs', stage] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number
          data?: {
            warning?: boolean
            message?: string
            yieldPercent?: number
            errors?: Record<string, string>
            err?: string
          }
        }
      }
      const res = axiosErr.response
      if (res?.status === 422 && res.data?.warning) {
        setWarning({ yieldPercent: res.data.yieldPercent || yieldPercent })
        return
      }
      const items = formatApiErrors(
        res?.data?.errors,
        res?.data?.err || res?.data?.message || 'Failed to save process run',
      )
      setServerErrors(items)
    } finally {
      setSubmitAction(null)
    }
  }

  // ——— Success view ———
  if (successBatch) {
    const nextMap: Record<string, string | null> = {
      sorting: 'crushing',
      crushing: 'washing',
      washing: 'drying',
      drying: 'recrushing',
      recrushing: null,
    }
    const next = nextMap[stage]
    const hasLots = colorLots.length > 0

    if (isDrying) {
      return (
        <PageLayout
          title={meta.title}
          description={
            dryingDestination === 'production'
              ? 'Drying completed & transferred to Production Store'
              : 'Drying completed & ready for Re-crushing'
          }
        >
          <Card className="text-center !p-6 max-w-xl mx-auto space-y-4">
            <div className="mx-auto size-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              {dryingDestination === 'production' ? (
                <Warehouse className="size-6" />
              ) : (
                <RotateCcw className="size-6" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                Drying Complete
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{successBatch}</p>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                {dryingDestination === 'production'
                  ? 'Batch has been saved and transferred directly to the Production Store. It is now ready for production extrusion.'
                  : 'Batch has been saved in the drying area for secondary crushing. It is now available in the Re-crushing queue.'}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2.5">
              {dryingDestination === 'production' ? (
                <Button asChild className="dgn-btn-primary">
                  <Link
                    to="/production/store"
                    className="inline-flex items-center justify-center gap-1.5 leading-none"
                  >
                    <Warehouse className="size-4 shrink-0" />
                    <span>Open Production Store</span>
                  </Link>
                </Button>
              ) : (
                <Button asChild className="dgn-btn-primary">
                  <Link
                    to={`/process/recrushing/new?batch=${encodeURIComponent(successBatch)}`}
                    className="inline-flex items-center justify-center gap-1.5 leading-none"
                  >
                    <RotateCcw className="size-4 shrink-0" />
                    <span>Process Re-crushing Now</span>
                  </Link>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to={`/batches/${successBatch}`}>Batch 360°</Link>
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSuccessBatch(null)
                  setDryingDestination(null)
                  setActiveBatch(null)
                  setSearchParams({}, { replace: true })
                  reset(emptyForm())
                }}
              >
                Record Another Batch
              </Button>
              <Button variant="ghost" asChild>
                <Link to={`/process/${stage}`}>Back to Drying Queue</Link>
              </Button>
            </div>
          </Card>
        </PageLayout>
      )
    }

    return (
      <PageLayout
        title={meta.title}
        description={hasLots ? 'Colour lots created' : `${meta.title} saved`}
      >
        <Card className="text-center !p-6 max-w-xl mx-auto space-y-4">
          <div className="mx-auto size-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
              {hasLots ? 'Colour lots created' : `${meta.title} saved`}
            </p>
            {hasLots ? (
              <>
                <p className="mt-2 text-sm text-[var(--ink-muted)]">
                  {isSorting
                    ? `Sorted from scrap ${scrapTicket}. Each colour now has its own BAT- number for the rest of the line.`
                    : `Crushed from scrap ${scrapTicket || activeBatch}. Each colour now has its own BAT- number ready for washing.`}
                </p>
                <ul className="mx-auto mt-4 max-w-md divide-y divide-[var(--line)] rounded-xl text-left ring-1 ring-[var(--line)]">
                  {colorLots.map((lot) => (
                    <li
                      key={lot.batchNumber}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold tracking-tight">{lot.batchNumber}</p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {colorName(lot.color)} · {lot.qtyKg.toLocaleString()} kg
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--accent-strong)]"
                        onClick={() => navigate(`/batches/${lot.batchNumber}`)}
                      >
                        Open
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-1 text-2xl font-bold tracking-tight">{successBatch}</p>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2">
            {next && (
              <Button asChild className="dgn-btn-primary">
                <Link
                  to={`/process/${next}/new`}
                  className="inline-flex items-center justify-center gap-1.5 leading-none"
                >
                  <span>Next: {STAGE_META[next]?.title}</span>
                  <ArrowRight className="size-4 shrink-0 ml-0.5" />
                </Link>
              </Button>
            )}
            {!isSorting && (
              <Button variant="outline" asChild>
                <Link to={`/batches/${successBatch}`}>Batch 360°</Link>
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setSuccessBatch(null)
                setActiveBatch(null)
                setSearchParams({}, { replace: true })
                reset(emptyForm())
              }}
            >
              Record Another
            </Button>
            <Button variant="ghost" asChild>
              <Link to={`/process/${stage}`}>Back to {meta.title} Queue</Link>
            </Button>
          </div>
        </Card>
      </PageLayout>
    )
  }

  // ——— Form view ———
  return (
    <PageLayout
      title={selected ? `${meta.title}: ${selected.batchNumber}` : `Record ${meta.title}`}
      description={
        selected
          ? `${selected.material?.name || selected.batchType} · ${qtyLabel(selected.qtyRemaining, selected.uom)} available`
          : `Select an input batch waiting for ${meta.title.toLowerCase()} to fill the run details.`
      }
      back={true}
      backLabel={`Back to ${meta.title} queue`}
      onBack={backToQueue}
    >
      <div className="w-full space-y-4">
        {/* Batch Picker Card if no batch selected or to change batch */}
        {!selected ? (
          <Card className="!p-5">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] mb-1">
                  Select Input Batch
                </label>
                <p className="text-xs text-[var(--ink-muted)] mb-3">
                  Choose an available batch waiting in the {meta.title.toLowerCase()} queue to proceed.
                </p>
              </div>
              <SearchableSelect
                value={activeBatch || ''}
                onChange={(val) => {
                  if (val) openBatch(val)
                }}
                options={batchOptions}
                placeholder={`Select a batch waiting for ${meta.title.toLowerCase()}…`}
                searchPlaceholder="Search batch number, colour, material…"
              />
              {!inputs.isLoading && (inputs.data || []).length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  {meta.emptyHint}
                </p>
              )}
            </div>
          </Card>
        ) : (
          <Card className="!p-4 bg-zinc-50 border-zinc-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-faint)]">
                  Selected Batch
                </span>
                <h3 className="text-lg font-bold text-zinc-900">{selected.batchNumber}</h3>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  {selected.material?.name || selected.batchType} · Colour:{' '}
                  <strong>{colorName(selected.sortColor)}</strong> · Available:{' '}
                  <strong className="text-emerald-700">
                    {qtyLabel(selected.qtyRemaining, selected.uom)}
                  </strong>{' '}
                  · Location: {selected.location?.name || 'Processing Area'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs shrink-0 self-start sm:self-center"
                onClick={() => {
                  setActiveBatch(null)
                  setSearchParams({}, { replace: true })
                  reset(emptyForm())
                }}
              >
                Change Batch
              </Button>
            </div>
          </Card>
        )}

        {selected && (
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => submitPayload(values, false))}
          >
            <input type="hidden" {...register('inputBatchNumber', { required: true })} />

            {isColorAllocation ? (
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold tracking-tight">
                    {isSorting ? 'Sort into colours' : 'Allocate colours'}
                  </h2>
                </div>

                {/* Stats strip */}
                {isCrushing && qtyInput > 0 && (
                  <div
                    className="mt-3 grid divide-x divide-zinc-100 rounded-xl border border-zinc-100 bg-zinc-50"
                    style={{
                      gridTemplateColumns: batchDetail.data?.pricePerKg
                        ? 'repeat(4, 1fr)'
                        : 'repeat(3, 1fr)',
                    }}
                  >
                    <div className="py-2.5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Allocated</p>
                      <p className="mt-0.5 text-sm font-bold text-emerald-600">{colorUsable.toFixed(3)} kg</p>
                    </div>
                    <div className="py-2.5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Remaining</p>
                      <p
                        className={`mt-0.5 text-sm font-bold ${
                          colorRoomLeft > 0.001 ? 'text-amber-600' : 'text-zinc-400'
                        }`}
                      >
                        {colorRoomLeft.toFixed(3)} kg
                      </p>
                    </div>
                    <div className="py-2.5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Waste</p>
                      <p className="mt-0.5 text-sm font-bold text-zinc-600">
                        {qtyInput > 0 ? qtyReject.toFixed(3) : '—'} kg
                      </p>
                    </div>
                    {batchDetail.data?.pricePerKg && (
                      <div className="py-2.5 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">₦ / kg</p>
                        <p className="mt-0.5 text-sm font-bold text-zinc-700 font-mono">
                          ₦{batchDetail.data.pricePerKg.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Add colour row */}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 shrink-0">
                    <label className="mb-1 block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">
                      Colour
                    </label>
                    <ColorCombobox
                      value={pickColor}
                      onChange={(code) => {
                        setPickColor(code)
                        setTimeout(() => {
                          document.getElementById('pick-kg-input')?.focus()
                        }, 80)
                      }}
                      exclude={colorLines.map((l) => l.color)}
                      placeholder="Pick a colour…"
                      disabled={!(qtyInput > 0) || colorRoomLeft <= 0.001}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">
                      Kg
                      {colorRoomLeft > 0.001 && (
                        <span className="ml-1 font-normal normal-case text-zinc-400">
                          (max {colorRoomLeft.toFixed(3)})
                        </span>
                      )}
                    </label>
                    <input
                      id="pick-kg-input"
                      inputMode="decimal"
                      className="dgn-input w-full"
                      placeholder="0.000"
                      value={pickKg}
                      max={colorRoomLeft > 0 ? colorRoomLeft : undefined}
                      onChange={(e) => setPickKg(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColorLine())}
                    />
                  </div>
                  <div className="sm:shrink-0 flex-1">
                    <Button
                      type="button"
                      className="w-full h-12 mb-1"
                      disabled={!(qtyInput > 0) || colorRoomLeft <= 0.001 || !pickColor || !(Number(pickKg) > 0)}
                      onClick={addColorLine}
                    >
                      + Add
                    </Button>
                  </div>
                </div>

                {/* Added colours list */}
                {colorLines.length > 0 && (
                  <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-100 overflow-hidden">
                    {colorLines.map((line) => (
                      <li key={line.color} className="flex items-center gap-3 px-4 py-3">
                        <span className="flex-1 text-sm font-medium">{colorName(line.color)}</span>

                        {editingColor === line.color ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              inputMode="decimal"
                              className="dgn-input w-24 text-sm"
                              value={editingKg}
                              onChange={(e) => setEditingKg(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  saveEditColorLine(line.color)
                                }
                                if (e.key === 'Escape') {
                                  setEditingColor(null)
                                  setEditingKg('')
                                }
                              }}
                            />
                            <span className="text-xs text-zinc-400">kg</span>
                            <button
                              type="button"
                              className="dgn-btn dgn-btn-primary text-xs px-2.5 py-1"
                              onClick={() => saveEditColorLine(line.color)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="text-xs text-zinc-400 hover:text-zinc-600"
                              onClick={() => {
                                setEditingColor(null)
                                setEditingKg('')
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-mono font-semibold text-zinc-700">
                              {line.qtyKg.toLocaleString()} kg
                            </span>
                            <button
                              type="button"
                              className="text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                              onClick={() => {
                                setEditingColor(line.color)
                                setEditingKg(String(line.qtyKg))
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-500 hover:text-red-700"
                              onClick={() => removeColorLine(line.color)}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Waste display */}
                {qtyInput > 0 && colorLines.length > 0 && qtyReject > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Waste / Reject
                    </span>
                    <span className="font-mono text-sm font-bold text-amber-800">
                      {qtyReject.toFixed(3)} kg
                    </span>
                  </div>
                )}

                {colorsOverLot && (
                  <p className="mt-2 text-xs font-semibold text-red-600">
                    ⚠ Colours total ({colorUsable.toFixed(3)} kg) exceeds lot ({qtyInput} kg)
                  </p>
                )}
              </Card>
            ) : (
              <Card>
                <div
                  className={
                    showsWaste || showsMeasuredOut
                      ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
                      : 'grid gap-3 sm:grid-cols-2'
                  }
                >
                  <Field label="Qty in (kg)" hint="From the lot — cannot be edited">
                    <input
                      inputMode="decimal"
                      className="dgn-input bg-[var(--bg)] text-[var(--ink-muted)]"
                      readOnly
                      tabIndex={-1}
                      {...register('qtyInput', { required: true })}
                    />
                  </Field>
                  {showsWaste ? (
                    <>
                      <Field label="Usable out (kg)">
                        <input
                          inputMode="decimal"
                          className="dgn-input"
                          {...register('qtyUsable', { required: true })}
                        />
                      </Field>
                      <Field label="Waste (kg)" hint="Qty in − usable out">
                        <input
                          className="dgn-input bg-[var(--bg)] text-[var(--ink-muted)]"
                          value={qtyInput > 0 || qtyUsable > 0 ? String(qtyReject) : ''}
                          readOnly
                          tabIndex={-1}
                        />
                      </Field>
                    </>
                  ) : showsMeasuredOut ? (
                    <>
                      <Field
                        label={
                          isCrushing
                            ? 'Measured after crushing (kg)'
                            : isRecrushing
                            ? 'Measured after re-crushing (kg)'
                            : 'Measured after drying (kg)'
                        }
                        hint={
                          measuredOverIn
                            ? 'Cannot be more than qty in'
                            : 'Weigh the material and enter the scale reading'
                        }
                      >
                        <input
                          inputMode="decimal"
                          className={`dgn-input ${
                            measuredOverIn ? 'border-red-400 ring-1 ring-red-300' : ''
                          }`}
                          {...register('qtyUsable', { required: true })}
                        />
                      </Field>
                      <Field
                        label="Difference (kg)"
                        hint="Qty in − measured (weight change, not waste)"
                      >
                        <input
                          className="dgn-input bg-[var(--bg)] text-[var(--ink-muted)]"
                          value={qtyInput > 0 || qtyUsable > 0 ? String(measuredShrink) : ''}
                          readOnly
                          tabIndex={-1}
                        />
                      </Field>
                    </>
                  ) : (
                    <Field label="Qty out (kg)" hint="Same as qty in — no waste on this stage">
                      <input
                        className="dgn-input bg-[var(--bg)] text-[var(--ink-muted)]"
                        value={qtyInput > 0 ? String(qtyInput) : ''}
                        readOnly
                        tabIndex={-1}
                      />
                    </Field>
                  )}
                </div>
                {(showsWaste || showsMeasuredOut) && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <StatPill label="Yield" value={`${yieldPercent}%`} tone="success" />
                    <StatPill
                      label={showsMeasuredOut ? 'Measured / in' : 'Accounted'}
                      value={
                        showsMeasuredOut
                          ? `${qtyUsable || 0} / ${qtyInput || 0} kg`
                          : `${+(qtyUsable + qtyReject).toFixed(3)} / ${qtyInput || 0} kg`
                      }
                    />
                  </div>
                )}
              </Card>
            )}

            <Card>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {meta.showMachine && (
                  <Field label={meta.machineLabel || 'Machine'}>
                    <SearchableSelect
                      value={watch('machineName') || ''}
                      onChange={(val) =>
                        setValue('machineName', val, { shouldValidate: true, shouldDirty: true })
                      }
                      options={machineOptions}
                      placeholder={`Select ${meta.machineLabel?.toLowerCase() || 'machine'}…`}
                      searchPlaceholder="Search machine name or code…"
                    />
                  </Field>
                )}
                {meta.showOperator !== false && (
                  <Field label={meta.operatorLabel || 'Operator'}>
                    <SearchableSelect
                      value={watch('operatorName') || ''}
                      onChange={(val) =>
                        setValue('operatorName', val, { shouldValidate: true, shouldDirty: true })
                      }
                      options={staffOptions}
                      placeholder={`Select ${meta.operatorLabel?.toLowerCase() || 'operator'}…`}
                      searchPlaceholder="Search staff by name or code…"
                    />
                  </Field>
                )}
                {meta.showTeam && (
                  <Field label="Team">
                    <input className="dgn-input" {...register('teamName')} placeholder="Team name" />
                  </Field>
                )}
                {meta.showLabourCost !== false && (
                  <Field label="Labour cost / kg (₦)">
                    <input inputMode="decimal" className="dgn-input" {...register('labourCost')} />
                  </Field>
                )}
                {meta.showEnergyCost !== false && (
                  <Field label="Energy cost (₦)">
                    <input inputMode="decimal" className="dgn-input" {...register('energyCost')} />
                  </Field>
                )}
                {meta.showWashFields && (
                  <>
                    <Field label="Water cost (₦)">
                      <input inputMode="decimal" className="dgn-input" {...register('waterQty')} />
                    </Field>
                    <Field label="Detergent cost (₦)">
                      <input
                        inputMode="decimal"
                        className="dgn-input"
                        {...register('detergentCost')}
                      />
                    </Field>
                  </>
                )}
                {meta.showDryFields && (
                  <Field label="Moisture %">
                    <input
                      inputMode="decimal"
                      className="dgn-input"
                      {...register('moistureReading')}
                    />
                  </Field>
                )}
                {meta.showDowntime && (
                  <>
                    <Field label="Downtime (min)">
                      <input
                        inputMode="numeric"
                        className="dgn-input"
                        {...register('downtimeMinutes')}
                      />
                    </Field>
                    <Field label="Downtime reason">
                      <input className="dgn-input" {...register('downtimeReason')} />
                    </Field>
                  </>
                )}
                <Field label="Notes">
                  <input className="dgn-input" {...register('notes')} />
                </Field>
              </div>
            </Card>

            {serverErrors.length > 0 && <ErrorBanner items={serverErrors} />}

            {warning && (
              <Card className="border-amber-200 bg-amber-50 text-amber-950 !p-3">
                <p className="text-sm">Yield {warning.yieldPercent}% looks unusual. Confirm?</p>
                <button
                  type="button"
                  className="dgn-btn dgn-btn-primary mt-2"
                  onClick={handleSubmit((values) => submitPayload(values, true))}
                >
                  Confirm unusual yield
                </button>
              </Card>
            )}

            {/* Action buttons: for drying, provide the 2 distinct destinations requested */}
            {isDrying ? (
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={
                    formState.isSubmitting ||
                    !selected ||
                    !(qtyUsable > 0) ||
                    measuredOverIn
                  }
                  className="w-full sm:w-auto h-11 px-5 border-amber-600/40 text-amber-900 hover:bg-amber-50 hover:text-amber-950 font-semibold inline-flex items-center justify-center gap-2 leading-none"
                  onClick={handleSubmit((values) => submitPayload(values, false, 'recrushing'))}
                >
                  <RotateCcw className="size-4 shrink-0 text-amber-700" />
                  <span>
                    {formState.isSubmitting && submitAction === 'recrushing'
                      ? 'Moving to Re-crushing…'
                      : 'Move to Re-crushing'}
                  </span>
                </Button>

                <Button
                  type="button"
                  size="lg"
                  disabled={
                    formState.isSubmitting ||
                    !selected ||
                    !(qtyUsable > 0) ||
                    measuredOverIn
                  }
                  className="w-full sm:w-auto h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center justify-center gap-2 leading-none shadow-sm"
                  onClick={handleSubmit((values) => submitPayload(values, false, 'production'))}
                >
                  <Warehouse className="size-4 shrink-0" />
                  <span>
                    {formState.isSubmitting && submitAction === 'production'
                      ? 'Moving to Production Store…'
                      : 'Move to Production'}
                  </span>
                </Button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={
                  formState.isSubmitting ||
                  !selected ||
                  (isColorAllocation && (colorsOverLot || !colorLines.length)) ||
                  (!isColorAllocation && showsMeasuredOut && (!(qtyUsable > 0) || measuredOverIn))
                }
                className="dgn-btn dgn-btn-primary w-full sm:w-auto"
              >
                {formState.isSubmitting ? 'Saving…' : `Save ${meta.title.toLowerCase()}`}
              </button>
            )}
          </form>
        )}
      </div>
    </PageLayout>
  )
}

export function ProcessStagePage() {
  const { stage = 'sorting' } = useParams()
  return <ProcessStageForm stage={stage} />
}
