import { useEffect, useMemo, useState } from 'react'
import {  useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Warehouse, AlertCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, ErrorBanner } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'

import { SORT_COLORS } from '@/lib/sortColors'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'
import { ColorCombobox } from '@/components/ui/color-combobox'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Button } from '@/components/ui/button'
import { ProcessingWalletPayBox } from '@/components/ProcessingWalletPayBox'
import { useOperators } from '@/lib/useOperators'

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
    showLoadingCost?: boolean
    showTransportCost?: boolean
    showOtherCost?: boolean
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
    machineLabel: 'Crusher Machine',
    showTeam: false,
    showOperator: true,
    operatorLabel: 'Crusher Operator',
    showDowntime: false,
    showLabourCost: true,
    labourPerKg: true,
    showEnergyCost: false,
    showLoadingCost: true,
    showTransportCost: true,
    showOtherCost: true,
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
    labourPerKg: true,
    showEnergyCost: false,
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
    showLabourCost: true,
    labourPerKg: true,
    showEnergyCost: false,
  },
  recrushing: {
    title: 'Re-crushing',
    eyebrow: 'Recycling stage',
    queueTitle: 'Washed lots waiting to re-crush',
    emptyHint: 'No washed lots waiting. Finish washing first.',
    showMachine: false,
    showTeam: false,
    showOperator: true,
    operatorLabel: 'Re-crush Operator',
    showDowntime: false,
    showLabourCost: true,
    labourHourly: false,
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
  loadingCost: string
  transportCost: string
  otherCost: string
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
  colorItems?: Array<{
    id: number
    batchId?: number
    color: string
    qtyCrushed: number
    qtyWashed?: number | null
    qtyWashWaste?: number | null
    qtyDried?: number | null
    qtyDryWaste?: number | null
    status?: string
  }>
}

