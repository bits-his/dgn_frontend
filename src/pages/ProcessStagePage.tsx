import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowRightLeft, Warehouse, Flame, X, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, StatPill, ErrorBanner } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'

import { SORT_COLORS } from '@/lib/sortColors'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'
import { ColorCombobox } from '@/components/ui/color-combobox'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Button } from '@/components/ui/button'
import CustomTable1 from '@/components/CustomTable1'

const STAGE_META: Record<
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

type FormValues = {
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

type InputBatch = {
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

type ColorLine = { color: string; qtyKg: number }
type ColorLot = { batchNumber: string; color: string; qtyKg: number }

function colorName(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

function formatBusinessDate(raw?: string | null) {
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

function formatCreatedAt(raw?: string) {
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

function qtyLabel(value: string | number | undefined, uom: string) {
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
              ).toFixed(2)
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

  // When on drying or recrushing stage, fetch completed batches waiting for handover
  const pendingHandoverQuery = useQuery({
    queryKey: ['pending-handover-lots'],
    queryFn: async () => {
      const { data } = await api.get('/production/store/pending')
      return (data.data || []) as InputBatch[]
    },
    enabled: stage === 'drying',
  })

  const [transferringBatch, setTransferringBatch] = useState<string | null>(null)
  const [handoverFeedback, setHandoverFeedback] = useState<string | null>(null)

  const handleTransferBatch = async (batchNumber: string) => {
    setTransferringBatch(batchNumber)
    setHandoverFeedback(null)
    try {
      await api.post('/production/store/transfer', { batchNumber })
      await queryClient.invalidateQueries({ queryKey: ['drying-completed-lots'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store-pending'] })
      await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
      setHandoverFeedback(`Batch ${batchNumber} transferred to Production Store!`)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; message?: string } } }
      alert(axiosErr.response?.data?.err || axiosErr.response?.data?.message || 'Failed to transfer batch to Production Store')
    } finally {
      setTransferringBatch(null)
    }
  }

  const { register, handleSubmit, watch, setValue, formState, reset } = useForm<FormValues>({
    defaultValues: emptyForm(activeBatch || ''),
  })

  // Reset when stage changes; keep ?batch= if present for this stage.
  useEffect(() => {
    const fromUrl = searchParams.get('batch') || presetBatchNumber || null
    setActiveBatch(fromUrl)
    setSuccessBatch(null)
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
    setServerErrors([])
    setWarning(null)
    setColorLines([])
    setPickColor('')
    setPickKg('')
    reset(emptyForm(batchNumber))
    setSearchParams({ batch: batchNumber }, { replace: true })
  }

  const backToQueue = () => {
    setActiveBatch(null)
    setSuccessBatch(null)
    setColorLots([])
    setScrapTicket(null)
    setServerErrors([])
    setWarning(null)
    setColorLines([])
    reset(emptyForm())
    setSearchParams({}, { replace: true })
    queryClient.invalidateQueries({ queryKey: ['process-inputs', stage] })
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


  // Build columns for the queue CustomTable1
  const queueColumns = useMemo((): ColumnDef<InputBatch>[] => [
    {
      accessorKey: 'batchNumber',
      header: 'Batch',
      cell: ({ row }) => (
        <div>
          <p className="font-semibold tracking-tight text-sm">{row.original.batchNumber}</p>
          <p className="mt-0.5 text-xs text-[var(--ink-faint)]">{row.original.batchType}</p>
        </div>
      ),
    },
    ...(!isSorting ? [{
      accessorKey: 'sortColor',
      header: 'Colour',
      cell: ({ row }: { row: { original: InputBatch } }) => (
        <span className="text-sm text-[var(--ink-muted)]">{colorName(row.original.sortColor)}</span>
      ),
    }] : []),
    {
      accessorFn: (row) => row.material?.name ?? '',
      id: 'material',
      header: 'Material',
      cell: ({ row }) => <span className="text-sm">{row.original.material?.name || '—'}</span>,
    },
    {
      accessorKey: 'qtyRemaining',
      header: 'Available',
      cell: ({ row }) => (
        <span className="text-sm font-medium tabular-nums">
          {qtyLabel(row.original.qtyRemaining, row.original.uom)}
        </span>
      ),
    },
    {
      accessorFn: (row) => row.location?.name ?? '',
      id: 'location',
      header: 'Location',
      cell: ({ row }) => <span className="text-sm text-[var(--ink-muted)]">{row.original.location?.name || '—'}</span>,
    },
    {
      accessorKey: 'businessDate',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-[var(--ink-muted)]">
          {formatBusinessDate(row.original.businessDate) || formatCreatedAt(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <Link to={`/batches/${row.original.batchNumber}`}>
              View
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              openBatch(row.original.batchNumber)
            }}
          >
            Process
          </Button>
        </div>
      ),
    },
  ], [isSorting, openBatch]) // eslint-disable-line react-hooks/exhaustive-deps

  const addColorLine = () => {
    setServerErrors([])
    const color = pickColor
    const qtyKg = Number(pickKg)
    if (!color) {
      setServerErrors([{ label: 'Colour', message: 'Select a colour before adding.' }])
      return
    }
    if (!(qtyKg > 0)) {
      setServerErrors([
        { label: 'Kg', message: 'Enter a weight greater than zero for this colour.' },
      ])
      return
    }
    if (!(qtyInput > 0)) {
      setServerErrors([
        {
          label: 'Scrap ticket',
          message: 'Choose a scrap ticket first so available kg is known.',
        },
      ])
      return
    }
    if (colorLines.some((line) => line.color === color)) {
      setServerErrors([
        {
          label: 'Colour',
          message: `${colorName(color)} is already on the list. Remove it first if you need to change the kg.`,
        },
      ])
      return
    }
    const nextTotal = +(colorUsable + qtyKg).toFixed(3)
    if (nextTotal - qtyInput > 0.001) {
      setServerErrors([
        {
          label: 'Colours',
          message: `Adding ${qtyKg} kg would make colours ${nextTotal} kg, which is over the scrap ticket (${qtyInput} kg). Only ${colorRoomLeft} kg left.`,
        },
      ])
      return
    }
    setColorLines((prev) => [...prev, { color, qtyKg: +qtyKg.toFixed(3) }])
    setPickColor('')
    setPickKg('')
  }

  const saveEditColorLine = (color: string) => {
    const qtyKg = Number(editingKg)
    if (!(qtyKg > 0)) {
      setEditingColor(null)
      setEditingKg('')
      return
    }
    // Calculate total excluding the line being edited
    const othersTotal = +colorLines
      .filter((l) => l.color !== color)
      .reduce((s, l) => s + l.qtyKg, 0)
      .toFixed(3)
    if (othersTotal + qtyKg - qtyInput > 0.001) {
      setServerErrors([
        {
          label: 'Colours',
          message: `${qtyKg} kg would bring total to ${+(othersTotal + qtyKg).toFixed(3)} kg, over the lot (${qtyInput} kg).`,
        },
      ])
      return
    }
    setColorLines((prev) =>
      prev.map((l) => (l.color === color ? { ...l, qtyKg: +qtyKg.toFixed(3) } : l)),
    )
    setEditingColor(null)
    setEditingKg('')
  }

  const removeColorLine = (color: string) => {
    setColorLines((prev) => prev.filter((line) => line.color !== color))
  }

  const submitPayload = async (values: FormValues, confirmUnusualYield = false) => {
    setServerErrors([])
    setWarning(null)

    if (isColorAllocation) {
      if (!colorLines.length) {
        setServerErrors([
          {
            label: 'Colours',
            message: 'Add at least one colour with kg. Each colour becomes its own BAT- lot for washing.',
          },
        ])
        return
      }
      if (colorsOverLot) {
        setServerErrors([
          {
            label: 'Colours',
            message: `Colour total is ${colorUsable} kg but the input batch is only ${qtyInput} kg (over by ${(colorUsable - qtyInput).toFixed(3)} kg).`,
          },
        ])
        return
      }
      if (!values.inputBatchNumber) {
        setServerErrors([
          { label: 'Input batch', message: 'Select the batch you are processing.' },
        ])
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
        return
      }
      if (measured - inbound > 0.001) {
        setServerErrors([
          {
            label: 'Measured after crushing',
            message: `Measured (${measured} kg) cannot be more than qty in (${inbound} kg).`,
          },
        ])
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
        return
      }
      if (measured - inbound > 0.001) {
        setServerErrors([
          {
            label: `Measured after ${stageName}`,
            message: `Measured (${measured} kg) cannot be more than qty in (${inbound} kg).`,
          },
        ])
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
      if (Array.isArray(data.colorLots) && data.colorLots.length > 0) {
        setColorLots(data.colorLots)
        setScrapTicket(data.scrapTicket || values.inputBatchNumber)
      }
      setSuccessBatch(data.batchNumber)
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
    }
  }

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
    return (
      <PageLayout
        title={meta.title}
        description={hasLots ? 'Colour lots created' : `${meta.title} saved`}
      >
        <Card className="text-center !p-4">
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
            <p className="mt-2 text-2xl font-semibold tracking-tight">{successBatch}</p>
          )}
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            {next && (
              <button
                type="button"
                className="dgn-btn dgn-btn-primary"
                onClick={() => navigate(`/process/${next}`)}
              >
                Next: {STAGE_META[next]?.title}
              </button>
            )}
            {stage === 'drying' && successBatch && (
              <button
                type="button"
                className="dgn-btn dgn-btn-primary flex items-center justify-center gap-1.5"
                onClick={async () => {
                  try {
                    await api.post('/production/store/transfer', { batchNumber: successBatch })
                    await queryClient.invalidateQueries({ queryKey: ['production-store'] })
                    await queryClient.invalidateQueries({ queryKey: ['pending-handover-lots'] })
                    navigate('/production/store')
                  } catch (e) {
                    console.error(e)
                  }
                }}
              >
                <Warehouse className="size-4" />
                Transfer to Production Store Now
              </button>
            )}
            {!isSorting && (
              <button
                type="button"
                className="dgn-btn dgn-btn-secondary"
                onClick={() => navigate(`/batches/${successBatch}`)}
              >
                Batch 360°
              </button>
            )}
            <button type="button" className="dgn-btn dgn-btn-secondary" onClick={backToQueue}>
              Back to queue
            </button>
          </div>
        </Card>
      </PageLayout>
    )
  }

  // ——— Queue: pick a batch first ———
  if (!activeBatch) {
    return (
      <PageLayout
        title={meta.title}
        description={meta.queueTitle}
      >
        <div className="space-y-4">
          <CustomTable1
            data={inputs.data || []}
            columns={queueColumns}
            filter={true}
            loading={inputs.isLoading}
          />

        {/* If drying stage: show completed batches waiting for handover */}
        {stage === 'drying' && (
          <Card className="mt-4 !p-0 overflow-hidden">
            <div className="p-3.5 bg-amber-50/70 border-b border-amber-200/80 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Flame className="size-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-950">
                    Completed Batches Waiting for Handover to Production Store
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    These materials stay in processing until transferred to the Production Store. Click <strong>Transfer to Production</strong> to hand over.
                  </p>
                </div>
              </div>
              <Link
                to="/production/store"
                className="text-xs font-semibold text-[var(--accent-strong)] hover:underline shrink-0 flex items-center gap-1"
              >
                <Warehouse className="size-3.5" />
                Production Store →
              </Link>
            </div>

            {handoverFeedback && (
              <div className="p-2.5 bg-emerald-50 text-xs font-medium text-emerald-800 border-b border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>{handoverFeedback}</span>
                </div>
                <button type="button" onClick={() => setHandoverFeedback(null)}>
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Batch Number</th>
                    <th className="py-2.5 px-3">Colour</th>
                    <th className="py-2.5 px-3">Material</th>
                    <th className="py-2.5 px-3 text-right">Available</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3 text-right">Handover Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {pendingHandoverQuery.isLoading && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        Checking processing area for completed batches…
                      </td>
                    </tr>
                  )}
                  {!pendingHandoverQuery.isLoading && (pendingHandoverQuery.data || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        No batches currently waiting in processing area. All batches have been handed over to Production Store.
                      </td>
                    </tr>
                  )}
                  {!pendingHandoverQuery.isLoading &&
                    (pendingHandoverQuery.data || []).map((b) => (
                      <tr key={b.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="py-2 px-3 font-semibold text-zinc-900">
                          <Link to={`/batches/${b.batchNumber}`} className="text-[var(--accent-strong)] hover:underline">
                            {b.batchNumber}
                          </Link>
                        </td>
                        <td className="py-2 px-3 text-zinc-700">{colorName(b.sortColor)}</td>
                        <td className="py-2 px-3 text-zinc-700">{b.material?.name || '—'}</td>
                        <td className="py-2 px-3 text-right font-bold text-amber-900">
                          {qtyLabel(b.qtyRemaining, b.uom)}
                        </td>
                        <td className="py-2 px-3 text-zinc-500">{b.location?.name || 'Processing Area'}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            disabled={transferringBatch === b.batchNumber}
                            className="dgn-btn dgn-btn-primary text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
                            onClick={() => handleTransferBatch(b.batchNumber)}
                          >
                            <ArrowRightLeft className="size-3" />
                            {transferringBatch === b.batchNumber ? 'Transferring…' : 'Transfer to Production'}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        </div>
      </PageLayout>
    )
  }

  // ——— Form: process the chosen batch ———
  return (
    <PageLayout
      title={`${meta.title}: ${selected?.batchNumber || activeBatch}`}
      description={selected ? `${selected.material?.name || selected.batchType} · ${qtyLabel(selected.qtyRemaining, selected.uom)} available` : 'Batch processing'}
      back={true}
      backLabel="Back to queue"
      onBack={backToQueue}
    >
      <div className="space-y-4">

      {!selected && !inputs.isLoading && (
        <Card className="mb-4 border-amber-200 bg-amber-50 text-amber-950 !p-4">
          <p className="text-sm">
            {activeBatch} is not in this stage queue anymore (already processed or moved).
          </p>
          <button type="button" className="dgn-btn dgn-btn-secondary mt-3" onClick={backToQueue}>
            Choose another batch
          </button>
        </Card>
      )}

      {selected && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-strong)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"></span>
            {selected.qtyRemaining} {selected.uom} available
          </span>
          {selected.sortColor && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">
              {colorName(selected.sortColor)}
            </span>
          )}
          {selected.location?.name && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500">
              {selected.location.name}
            </span>
          )}
        </div>
      )}

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
              {isCrushing && qtyInput > 0 && (
                <span className="text-xs text-[var(--ink-muted)]">
                  {colorRoomLeft > 0.001
                    ? `${colorRoomLeft.toFixed(3)} kg left`
                    : <span className="font-semibold text-emerald-600">Fully allocated ✓</span>}
                </span>
              )}
            </div>

            {/* Stats strip */}
            {isCrushing && qtyInput > 0 && (
              <div className="mt-3 grid divide-x divide-zinc-100 rounded-xl border border-zinc-100 bg-zinc-50"
                style={{ gridTemplateColumns: batchDetail.data?.pricePerKg ? 'repeat(4, 1fr)' : 'repeat(4, 1fr)' }}
              >
                {/* <div className="py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Total</p>
                  <p className="mt-0.5 text-sm font-bold text-zinc-800">{qtyInput} kg</p>
                </div> */}
                <div className="py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Allocated</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-600">{colorUsable.toFixed(3)} kg</p>
                </div>
                <div className="py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Remaining</p>
                  <p className={`mt-0.5 text-sm font-bold ${colorRoomLeft > 0.001 ? 'text-amber-600' : 'text-zinc-400'}`}>
                    {colorRoomLeft.toFixed(3)} kg
                  </p>
                </div>
                <div className="py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Waste</p>
                  <p className="mt-0.5 text-sm font-bold text-zinc-600">{qtyInput > 0 ? qtyReject.toFixed(3) : '—'} kg</p>
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
                <label className="mb-1 block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">Colour</label>
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
                  {colorRoomLeft > 0.001 && <span className="ml-1 font-normal normal-case text-zinc-400">(max {colorRoomLeft.toFixed(3)})</span>}
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
                  <li
                    key={line.color}
                    className="flex items-center gap-3 px-4 py-3"
                  >
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
                            if (e.key === 'Enter') { e.preventDefault(); saveEditColorLine(line.color) }
                            if (e.key === 'Escape') { setEditingColor(null); setEditingKg('') }
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
                          onClick={() => { setEditingColor(null); setEditingKg('') }}
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
                          onClick={() => { setEditingColor(line.color); setEditingKg(String(line.qtyKg)) }}
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

            {/* Waste display — only show when there's something to show */}
            {qtyInput > 0 && colorLines.length > 0 && qtyReject > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Waste / Reject</span>
                <span className="font-mono text-sm font-bold text-amber-800">{qtyReject.toFixed(3)} kg</span>
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
                  onChange={(val) => setValue('machineName', val, { shouldValidate: true, shouldDirty: true })}
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
                  onChange={(val) => setValue('operatorName', val, { shouldValidate: true, shouldDirty: true })}
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
                  <input inputMode="decimal" className="dgn-input" {...register('detergentCost')} />
                </Field>
              </>
            )}
            {meta.showDryFields && (
              <Field label="Moisture %">
                <input inputMode="decimal" className="dgn-input" {...register('moistureReading')} />
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
      </form>
      </div>
    </PageLayout>
  )
}

export function ProcessStagePage() {
  const { stage = 'sorting' } = useParams()
  return <ProcessStageForm stage={stage} />
}
