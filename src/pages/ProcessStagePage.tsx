import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Warehouse, RotateCcw, ArrowRight, CheckCircle2, AlertCircle, Loader2, Recycle } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, ErrorBanner } from '@/components/ui'
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
    labourHourly?: boolean
    labourPerKg?: boolean
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
    labourPerKg: true,
    showEnergyCost: false,
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
    labourPerKg: true,
    showEnergyCost: false,
  },
  recycling: {
    title: 'Recycling',
    eyebrow: 'Pelletizing & Granulation',
    queueTitle: 'Dried lots waiting for recycling',
    emptyHint: 'No dried lots waiting. Complete drying first.',
    showMachine: true,
    machineLabel: 'Pelletizer / Recycling Machine',
    showTeam: false,
    showOperator: true,
    operatorLabel: 'Recycling Lead',
    showDowntime: true,
    showLabourCost: true,
    showEnergyCost: true,
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
  labourRatePerKg?: string
  labourHours?: string
  labourRatePerHour?: string
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
  labourRatePerKg: '',
  labourHours: '',
  labourRatePerHour: '',
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
  const isRecycling = stage === 'recycling'
  /** Crushing / drying / recrushing: weigh after stage; washing / sorting / recycling record waste. */
  const showsMeasuredOut = isCrushing || isDrying || isRecrushing
  const showsWaste = isSorting || isWashing || isRecycling
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
  const [dryingDestination, setDryingDestination] = useState<'recycling' | 'recrushing' | 'production' | null>(null)
  const [submitAction, setSubmitAction] = useState<string | null>(null)
  const [colorLots, setColorLots] = useState<ColorLot[]>([])
  const [scrapTicket, setScrapTicket] = useState<string | null>(null)
  const [colorLines, setColorLines] = useState<ColorLine[]>([])
  const [pickColor, setPickColor] = useState('')
  const [pickKg, setPickKg] = useState('')
  const [colorError, setColorError] = useState('')
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
      sublabel: b.material?.name || b.batchType,
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
    setColorError('')
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
    setColorError('')
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

  const validateColorAdd = (color: string, kgStr: string): string | null => {
    if (!color) {
      return 'Please select a colour first.'
    }
    const kg = Number(kgStr)
    if (!kgStr.trim() || isNaN(kg) || kg <= 0) {
      return 'Please enter a valid weight in kg (greater than 0).'
    }
    if (kg > colorRoomLeft + 0.0001) {
      return `Cannot allocate ${kg.toFixed(3)} kg. Only ${colorRoomLeft.toFixed(3)} kg remaining in this lot.`
    }
    return null
  }

  const addColorLine = () => {
    const err = validateColorAdd(pickColor, pickKg)
    if (err) {
      setColorError(err)
      return
    }
    setColorError('')
    const kg = Number(pickKg)
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
    if (!editingKg.trim() || isNaN(kg) || kg <= 0) {
      setColorError('Please enter a valid weight in kg.')
      return
    }
    const otherLinesSum = colorLines
      .filter((l) => l.color !== color)
      .reduce((sum, l) => sum + l.qtyKg, 0)
    const maxAllowed = qtyInput - otherLinesSum
    if (kg > maxAllowed + 0.0001) {
      setColorError(`Cannot set ${kg.toFixed(3)} kg. Maximum available for this colour is ${maxAllowed.toFixed(3)} kg.`)
      return
    }
    setColorError('')
    setColorLines((prev) =>
      prev.map((l) => (l.color === color ? { ...l, qtyKg: +kg.toFixed(3) } : l)),
    )
    setEditingColor(null)
    setEditingKg('')
  }

  const removeColorLine = (color: string) => {
    setColorError('')
    setColorLines((prev) => prev.filter((line) => line.color !== color))
  }

  const submitPayload = async (
    values: FormValues,
    confirmUnusualYield = false,
    destination?: 'recycling' | 'recrushing' | 'production',
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
      const labourRateKgVal = Number(values.labourRatePerKg || 0)
      const relevantKg = (isSplitting ? colorUsable : (Number(values.qtyUsable) || Number(values.qtyInput))) || 0
      const labourHoursVal = Number(values.labourHours || 0)
      const labourRateVal = Number(values.labourRatePerHour || 0)
      const calculatedLabour =
        meta.labourPerKg && labourRateKgVal > 0
          ? +(labourRateKgVal * relevantKg).toFixed(2)
          : meta.labourHourly && labourHoursVal > 0 && labourRateVal > 0
          ? +(labourHoursVal * labourRateVal).toFixed(2)
          : Number(values.labourCost || 0)

      const { data } = await api.post(`/process/${stage}`, {
        ...values,
        inputBatchNumber: activeBatch || values.inputBatchNumber,
        qtyInput: Number(values.qtyInput),
        qtyUsable: isSplitting ? colorUsable : Number(values.qtyUsable),
        qtyReject: showsWaste ? qtyReject : 0,
        qtyWaste: 0,
        colorLines: isSplitting ? colorLines : undefined,
        labourCost: meta.showLabourCost !== false ? calculatedLabour : 0,
        labourRatePerKg: labourRateKgVal > 0 ? labourRateKgVal : undefined,
        labourHours: labourHoursVal > 0 ? labourHoursVal : undefined,
        labourRatePerHour: labourRateVal > 0 ? labourRateVal : undefined,
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
      } else if (isDrying && destination === 'recycling') {
        setDryingDestination('recycling')
      } else if (isDrying && destination === 'recrushing') {
        setDryingDestination('recrushing')
      }

      // If recycling completed, auto-transfer output pellets to Production Store
      if (isRecycling) {
        try {
          await api.post('/production/store/transfer', { batchNumber: resultingBatch })
          await queryClient.invalidateQueries({ queryKey: ['production-store'] })
          await queryClient.invalidateQueries({ queryKey: ['production-store-pending'] })
          await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
        } catch (transferErr: any) {
          console.error('Failed to auto-transfer pellets to production store:', transferErr)
        }
      }

      if (Array.isArray(data.colorLots) && data.colorLots.length > 0) {
        setColorLots(data.colorLots)
        setScrapTicket(data.scrapTicket || values.inputBatchNumber)
      }
      setSuccessBatch(resultingBatch)
      await queryClient.invalidateQueries({ queryKey: ['process-inputs'] })
      await queryClient.invalidateQueries({ queryKey: ['batches'] })
      await queryClient.invalidateQueries({ queryKey: ['batch'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['stock-ledger'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
      await queryClient.invalidateQueries()
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
      recycling: null,
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
              : dryingDestination === 'recycling'
                ? 'Drying completed & ready for Recycling'
                : 'Drying completed & ready for Re-crushing'
          }
        >
          <Card className="text-center !p-6 max-w-xl mx-auto space-y-4">
            <div className="mx-auto size-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              {dryingDestination === 'production' ? (
                <Warehouse className="size-6" />
              ) : dryingDestination === 'recycling' ? (
                <Recycle className="size-6" />
              ) : (
                <RotateCcw className="size-6" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                Drying Complete
              </p>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 mt-1">
                Batch {successBatch}
              </h2>
              <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                {dryingDestination === 'production'
                  ? 'Batch has been saved and transferred directly to the Production Store. It is now ready for production extrusion.'
                  : dryingDestination === 'recycling'
                    ? 'Batch has been saved and is available in the Recycling queue for pelletizing.'
                    : 'Batch has been saved in the drying area for secondary crushing. It is now available in the Re-crushing queue.'}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2.5">
              {dryingDestination === 'production' ? (
                <Button asChild size="lg">
                  <Link
                    to="/production/store"
                    className="inline-flex items-center justify-center gap-1.5 leading-none"
                  >
                    <Warehouse className="size-4 shrink-0" />
                    <span>Open Production Store</span>
                  </Link>
                </Button>
              ) : dryingDestination === 'recycling' ? (
                <Button asChild size="lg">
                  <Link
                    to={`/process/recycling/new?batch=${encodeURIComponent(successBatch)}`}
                    className="inline-flex items-center justify-center gap-1.5 leading-none"
                  >
                    <Recycle className="size-4 shrink-0" />
                    <span>Process Recycling Now</span>
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
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
                Start another lot
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
            {isRecycling ? (
              <Button asChild size="lg">
                <Link
                  to="/production/store"
                  className="inline-flex items-center justify-center gap-1.5 leading-none"
                >
                  <Warehouse className="size-4 shrink-0" />
                  <span>Open Production Store</span>
                </Link>
              </Button>
            ) : next ? (
              <Button asChild size="lg">
                <Link
                  to={`/process/${next}/new`}
                  className="inline-flex items-center justify-center gap-1.5 leading-none"
                >
                  <span>Next: {STAGE_META[next]?.title}</span>
                  <ArrowRight className="size-4 shrink-0 ml-0.5" />
                </Link>
              </Button>
            ) : null}
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
                  </strong>
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

                {/* Stats strip on one card */}
                {isCrushing && qtyInput > 0 && (
                  <div className="mt-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2.5 sm:p-3">
                    <div
                      className={`grid gap-1 sm:gap-2 text-center divide-x divide-zinc-200/60 ${
                        batchDetail.data?.pricePerKg ? 'grid-cols-4' : 'grid-cols-3'
                      }`}
                    >
                      <div className="px-1">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Allocated
                        </p>
                        <p className="mt-0.5 text-xs sm:text-sm font-bold text-emerald-600 font-mono">
                          {colorUsable.toFixed(3)} <span className="text-[10px] font-normal text-zinc-400">kg</span>
                        </p>
                      </div>

                      <div className="px-1">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Remaining
                        </p>
                        <p
                          className={`mt-0.5 text-xs sm:text-sm font-bold font-mono ${
                            colorRoomLeft > 0.001 ? 'text-amber-600' : 'text-zinc-400'
                          }`}
                        >
                          {colorRoomLeft.toFixed(3)} <span className="text-[10px] font-normal text-zinc-400">kg</span>
                        </p>
                      </div>

                      <div className="px-1">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Waste
                        </p>
                        <p className="mt-0.5 text-xs sm:text-sm font-bold text-zinc-700 font-mono">
                          {qtyInput > 0 ? qtyReject.toFixed(3) : '—'}{' '}
                          <span className="text-[10px] font-normal text-zinc-400">kg</span>
                        </p>
                      </div>

                      {batchDetail.data?.pricePerKg && (
                        <div className="px-1">
                          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            ₦ / kg
                          </p>
                          <p className="mt-0.5 text-xs sm:text-sm font-bold text-zinc-800 font-mono">
                            ₦{batchDetail.data.pricePerKg.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Add colour row */}
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end">
                  <div className="flex-1 shrink-0">
                    <label className="mb-1 block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">
                      Colour
                    </label>
                    <ColorCombobox
                      value={pickColor}
                      onChange={(code) => {
                        setPickColor(code)
                        setColorError('')
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
                      className={`dgn-input w-full ${colorError ? 'border-red-400 focus:border-red-500' : ''}`}
                      placeholder="0.000"
                      value={pickKg}
                      onChange={(e) => {
                        const val = e.target.value
                        setPickKg(val)
                        const n = Number(val)
                        if (val && !isNaN(n) && n > colorRoomLeft + 0.0001) {
                          setColorError(`Exceeds remaining lot (max ${colorRoomLeft.toFixed(3)} kg)`)
                        } else {
                          setColorError('')
                        }
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColorLine())}
                    />
                  </div>
                  <div className="sm:shrink-0 sm:w-28">
                    <Button
                      type="button"
                      className="w-full h-11 font-semibold"
                      disabled={!(qtyInput > 0) || colorRoomLeft <= 0.001}
                      onClick={addColorLine}
                    >
                      + Add
                    </Button>
                  </div>
                </div>

                {colorError && (
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:border-red-900/50 dark:text-red-400 animate-in fade-in-0 duration-150">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{colorError}</span>
                  </div>
                )}

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
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-teal-50/80 border border-teal-200/60 px-2.5 py-2 sm:px-4 sm:py-3 text-teal-900">
                      <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-teal-800/80">
                        Yield
                      </p>
                      <p className="mt-0.5 text-xs sm:text-base font-bold font-mono text-teal-700">
                        {yieldPercent}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 border border-zinc-200/80 px-2.5 py-2 sm:px-4 sm:py-3 text-zinc-900">
                      <p className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        {showsMeasuredOut ? 'Measured / in' : 'Accounted'}
                      </p>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold font-mono text-zinc-800 truncate">
                        {showsMeasuredOut
                          ? `${qtyUsable || 0} / ${qtyInput || 0} kg`
                          : `${+(qtyUsable + qtyReject).toFixed(3)} / ${qtyInput || 0} kg`}
                      </p>
                    </div>
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

                {/* Cost fields: 2 per row on mobile to conserve space */}
                {(meta.showLabourCost !== false || meta.showEnergyCost !== false || meta.showWashFields) && (
                  <div className="col-span-full grid grid-cols-2 gap-2.5 sm:contents">
                    {meta.showLabourCost !== false && (
                      meta.labourPerKg ? (
                        <Field label="Labour rate / kg (₦)">
                          <input
                            inputMode="decimal"
                            placeholder="e.g. 15"
                            className="dgn-input"
                            {...register('labourRatePerKg')}
                          />
                        </Field>
                      ) : meta.labourHourly ? (
                        <>
                          <Field label="Labour rate / hr (₦)">
                            <input
                              inputMode="decimal"
                              placeholder="e.g. 1500"
                              className="dgn-input"
                              {...register('labourRatePerHour')}
                            />
                          </Field>
                          <Field label="Hours worked (hrs)">
                            <input
                              inputMode="decimal"
                              placeholder="e.g. 2.5"
                              step="0.1"
                              className="dgn-input"
                              {...register('labourHours')}
                            />
                          </Field>
                        </>
                      ) : (
                        <Field label="Labour cost (₦)">
                          <input inputMode="decimal" className="dgn-input" {...register('labourCost')} />
                        </Field>
                      )
                    )}
                    {meta.showEnergyCost !== false && (
                      <Field label="Energy cost (₦)">
                        <input inputMode="decimal" className="dgn-input" {...register('energyCost')} />
                      </Field>
                    )}
                    {meta.showLabourCost !== false && meta.labourPerKg && Number(watch('labourRatePerKg') || 0) > 0 && (
                      <div className="col-span-full rounded-md bg-emerald-50/90 border border-emerald-200/80 px-3.5 py-2 text-xs font-medium text-emerald-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>⚖️</span>
                          <span>
                            Calculated crushing labour (₦{Number(watch('labourRatePerKg')).toLocaleString()}/kg × {((isColorAllocation && colorUsable > 0 ? colorUsable : qtyUsable > 0 ? qtyUsable : qtyInput) || 0).toLocaleString()} kg):
                          </span>
                        </span>
                        <span className="font-bold text-sm text-emerald-700">
                          ₦
                          {(
                            Number(watch('labourRatePerKg') || 0) *
                            ((isColorAllocation && colorUsable > 0 ? colorUsable : qtyUsable > 0 ? qtyUsable : qtyInput) || 0)
                          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {meta.showLabourCost !== false && meta.labourHourly && Number(watch('labourHours') || 0) > 0 && Number(watch('labourRatePerHour') || 0) > 0 && (
                      <div className="col-span-full rounded-md bg-blue-50/90 border border-blue-200/80 px-3.5 py-2 text-xs font-medium text-blue-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>⏱️</span>
                          <span>
                            Calculated crushing labour ({watch('labourHours')} hrs × ₦
                            {Number(watch('labourRatePerHour')).toLocaleString()}/hr):
                          </span>
                        </span>
                        <span className="font-bold text-sm text-blue-700">
                          ₦
                          {(
                            Number(watch('labourHours') || 0) * Number(watch('labourRatePerHour') || 0)
                          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
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
                  </div>
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
                <Button
                  type="button"
                  className="mt-2 font-semibold"
                  onClick={handleSubmit((values) => submitPayload(values, true))}
                >
                  Confirm unusual yield
                </Button>
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
                  className="w-full sm:w-auto h-11 px-5 border-emerald-600/40 text-emerald-900 hover:bg-emerald-50 hover:text-emerald-950 font-semibold inline-flex items-center justify-center gap-2 leading-none"
                  onClick={handleSubmit((values) => submitPayload(values, false, 'recycling'))}
                >
                  <Recycle className="size-4 shrink-0 text-emerald-700" />
                  <span>
                    {formState.isSubmitting && submitAction === 'recycling'
                      ? 'Moving to Recycling…'
                      : 'Move to Recycling'}
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
              <Button
                type="submit"
                size="lg"
                disabled={
                  formState.isSubmitting ||
                  !selected ||
                  (isColorAllocation && (colorsOverLot || !colorLines.length)) ||
                  (!isColorAllocation && showsMeasuredOut && (!(qtyUsable > 0) || measuredOverIn))
                }
                className="w-full sm:w-auto h-11 px-6 font-semibold shadow-sm inline-flex items-center justify-center gap-2 leading-none"
              >
                {formState.isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <span>Save {meta.title.toLowerCase()}</span>
                )}
              </Button>
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