export type ColorLine = { color: string; qtyKg: number }
export type LotLine = {
  id?: number
  batchNumber?: string
  color: string | null
  qtyIn: number
  qtyUsable: string
}

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
  loadingCost: '0',
  transportCost: '0',
  otherCost: '0',
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
  /** Crushing / washing / drying: weigh after stage. Re-crushing keeps the same kg. */
  const showsMeasuredOut = isCrushing || isWashing || isDrying
  const showsWaste = isSorting || isRecycling
  /** Washing and drying: process all colours of a batch in a single run */
  const isMultiLotStage = isWashing || isDrying
  const meta = STAGE_META[stage] || STAGE_META.sorting
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeBatch, setActiveBatch] = useState<string | null>(
    () => presetBatchNumber || searchParams.get('batch') || null,
  )
  const [serverErrors, setServerErrors] = useState<ErrorItem[]>([])
  const [warning, setWarning] = useState<{ yieldPercent: number } | null>(null)
  const [submitAction, setSubmitAction] = useState<string | null>(null)
  const [colorLines, setColorLines] = useState<ColorLine[]>([])
  const [lotLines, setLotLines] = useState<LotLine[]>([])
  const [pickColor, setPickColor] = useState('')
  const [pickKg, setPickKg] = useState('')
  const [colorError, setColorError] = useState('')
  const [payFromProcessingWallet, setPayFromProcessingWallet] = useState(true)
  const [editingColor, setEditingColor] = useState<string | null>(null)
  const [editingKg, setEditingKg] = useState('')

  const staff = useOperators(STAGE_META[stage]?.showOperator !== false)

  const machines = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const { data } = await api.get('/machines')
      return data.data as Array<{ id: number; name: string; code?: string; machineType?: string }>
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
                  (receipt.unloadingCost ?? 0) +
                  (receipt.scaleCost ?? 0) +
                  (receipt.netBagCost ?? 0) +
                  (receipt.sortingCost ?? 0) +
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
    const list = machines.data || []
    const filtered = list.filter((m) => {
      const type = (m.machineType || '').toUpperCase().trim()
      const name = (m.name || '').toUpperCase().trim()
      const code = (m.code || '').toUpperCase().trim()
      const combined = `${type} ${name} ${code}`

      if (isWashing) {
        return type === 'WASHER' || combined.includes('WASH')
      }
      if (isCrushing) {
        // Crushing: primary crushers
        return (
          type === 'CRUSHER' ||
          combined.includes('CRUSHER') ||
          (combined.includes('CRUSH') && !combined.includes('RECRUSH'))
        )
      }
      if (isRecrushing) {
        // Re-crushing: re-crushers or crushers
        return (
          type === 'RECRUSHER' ||
          type === 'CRUSHER' ||
          combined.includes('RECRUSH') ||
          combined.includes('CRUSH')
        )
      }
      if (isDrying) {
        return type === 'DRYER' || combined.includes('DRY')
      }
      if (isRecycling) {
        return (
          type === 'RECYCLING' ||
          type === 'EXTRUDER' ||
          combined.includes('RECYCL') ||
          combined.includes('PELLET') ||
          combined.includes('EXTRUD')
        )
      }
      return true
    })

    // If machines matching this specific activity exist, show them;
    // Otherwise fallback to showing all active machines (excluding pure PRODUCTION machines if non-production machines exist, else all).
    const finalMachines =
      filtered.length > 0
        ? filtered
        : list.filter((m) => (m.machineType || '').toUpperCase() !== 'PRODUCTION').length > 0
          ? list.filter((m) => (m.machineType || '').toUpperCase() !== 'PRODUCTION')
          : list

    return finalMachines.map((m) => ({
      value: m.name,
      label: m.name,
      sublabel: [m.code ? `Code: ${m.code}` : '', m.machineType ? `Type: ${m.machineType}` : '']
        .filter(Boolean)
        .join(' · ') || undefined,
    }))
  }, [machines.data, isWashing, isCrushing, isRecrushing, isDrying, isRecycling])

  const batchOptions = useMemo(() => {
    return (inputs.data || []).map((b) => {
      const dateStr = formatBusinessDate(b.businessDate) || formatCreatedAt(b.createdAt)
      return {
        value: b.batchNumber,
        label: `${dateStr ? `${dateStr} · ` : ''}${b.batchNumber} - ${colorName(b.sortColor)} (${qtyLabel(b.qtyRemaining, b.uom)})`,
        sublabel: b.material?.name || b.batchType,
      }
    })
  }, [inputs.data])

  const { register, handleSubmit, watch, setValue, formState, reset } = useForm<FormValues>({
    defaultValues: emptyForm(activeBatch || ''),
  })

  // Reset when stage changes; keep ?batch= if present.
  useEffect(() => {
    const fromUrl = searchParams.get('batch') || presetBatchNumber || null
    setActiveBatch(fromUrl)
    setServerErrors([])
    setWarning(null)
    setColorLines([])
    setLotLines([])
    setPickColor('')
    setPickKg('')
    setColorError('')
    setEditingColor(null)
    setEditingKg('')
    reset(emptyForm(fromUrl || ''))
  }, [stage, presetBatchNumber, reset]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = inputs.data?.find((b) => b.batchNumber === activeBatch)

  // Washing & Drying: load colors for the selected batch into lotLines
  useEffect(() => {
    if (!isMultiLotStage) return
    if (!selected) {
      setLotLines([])
      return
    }
    if (selected.colorItems && selected.colorItems.length > 0) {
      setLotLines(
        selected.colorItems.map((item) => ({
          id: item.id,
          batchNumber: selected.batchNumber,
          color: item.color,
          qtyIn: isWashing
            ? Number(item.qtyCrushed || 0)
            : isRecrushing
            ? Number(item.qtyWashed ?? item.qtyDried ?? item.qtyCrushed ?? 0)
            : isDrying
            ? Number(item.qtyWashed ?? item.qtyCrushed ?? 0)
            : Number(item.qtyDried ?? item.qtyWashed ?? item.qtyCrushed ?? 0),
          qtyUsable: isWashing
            ? item.qtyWashed != null ? String(item.qtyWashed) : ''
            : isRecrushing
            ? item.qtyDried != null ? String(item.qtyDried) : ''
            : isDrying
            ? item.qtyDried != null ? String(item.qtyDried) : ''
            : '',
        })),
      )
    } else {
      setLotLines([
        {
          id: undefined,
          batchNumber: selected.batchNumber,
          color: selected.sortColor || null,
          qtyIn: Number(selected.qtyRemaining || 0),
          qtyUsable: '',
        },
      ])
    }
  }, [isMultiLotStage, isWashing, isDrying, isRecrushing, selected])

  const openBatch = (batchNumber: string) => {
    setActiveBatch(batchNumber)
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
      // Crushing (non-split) may start from remaining; wash multi-lot leaves measured empty.
      if (isCrushing || isRecrushing) {
        setValue('qtyUsable', String(selected.qtyRemaining))
      } else if (showsMeasuredOut) {
        setValue('qtyUsable', '')
      }
    }
  }, [selected, activeBatch, setValue, showsMeasuredOut, isCrushing])

  const isSplittingCrush =
    isCrushing &&
    (selected?.batchType === 'SCRAP' || colorLines.length > 0 || !selected?.sortColor)
  const isColorAllocation = isSorting || isSplittingCrush

  const lotTotalIn = useMemo(
    () => +lotLines.reduce((sum, line) => sum + line.qtyIn, 0).toFixed(3),
    [lotLines],
  )
  const lotTotalUsable = useMemo(
    () => +lotLines.reduce((sum, line) => sum + Number(line.qtyUsable || 0), 0).toFixed(3),
    [lotLines],
  )
  const lotTotalWaste = useMemo(
    () =>
      +lotLines
        .reduce((sum, line) => {
          const usable = Number(line.qtyUsable || 0)
          if (!(usable > 0)) return sum
          return sum + Math.max(0, line.qtyIn - usable)
        }, 0)
        .toFixed(3),
    [lotLines],
  )
  const lotOverIn = lotLines.some((line) => Number(line.qtyUsable || 0) - line.qtyIn > 0.001)
  const lotMissingUsable = lotLines.some((line) => !(Number(line.qtyUsable || 0) > 0))

  const qtyInput = isMultiLotStage ? lotTotalIn : Number(watch('qtyInput') || 0)
  const qtyWaste = Number(watch('qtyWaste') || 0)
  const colorUsable = useMemo(
    () => +colorLines.reduce((sum, line) => sum + line.qtyKg, 0).toFixed(3),
    [colorLines],
  )
  const qtyUsable = isMultiLotStage
    ? lotTotalUsable
    : isColorAllocation
      ? colorUsable
      : Number(watch('qtyUsable') || 0)

  const qtyReject = isColorAllocation
    ? Math.max(0, +(qtyInput - colorUsable).toFixed(3))
    : showsWaste
    ? Math.max(0, +(qtyInput - qtyUsable - qtyWaste).toFixed(3))
    : 0
  const measuredShrink = showsMeasuredOut
    ? Math.max(0, +(qtyInput - qtyUsable).toFixed(3))
    : 0
  const measuredOverIn =
    (showsMeasuredOut && !isColorAllocation && !isMultiLotStage && qtyUsable > 0 && qtyUsable - qtyInput > 0.001) ||
    (isMultiLotStage && lotOverIn)

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
    }

    if (isMultiLotStage) {
      if (!lotLines.length) {
        setServerErrors([
          {
            label: 'Colours',
            message: meta.emptyHint || 'No colour lots waiting for washing.',
          },
        ])
        setSubmitAction(null)
        return
      }
      if (lotMissingUsable) {
        setServerErrors([
          {
            label: 'Usable',
            message: 'Enter usable kg after washing for every colour.',
          },
        ])
        setSubmitAction(null)
        return
      }
      if (lotOverIn) {
        setServerErrors([
          {
            label: 'Usable',
            message: 'Usable cannot be more than qty in for any colour.',
          },
        ])
        setSubmitAction(null)
        return
      }
    } else if (showsMeasuredOut && !isColorAllocation) {
      const measured = Number(values.qtyUsable)
      const inbound = Number(values.qtyInput)
      const measuredLabel = isCrushing
        ? 'Measured after crushing'
        : isRecrushing
          ? 'Measured after re-crushing'
          : 'Measured after drying'
      if (!(measured > 0)) {
        setServerErrors([
          {
            label: measuredLabel,
            message: `Enter the measured kg after ${meta.title.toLowerCase()}.`,
          },
        ])
        setSubmitAction(null)
        return
      }
      if (measured - inbound > 0.001) {
        setServerErrors([
          {
            label: measuredLabel,
            message: `Measured (${measured} kg) cannot be more than qty in (${inbound} kg).`,
          },
        ])
        setSubmitAction(null)
        return
      }
    }

    if (isRecrushing) {
      const rateKg = Number(values.labourRatePerKg || 0)
      if (!(rateKg > 0)) {
        setServerErrors([{ label: 'Labour rate / kg', message: 'Enter labour cost per kg.' }])
        setSubmitAction(null)
        return
      }
    }

    try {
      const isSplitting = isColorAllocation && colorLines.length > 0
      const recrushQty = Number(selected?.qtyRemaining ?? values.qtyInput ?? 0)
      const labourRateKgVal = Number(values.labourRatePerKg || 0)
      const relevantKg = isRecrushing
        ? recrushQty
        : isMultiLotStage
        ? lotTotalIn
        : isSplitting
          ? colorUsable
          : Number(values.qtyUsable) || Number(values.qtyInput) || 0
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
        inputBatchNumber:
          activeBatch || selected?.batchNumber || lotLines[0]?.batchNumber || values.inputBatchNumber,
        qtyInput: isRecrushing
          ? recrushQty
          : isMultiLotStage
            ? lotTotalIn
            : Number(values.qtyInput),
        qtyUsable: isRecrushing
          ? recrushQty
          : isMultiLotStage
          ? lotTotalUsable
          : isSplitting
            ? colorUsable
            : Number(values.qtyUsable),
        qtyReject: isRecrushing
          ? 0
          : isMultiLotStage
          ? lotTotalWaste
          : showsWaste
            ? qtyReject
            : 0,
        qtyWaste: 0,
        colorLines: isSplitting ? colorLines : undefined,
        colorUpdates: isMultiLotStage
          ? lotLines.map((line) => ({
              id: line.id,
              color: line.color,
              qtyInput: line.qtyIn,
              qtyUsable: Number(line.qtyUsable || 0),
            }))
          : undefined,
        lots: isMultiLotStage
          ? lotLines.map((line) => ({
              id: line.id,
              inputBatchNumber:
                activeBatch || selected?.batchNumber || line.batchNumber,
              color: line.color,
              qtyInput: line.qtyIn,
              qtyUsable: Number(line.qtyUsable || 0),
            }))
          : undefined,
        labourCost: meta.showLabourCost !== false ? calculatedLabour : 0,
        labourRatePerKg: labourRateKgVal > 0 ? labourRateKgVal : undefined,
        labourHours: labourHoursVal > 0 ? labourHoursVal : undefined,
        labourRatePerHour: labourRateVal > 0 ? labourRateVal : undefined,
        energyCost: meta.showEnergyCost !== false ? Number(values.energyCost || 0) : 0,
        loadingCost: meta.showLoadingCost ? Number(values.loadingCost || 0) : 0,
        transportCost: meta.showTransportCost ? Number(values.transportCost || 0) : 0,
        otherCost: meta.showOtherCost ? Number(values.otherCost || 0) : 0,
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
        payFromProcessingWallet,
      })

      const resultingBatch =
        data.batchNumber || activeBatch || values.inputBatchNumber || lotLines[0]?.batchNumber

      // Drying "Move to Material" and re-crushing go to the store, not QC.
      if ((isDrying && destination === 'production') || isRecrushing) {
        try {
          await api.post('/production/store/transfer', { batchNumber: resultingBatch })
          await queryClient.invalidateQueries({ queryKey: ['production-store'] })
          await queryClient.invalidateQueries({ queryKey: ['production-store-pending'] })
          await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
        } catch (transferErr: any) {
          console.error('Failed to auto-transfer to production store:', transferErr)
          alert(
            `${meta.title} saved as batch ${resultingBatch}, but transfer to Material Store had an issue: ` +
              (transferErr.response?.data?.err || transferErr.response?.data?.message || transferErr.message),
          )
        }
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

      await queryClient.invalidateQueries({ queryKey: ['process-inputs'] })
      await queryClient.invalidateQueries({ queryKey: ['batches'] })
      await queryClient.invalidateQueries({ queryKey: ['batch'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['stock-ledger'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
      await queryClient.invalidateQueries()

      if (isRecrushing) {
        navigate('/production/store')
      } else if (isDrying && destination === 'production') {
        navigate('/production/store')
      } else if (isRecycling) {
        navigate('/production/store')
      } else {
        navigate(`/process/${stage}`)
      }
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

  // ——— Form view ———
  return (
    <PageLayout
      title={
        isMultiLotStage
          ? `Record ${meta.title}`
          : selected
            ? `${meta.title}: ${selected.batchNumber}`
            : `Record ${meta.title}`
      }
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
        ) : selected ? (
          <Card className="p-3.5 sm:p-4 bg-zinc-50/90 border-zinc-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-200 text-zinc-700">
                    Selected Batch
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900">
                    {selected.batchNumber}
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink-muted)] mt-1">
                  {(formatBusinessDate(selected.businessDate) || formatCreatedAt(selected.createdAt)) && (
                    <strong className="text-zinc-900 font-bold mr-2">
                      {formatBusinessDate(selected.businessDate) || formatCreatedAt(selected.createdAt)}
                    </strong>
                  )}
                  {selected.material?.name || selected.batchType} · Available in queue:{' '}
                  <strong className="text-emerald-700 font-bold">
                    {qtyLabel(selected.qtyRemaining, selected.uom)}
                  </strong>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs font-semibold shrink-0 cursor-pointer self-start sm:self-center"
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
        ) : null}

        {selected && (
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => submitPayload(values, false))}
          >
            <input type="hidden" {...register('inputBatchNumber', { required: true })} />
            {isRecrushing && <input type="hidden" {...register('qtyInput', { required: true })} />}

            {isMultiLotStage && (
              <Card className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-900">
                      Colours · usable after {meta.title.toLowerCase()}
                    </h2>
                    <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                      Enter usable kg for each separated colour. Waste and yield calculate automatically.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-700 bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200 shrink-0">
                    {lotLines.length} colour{lotLines.length === 1 ? '' : 's'}
                  </span>
                </div>

                {inputs.isLoading ? (
                  <p className="mt-4 text-sm text-[var(--ink-muted)]">Loading colour lots…</p>
                ) : lotLines.length === 0 ? (
                  <p className="mt-4 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    {meta.emptyHint}
                  </p>
                ) : (
                  <>
                    {/* Batch Total Summary Strip */}
                    <div className="mt-3.5 rounded-xl border border-zinc-200 bg-zinc-50/90 p-3 sm:p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/80">
                        <div className="pt-1 sm:pt-0 sm:px-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Total In
                          </p>
                          <p className="mt-1 text-base sm:text-lg font-bold text-zinc-900 font-mono">
                            {lotTotalIn.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-zinc-400">kg</span>
                          </p>
                        </div>
                        <div className="pt-1 sm:pt-0 sm:px-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Total Usable
                          </p>
                          <p className="mt-1 text-base sm:text-lg font-bold text-emerald-600 font-mono">
                            {lotTotalUsable.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-zinc-400">kg</span>
                          </p>
                        </div>
                        <div className="pt-3 sm:pt-0 sm:px-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Total Waste
                          </p>
                          <p className="mt-1 text-base sm:text-lg font-bold text-zinc-800 font-mono">
                            {lotTotalWaste.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-zinc-400">kg</span>
                          </p>
                        </div>
                        <div className="pt-3 sm:pt-0 sm:px-2">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Overall Yield
                          </p>
                          <p className="mt-1 text-base sm:text-lg font-bold text-blue-600 font-mono">
                            {lotTotalIn > 0 ? ((lotTotalUsable / lotTotalIn) * 100).toFixed(1) : 0}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Desktop & Tablet Table (sm and up) */}
                    <div className="mt-4 hidden sm:block overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-xs">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-zinc-50/90 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider text-xs">
                          <tr>
                            <th className="py-3 px-3.5 w-10 text-center text-zinc-400 font-normal">#</th>
                            <th className="py-3 px-4">Colour</th>
                            <th className="py-3 px-4 text-right">Inbound Qty</th>
                            <th className="py-3 px-4 text-right">Usable Qty (kg)</th>
                            <th className="py-3 px-4 text-right">Waste (kg)</th>
                            <th className="py-3 px-4 text-right">Yield</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {lotLines.map((line, idx) => {
                            const usableNum = Number(line.qtyUsable || 0)
                            const over = usableNum - line.qtyIn > 0.001
                            const wasteKg =
                              usableNum > 0 ? Math.max(0, +(line.qtyIn - usableNum).toFixed(3)) : null
                            const rowYield =
                              line.qtyIn > 0 && usableNum > 0
                                ? ((usableNum / line.qtyIn) * 100).toFixed(1)
                                : null

                            return (
                              <tr
                                key={line.id || line.color || idx}
                                className="hover:bg-zinc-50/80 transition-colors"
                              >
                                <td className="py-3 px-3.5 text-center text-zinc-400 font-mono text-xs">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2.5">
                                    <span className="inline-block h-3.5 w-3.5 rounded-full border border-zinc-300 bg-zinc-400 shadow-2xs shrink-0" />
                                    <span className="font-semibold text-zinc-900 text-sm">
                                      {colorName(line.color)}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-800 whitespace-nowrap text-sm">
                                  {line.qtyIn.toLocaleString()} <span className="text-xs text-zinc-400 font-normal">kg</span>
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <div className="inline-flex flex-col items-end">
                                    <input
                                      inputMode="decimal"
                                      className={`h-10 w-32 text-right font-mono font-bold text-sm px-3 rounded-lg border transition-all ${
                                        over
                                          ? 'border-red-400 bg-red-50 text-red-900 ring-2 ring-red-200'
                                          : 'border-zinc-300 bg-white text-zinc-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                      }`}
                                      value={line.qtyUsable}
                                      placeholder="0.00"
                                      onChange={(e) => {
                                        const val = e.target.value
                                        setLotLines((prev) =>
                                          prev.map((row, rIdx) =>
                                            (row.id ? row.id === line.id : rIdx === idx)
                                              ? { ...row, qtyUsable: val }
                                              : row,
                                          ),
                                        )
                                      }}
                                    />
                                    {over && (
                                      <span className="text-xs text-red-600 font-medium mt-0.5">
                                        Max {line.qtyIn} kg
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-semibold whitespace-nowrap text-sm">
                                  {wasteKg == null ? (
                                    <span className="text-zinc-300 font-normal">—</span>
                                  ) : (
                                    <span
                                      className={
                                        wasteKg > 0 ? 'text-amber-800 font-semibold' : 'text-zinc-400'
                                      }
                                    >
                                      {wasteKg.toLocaleString()}{' '}
                                      <span className="text-xs text-zinc-500 font-normal">kg</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-sm whitespace-nowrap">
                                  {rowYield == null ? (
                                    <span className="text-zinc-300 font-normal">—</span>
                                  ) : (
                                    <span
                                      className={
                                        Number(rowYield) >= 90
                                          ? 'text-emerald-700 font-bold'
                                          : 'text-zinc-700 font-semibold'
                                      }
                                    >
                                      {rowYield}%
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View (< sm): Touch-friendly cards for comfortable recording */}
                    <div className="mt-3.5 sm:hidden space-y-3">
                      {lotLines.map((line, idx) => {
                        const usableNum = Number(line.qtyUsable || 0)
                        const over = usableNum - line.qtyIn > 0.001
                        const wasteKg =
                          usableNum > 0 ? Math.max(0, +(line.qtyIn - usableNum).toFixed(3)) : null
                        const rowYield =
                          line.qtyIn > 0 && usableNum > 0
                            ? ((usableNum / line.qtyIn) * 100).toFixed(1)
                            : null

                        return (
                          <div
                            key={line.id || line.color || idx}
                            className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-2xs space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="inline-block h-3.5 w-3.5 rounded-full border border-zinc-300 bg-zinc-400 shrink-0" />
                                <span className="font-bold text-zinc-900 text-sm">
                                  {colorName(line.color)}
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-zinc-700 font-mono bg-zinc-100 px-2.5 py-1 rounded-md border border-zinc-200/80">
                                Inbound: <strong className="text-zinc-900">{line.qtyIn.toLocaleString()} kg</strong>
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 items-end">
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                                  Usable (kg)
                                </label>
                                <input
                                  inputMode="decimal"
                                  className={`h-10 w-full text-right font-mono font-bold text-base px-3 rounded-lg border transition-all ${
                                    over
                                      ? 'border-red-400 bg-red-50 text-red-900 ring-2 ring-red-200'
                                      : 'border-zinc-300 bg-white text-zinc-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                                  }`}
                                  value={line.qtyUsable}
                                  placeholder="0.00"
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setLotLines((prev) =>
                                      prev.map((row, rIdx) =>
                                        (row.id ? row.id === line.id : rIdx === idx)
                                          ? { ...row, qtyUsable: val }
                                          : row,
                                      ),
                                    )
                                  }}
                                />
                                {over && (
                                  <span className="text-xs text-red-600 font-medium block mt-1">
                                    Max {line.qtyIn} kg
                                  </span>
                                )}
                              </div>

                              <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-2.5 text-right space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-zinc-500 font-medium">Waste:</span>
                                  <span className="font-mono font-bold text-zinc-800">
                                    {wasteKg == null ? '—' : `${wasteKg.toLocaleString()} kg`}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-200/60">
                                  <span className="text-zinc-500 font-medium">Yield:</span>
                                  <span className="font-mono font-bold text-emerald-600">
                                    {rowYield == null ? '—' : `${rowYield}%`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </Card>
            )}

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
            ) : !isMultiLotStage && !isRecrushing ? (
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
                            : isWashing
                            ? 'Measured after washing (kg)'
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
                          value={qtyUsable > 0 ? String(measuredShrink) : ''}
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
            ) : null}

            <Card className="!p-2.5 sm:!p-3.5">
              <div className="grid gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      searchPlaceholder="Search operators by name or code…"
                      onOpenChange={(open) => {
                        if (open) void staff.refetch()
                      }}
                    />
                  </Field>
                )}
                {meta.showTeam && (
                  <Field label="Team">
                    <input className="dgn-input" {...register('teamName')} placeholder="Team name" />
                  </Field>
                )}

                {/* Cost fields: 4 per row on desktop for crushing/washing/drying, 2 on mobile */}
                {(meta.showLabourCost !== false ||
                  meta.showEnergyCost !== false ||
                  meta.showWashFields ||
                  meta.showLoadingCost ||
                  meta.showTransportCost ||
                  meta.showOtherCost) && (
                  <div
                    className={
                      isCrushing || isWashing || isDrying || isRecrushing
                        ? 'col-span-full grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3'
                        : 'col-span-full grid grid-cols-2 gap-2 sm:contents'
                    }
                  >
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
                    {meta.showEnergyCost !== false && (
                      <Field label="Energy cost (₦)">
                        <input inputMode="decimal" className="dgn-input" {...register('energyCost')} />
                      </Field>
                    )}
                    {meta.showLoadingCost && (
                      <Field label="Loading cost (₦)">
                        <input
                          inputMode="decimal"
                          placeholder="0"
                          className="dgn-input"
                          {...register('loadingCost')}
                        />
                      </Field>
                    )}
                    {meta.showTransportCost && (
                      <Field label="Transport cost (₦)">
                        <input
                          inputMode="decimal"
                          placeholder="0"
                          className="dgn-input"
                          {...register('transportCost')}
                        />
                      </Field>
                    )}
                    {meta.showOtherCost && (
                      <Field label="Other cost (₦)">
                        <input
                          inputMode="decimal"
                          placeholder="0"
                          className="dgn-input"
                          {...register('otherCost')}
                        />
                      </Field>
                    )}
                    {meta.showLabourCost !== false && meta.labourPerKg && Number(watch('labourRatePerKg') || 0) > 0 && (
                      <div className="col-span-full rounded-md bg-emerald-50/90 border border-emerald-200/80 px-3 py-1.5 text-xs font-medium text-emerald-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>⚖️</span>
                          <span>
                            Calculated {meta.title.toLowerCase()} labour (₦{Number(watch('labourRatePerKg')).toLocaleString()}/kg × {((isMultiLotStage ? (lotTotalUsable > 0 ? lotTotalUsable : lotTotalIn) : (isColorAllocation && colorUsable > 0 ? colorUsable : qtyUsable > 0 ? qtyUsable : qtyInput)) || 0).toLocaleString()} kg):
                          </span>
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-emerald-700">
                          ₦
                          {(
                            Number(watch('labourRatePerKg') || 0) *
                            ((isMultiLotStage ? (lotTotalUsable > 0 ? lotTotalUsable : lotTotalIn) : (isColorAllocation && colorUsable > 0 ? colorUsable : qtyUsable > 0 ? qtyUsable : qtyInput)) || 0)
                          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {meta.showLabourCost !== false && meta.labourHourly && Number(watch('labourHours') || 0) > 0 && Number(watch('labourRatePerHour') || 0) > 0 && (
                      <div className="col-span-full rounded-md bg-blue-50/90 border border-blue-200/80 px-3 py-1.5 text-xs font-medium text-blue-900 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>⏱️</span>
                          <span>
                            Calculated {meta.title.toLowerCase()} labour ({watch('labourHours')} hrs × ₦
                            {Number(watch('labourRatePerHour')).toLocaleString()}/hr):
                          </span>
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-blue-700">
                          ₦
                          {(
                            Number(watch('labourHours') || 0) * Number(watch('labourRatePerHour') || 0)
                          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
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
                {!isCrushing && (
                  <Field label="Notes">
                    <input className="dgn-input" {...register('notes')} />
                  </Field>
                )}
              </div>
            </Card>

            <ProcessingWalletPayBox
              checked={payFromProcessingWallet}
              onChange={setPayFromProcessingWallet}
            />

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

            {/* Washing: complete only. Drying: complete or move to material store. */}
            {isWashing || isDrying ? (
              <div className="pt-1 flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                <Button
                  type="submit"
                  size="default"
                  disabled={
                    formState.isSubmitting ||
                    (isMultiLotStage
                      ? !lotLines.length || lotMissingUsable || measuredOverIn
                      : !selected || !(qtyUsable > 0) || measuredOverIn)
                  }
                  className="w-full sm:w-auto h-9 sm:h-10 px-5 text-xs sm:text-sm font-semibold shadow-xs inline-flex items-center justify-center gap-2 leading-none cursor-pointer"
                >
                  {formState.isSubmitting && !submitAction ? (
                    <>
                      <Loader2 className="size-3.5 sm:size-4 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Complete {meta.title}</span>
                  )}
                </Button>
                {isDrying && (
                <Button
                  type="button"
                  size="default"
                  disabled={
                    formState.isSubmitting ||
                    (isMultiLotStage
                      ? !lotLines.length || lotMissingUsable || measuredOverIn
                      : !selected || !(qtyUsable > 0) || measuredOverIn)
                  }
                  className="w-full sm:w-auto h-9 sm:h-10 px-5 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center justify-center gap-2 leading-none shadow-xs cursor-pointer"
                  onClick={handleSubmit((values) => submitPayload(values, false, 'production'))}
                >
                  <Warehouse className="size-3.5 sm:size-4 shrink-0" />
                  <span>
                    {formState.isSubmitting && submitAction === 'production'
                      ? 'Moving to Material…'
                      : 'Move to Material Store'}
                  </span>
                </Button>
                )}
              </div>
            ) : (
              <Button
                type="submit"
                size="default"
                disabled={
                  formState.isSubmitting ||
                  (isRecrushing && !(Number(watch('labourRatePerKg') || 0) > 0)) ||
                  (isMultiLotStage
                    ? !lotLines.length || lotMissingUsable || measuredOverIn
                    : !selected ||
                      (isColorAllocation && (colorsOverLot || !colorLines.length)) ||
                      (!isColorAllocation &&
                        showsMeasuredOut &&
                        (!(qtyUsable > 0) || measuredOverIn)))
                }
                className="w-full sm:w-auto h-9 sm:h-10 px-5 text-xs sm:text-sm font-semibold shadow-xs inline-flex items-center justify-center gap-2 leading-none cursor-pointer"
              >
                {formState.isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 sm:size-4 animate-spin" />
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
