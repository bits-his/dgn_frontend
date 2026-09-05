import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRightLeft, Warehouse, Flame, X, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill, ErrorBanner } from '@/components/ui'
import { SORT_COLORS } from '@/lib/sortColors'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'

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
    showDowntime: false,
    showLabourCost: false,
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
  /** Crushing / drying: weigh after the stage; washing/sorting use waste where applicable. */
  const showsMeasuredOut = isCrushing || isDrying
  const showsWaste = isSorting || isWashing
  const meta = STAGE_META[stage] || STAGE_META.sorting
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeBatch, setActiveBatch] = useState<string | null>(
    () => presetBatchNumber || searchParams.get('batch') || null,
  )
  const [queueFilter, setQueueFilter] = useState('')
  const [serverErrors, setServerErrors] = useState<ErrorItem[]>([])
  const [warning, setWarning] = useState<{ yieldPercent: number } | null>(null)
  const [successBatch, setSuccessBatch] = useState<string | null>(null)
  const [colorLots, setColorLots] = useState<ColorLot[]>([])
  const [scrapTicket, setScrapTicket] = useState<string | null>(null)
  const [colorLines, setColorLines] = useState<ColorLine[]>([])
  const [pickColor, setPickColor] = useState('')
  const [pickKg, setPickKg] = useState('')

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

  // When on drying stage, fetch completed dry batches waiting in Drying Area
  const dryingCompletedQuery = useQuery({
    queryKey: ['drying-completed-lots'],
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
    setQueueFilter('')
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

  const qtyInput = Number(watch('qtyInput') || 0)
  const qtyWaste = Number(watch('qtyWaste') || 0)
  const colorUsable = useMemo(
    () => +colorLines.reduce((sum, line) => sum + line.qtyKg, 0).toFixed(3),
    [colorLines],
  )
  const qtyUsable = isSorting ? colorUsable : Number(watch('qtyUsable') || 0)

  const qtyReject = showsWaste
    ? isSorting
      ? Math.max(0, +(qtyInput - colorUsable).toFixed(3))
      : Math.max(0, +(qtyInput - qtyUsable - qtyWaste).toFixed(3))
    : 0
  const measuredShrink = showsMeasuredOut
    ? Math.max(0, +(qtyInput - qtyUsable).toFixed(3))
    : 0
  const measuredOverIn = showsMeasuredOut && qtyUsable - qtyInput > 0.001

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

  const availableColors = SORT_COLORS.filter(
    (c) => !colorLines.some((line) => line.color === c.code),
  )

  const filteredQueue = useMemo(() => {
    const rows = inputs.data || []
    const q = queueFilter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((b) => {
      const hay = [
        b.batchNumber,
        b.material?.name,
        b.location?.name,
        b.sortColor,
        colorName(b.sortColor),
        b.batchType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [inputs.data, queueFilter])

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

  const removeColorLine = (color: string) => {
    setColorLines((prev) => prev.filter((line) => line.color !== color))
  }

  const submitPayload = async (values: FormValues, confirmUnusualYield = false) => {
    setServerErrors([])
    setWarning(null)

    if (isSorting) {
      if (!colorLines.length) {
        setServerErrors([
          {
            label: 'Colours',
            message: 'Add at least one colour with kg. Each colour becomes its own BAT- lot.',
          },
        ])
        return
      }
      if (colorsOverLot) {
        setServerErrors([
          {
            label: 'Colours',
            message: `Colour total is ${qtyUsable} kg but the scrap ticket is only ${qtyInput} kg (over by ${(qtyUsable - qtyInput).toFixed(3)} kg).`,
          },
        ])
        return
      }
      if (!values.inputBatchNumber) {
        setServerErrors([
          { label: 'Scrap ticket', message: 'Select the SCR- scrap ticket you are sorting.' },
        ])
        return
      }
    }

    if (isCrushing) {
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

    if (isDrying) {
      const measured = Number(values.qtyUsable)
      const inbound = Number(values.qtyInput)
      if (!(measured > 0)) {
        setServerErrors([
          {
            label: 'Measured after drying',
            message: 'Enter the measured kg after drying.',
          },
        ])
        return
      }
      if (measured - inbound > 0.001) {
        setServerErrors([
          {
            label: 'Measured after drying',
            message: `Measured (${measured} kg) cannot be more than qty in (${inbound} kg).`,
          },
        ])
        return
      }
    }

    try {
      const { data } = await api.post(`/process/${stage}`, {
        ...values,
        inputBatchNumber: activeBatch || values.inputBatchNumber,
        qtyInput: Number(values.qtyInput),
        qtyUsable: isSorting ? qtyUsable : Number(values.qtyUsable),
        qtyReject: showsWaste ? qtyReject : 0,
        qtyWaste: 0,
        colorLines: isSorting ? colorLines : undefined,
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
      if (isSorting && Array.isArray(data.colorLots)) {
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
      drying: null,
    }
    const next = nextMap[stage]
    return (
      <div>
        <PageHeader eyebrow={meta.eyebrow} title={meta.title} />
        <Card className="text-center !p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            {isSorting ? 'Colour lots issued' : `${meta.title} saved`}
          </p>
          {isSorting && colorLots.length > 0 ? (
            <>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                Sorted from scrap {scrapTicket}. Each colour now has its own BAT- number for the
                rest of the line.
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
                    await queryClient.invalidateQueries({ queryKey: ['production-store-pending'] })
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
      </div>
    )
  }

  // ——— Queue: pick a batch first ———
  if (!activeBatch) {
    return (
      <div>
        <PageHeader eyebrow={meta.eyebrow} title={meta.title} />

        <Card className="mb-4 !p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{meta.queueTitle}</h2>
              <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                Click a row to open the {meta.title.toLowerCase()} form for that batch.
              </p>
            </div>
            <label className="block sm:w-64">
              <span className="dgn-label">Filter</span>
              <input
                className="dgn-input"
                value={queueFilter}
                onChange={(e) => setQueueFilter(e.target.value)}
                placeholder="Batch, colour, material…"
              />
            </label>
          </div>
        </Card>

        <Card className="!overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  {!isSorting && <th className="px-3 py-3 font-semibold">Colour</th>}
                  <th className="px-3 py-3 font-semibold">Material</th>
                  <th className="px-3 py-3 font-semibold text-right">Available</th>
                  <th className="px-3 py-3 font-semibold">Location</th>
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {inputs.isLoading && (
                  <tr>
                    <td
                      colSpan={isSorting ? 6 : 7}
                      className="px-4 py-10 text-center text-[var(--ink-muted)]"
                    >
                      Loading queue…
                    </td>
                  </tr>
                )}
                {!inputs.isLoading &&
                  filteredQueue.map((batch) => {
                    const biz = formatBusinessDate(batch.businessDate)
                    return (
                      <tr
                        key={batch.id}
                        className="cursor-pointer border-b border-[var(--line)] transition hover:bg-[var(--accent-soft)]/40"
                        onClick={() => openBatch(batch.batchNumber)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold tracking-tight">{batch.batchNumber}</p>
                          <p className="mt-0.5 text-xs text-[var(--ink-faint)]">{batch.batchType}</p>
                        </td>
                        {!isSorting && (
                          <td className="px-3 py-3 text-[var(--ink-muted)]">
                            {colorName(batch.sortColor)}
                          </td>
                        )}
                        <td className="px-3 py-3">{batch.material?.name || '—'}</td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">
                          {qtyLabel(batch.qtyRemaining, batch.uom)}
                        </td>
                        <td className="px-3 py-3 text-[var(--ink-muted)]">
                          {batch.location?.name || '—'}
                        </td>
                        <td className="px-3 py-3 text-[var(--ink-muted)] tabular-nums">
                          {biz || formatCreatedAt(batch.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            className="text-sm font-semibold text-[var(--accent-strong)] hover:underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              openBatch(batch.batchNumber)
                            }}
                          >
                            Process
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                {!inputs.isLoading && filteredQueue.length === 0 && (
                  <tr>
                    <td
                      colSpan={isSorting ? 6 : 7}
                      className="px-4 py-10 text-center text-[var(--ink-muted)]"
                    >
                      {queueFilter.trim()
                        ? 'No batches match that filter.'
                        : meta.emptyHint}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* If drying stage: show completed dry batches in Drying Area waiting for handover */}
        {stage === 'drying' && (
          <Card className="mt-4 !p-0 overflow-hidden">
            <div className="p-3.5 bg-amber-50/70 border-b border-amber-200/80 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Flame className="size-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-950">
                    Completed Dried Batches in Drying Area (Waiting for Handover)
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    These materials stay in the Drying Area until transferred to the Production Store. Click <strong>Transfer to Production</strong> to hand over.
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
                  {dryingCompletedQuery.isLoading && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        Checking drying area for completed batches…
                      </td>
                    </tr>
                  )}
                  {!dryingCompletedQuery.isLoading && (dryingCompletedQuery.data || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        No dried batches currently waiting in Drying Area. All batches have been handed over to Production Store.
                      </td>
                    </tr>
                  )}
                  {!dryingCompletedQuery.isLoading &&
                    (dryingCompletedQuery.data || []).map((b) => (
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
                        <td className="py-2 px-3 text-zinc-500">{b.location?.name || 'Drying Area'}</td>
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
    )
  }

  // ——— Form: process the chosen batch ———
  return (
    <div>
      <PageHeader eyebrow={meta.eyebrow} title={meta.title} />

      <button
        type="button"
        onClick={backToQueue}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-strong)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to queue
      </button>

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
        <Card className="mb-4 !p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                Processing
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{selected.batchNumber}</p>
              <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                {selected.material?.name || selected.batchType}
                {selected.sortColor ? ` · ${colorName(selected.sortColor)}` : ''}
                {selected.location?.name ? ` · ${selected.location.name}` : ''}
              </p>
            </div>
            <StatPill
              label="Available"
              value={`${selected.qtyRemaining} ${selected.uom}`}
              tone="accent"
            />
          </div>
        </Card>
      )}

      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => submitPayload(values, false))}
      >
        <input type="hidden" {...register('inputBatchNumber', { required: true })} />

        {isSorting ? (
          <Card>
            <h2 className="text-lg font-semibold tracking-tight">Colours → new lots</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Each colour becomes its own BAT- lot. Waste is whatever is left on the scrap ticket.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr_auto]">
              <Field label="Colour">
                <select
                  className="dgn-input"
                  value={pickColor}
                  onChange={(e) => setPickColor(e.target.value)}
                >
                  <option value="">Select colour</option>
                  {availableColors.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Kg"
                hint={qtyInput > 0 ? `Left in lot: ${colorRoomLeft} kg` : undefined}
              >
                <input
                  inputMode="decimal"
                  className="dgn-input"
                  value={pickKg}
                  max={colorRoomLeft > 0 ? colorRoomLeft : undefined}
                  onChange={(e) => setPickKg(e.target.value)}
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  className="dgn-btn dgn-btn-secondary w-full"
                  disabled={!(qtyInput > 0) || colorRoomLeft <= 0}
                  onClick={addColorLine}
                >
                  Add colour
                </button>
              </div>
            </div>

            {colorLines.length > 0 && (
              <ul className="mt-4 divide-y divide-[var(--line)] rounded-xl ring-1 ring-[var(--line)]">
                {colorLines.map((line) => (
                  <li
                    key={line.color}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{colorName(line.color)}</span>
                    <span className="text-[var(--ink-muted)]">
                      {line.qtyKg.toLocaleString()} kg
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-700"
                      onClick={() => removeColorLine(line.color)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Qty in (kg)">
                <input
                  className="dgn-input bg-[var(--bg)] text-[var(--ink-muted)]"
                  value={qtyInput > 0 ? String(qtyInput) : ''}
                  readOnly
                  tabIndex={-1}
                />
              </Field>
              <Field label="Waste (kg)" hint="Available − colours">
                <input
                  className="dgn-input bg-[var(--bg)] text-[var(--ink-muted)]"
                  value={qtyInput > 0 ? String(qtyReject) : ''}
                  readOnly
                  tabIndex={-1}
                />
              </Field>
            </div>
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
              <Field label="Machine">
                <select className="dgn-input" {...register('machineName')}>
                  <option value="">Select machine</option>
                  {(machines.data || []).map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                      {m.code ? ` (${m.code})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {meta.showOperator !== false && (
              <Field label="Operator">
                <select className="dgn-input" {...register('operatorName')}>
                  <option value="">Select staff</option>
                  {(staff.data || []).map((e) => {
                    const name =
                      `${e.firstname || ''} ${e.lastname || ''}`.trim() ||
                      e.employeeCode ||
                      `Staff ${e.id}`
                    return (
                      <option key={e.id} value={name}>
                        {name}
                        {e.employeeCode ? ` (${e.employeeCode})` : ''}
                      </option>
                    )
                  })}
                </select>
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
                <Field label="Chemical cost (₦)">
                  <input inputMode="decimal" className="dgn-input" {...register('chemicalCost')} />
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
            (isSorting && (colorsOverLot || !colorLines.length)) ||
            (isCrushing && (!(qtyUsable > 0) || measuredOverIn)) ||
            (isDrying && (!(qtyUsable > 0) || measuredOverIn))
          }
          className="dgn-btn dgn-btn-primary w-full sm:w-auto"
        >
          {formState.isSubmitting ? 'Saving…' : `Save ${meta.title.toLowerCase()}`}
        </button>
      </form>
    </div>
  )
}

export function ProcessStagePage() {
  const { stage = 'sorting' } = useParams()
  return <ProcessStageForm stage={stage} />
}
