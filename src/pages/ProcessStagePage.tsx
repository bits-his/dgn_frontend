import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill, ErrorBanner } from '@/components/ui'
import { SORT_COLORS } from '@/lib/sortColors'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'

const STAGE_META: Record<
  string,
  {
    title: string
    eyebrow: string
    description: string
    inputLabel: string
    inputPlaceholder: string
    showWashFields?: boolean
    showDryFields?: boolean
    showMachine?: boolean
    showTeam?: boolean
  }
> = {
  sorting: {
    title: 'Sorting',
    eyebrow: 'Recycling stage',
    description:
      'Pick a scrap ticket only. Split by colour — each colour gets its own BAT- lot for the next stages.',
    inputLabel: 'Scrap ticket',
    inputPlaceholder: 'Choose scrap ticket (SCR-…)',
    showTeam: true,
  },
  crushing: {
    title: 'Crushing',
    eyebrow: 'Recycling stage',
    description:
      'Only sorted colour lots appear here. Crush one BAT- lot; the same number stays with this colour.',
    inputLabel: 'Sorted lot',
    inputPlaceholder: 'Choose sorted lot (BAT-…)',
    showMachine: true,
    showTeam: true,
  },
  washing: {
    title: 'Washing',
    eyebrow: 'Recycling stage',
    description:
      'Only crushed lots appear here (from crushing, or scrap bought already crushed). Same BAT- number.',
    inputLabel: 'Crushed lot',
    inputPlaceholder: 'Choose crushed lot (BAT-…)',
    showWashFields: true,
    showMachine: true,
    showTeam: false,
  },
  drying: {
    title: 'Drying',
    eyebrow: 'Recycling stage',
    description: 'Only washed lots appear here. Dry ready for production — same BAT- number.',
    inputLabel: 'Washed lot',
    inputPlaceholder: 'Choose washed lot (BAT-…)',
    showDryFields: true,
    showMachine: true,
    showTeam: true,
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
  uom: string
  sortColor?: string | null
  material?: { name: string }
}

type ColorLine = { color: string; qtyKg: number }
type ColorLot = { batchNumber: string; color: string; qtyKg: number }

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
  const meta = STAGE_META[stage] || STAGE_META.sorting
  const navigate = useNavigate()
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
  })

  const inputs = useQuery({
    queryKey: ['process-inputs', stage],
    queryFn: async () => {
      const { data } = await api.get(`/process/${stage}/inputs`)
      return data.data as InputBatch[]
    },
  })

  const { register, handleSubmit, watch, setValue, formState, reset } = useForm<FormValues>({
    defaultValues: {
      inputBatchNumber: presetBatchNumber,
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
    },
  })

  useEffect(() => {
    setSuccessBatch(null)
    setColorLots([])
    setScrapTicket(null)
    setServerErrors([])
    setWarning(null)
    setColorLines([])
    setPickColor('')
    setPickKg('')
    reset({
      inputBatchNumber: presetBatchNumber,
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
  }, [stage, presetBatchNumber, reset])

  const selectedNumber = watch('inputBatchNumber')
  const selected = inputs.data?.find((b) => b.batchNumber === selectedNumber)

  useEffect(() => {
    if (selected) {
      setValue('qtyInput', String(selected.qtyRemaining))
    }
  }, [selected, setValue])

  const qtyInput = Number(watch('qtyInput') || 0)
  const qtyWaste = Number(watch('qtyWaste') || 0)
  const colorUsable = useMemo(
    () => +colorLines.reduce((sum, line) => sum + line.qtyKg, 0).toFixed(3),
    [colorLines],
  )
  const qtyUsable = isSorting ? colorUsable : Number(watch('qtyUsable') || 0)
  // Sorting: reject = available − colours. Wash/crush/dry: reject = qty in − usable out.
  const qtyReject = isSorting
    ? Math.max(0, +(qtyInput - colorUsable).toFixed(3))
    : Math.max(0, +(qtyInput - qtyUsable - qtyWaste).toFixed(3))

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

  const colorName = (code: string) =>
    SORT_COLORS.find((c) => c.code === code)?.name || code

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
        {
          label: 'Kg',
          message: 'Enter a weight greater than zero for this colour.',
        },
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

    try {
      const { data } = await api.post(`/process/${stage}`, {
        ...values,
        qtyInput: Number(values.qtyInput),
        qtyUsable: isSorting ? qtyUsable : Number(values.qtyUsable),
        qtyReject: qtyReject,
        qtyWaste: isSorting || isWashing ? 0 : Number(values.qtyWaste || 0),
        colorLines: isSorting ? colorLines : undefined,
        labourCost: Number(values.labourCost || 0),
        energyCost: Number(values.energyCost || 0),
        waterQty: Number(values.waterQty || 0),
        chemicalCost: Number(values.chemicalCost || 0),
        detergentCost: Number(values.detergentCost || 0),
        moistureReading: values.moistureReading === '' ? null : Number(values.moistureReading),
        downtimeMinutes: Number(values.downtimeMinutes || 0),
        teamName: meta.showTeam ? values.teamName : undefined,
        confirmUnusualYield,
      })
      if (isSorting && Array.isArray(data.colorLots)) {
        setColorLots(data.colorLots)
        setScrapTicket(data.scrapTicket || values.inputBatchNumber)
      }
      setSuccessBatch(data.batchNumber)
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
                <li key={lot.batchNumber} className="flex items-center justify-between gap-3 px-4 py-3">
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
          {!isSorting && (
            <button
              type="button"
              className="dgn-btn dgn-btn-secondary"
              onClick={() => navigate(`/batches/${successBatch}`)}
            >
              Batch 360°
            </button>
          )}
          <button
            type="button"
            className="dgn-btn dgn-btn-secondary"
            onClick={() => {
              setSuccessBatch(null)
              setColorLots([])
              setScrapTicket(null)
            }}
          >
            Another run
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader eyebrow={meta.eyebrow} title={meta.title} description={meta.description} />

      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => submitPayload(values, false))}
      >
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Input batch</h2>
          <div className="mt-4 grid gap-4">
            <Field label={meta.inputLabel}>
              <select className="dgn-input" {...register('inputBatchNumber', { required: true })}>
                <option value="">{meta.inputPlaceholder}</option>
                {inputs.data?.map((b) => (
                  <option key={b.id} value={b.batchNumber}>
                    {b.batchNumber}
                    {b.sortColor ? ` · ${colorName(b.sortColor)}` : ''}
                    {' · '}
                    {b.material?.name || b.batchType} · {b.qtyRemaining} {b.uom}
                  </option>
                ))}
              </select>
            </Field>
            {inputs.isSuccess && !(inputs.data && inputs.data.length) && (
              <p className="text-sm text-[var(--ink-muted)]">
                No lots waiting for this stage. Finish the previous stage first
                {isSorting ? ' (buy raw scrap)' : ''}.
              </p>
            )}
            {selected && (
              <div className="grid gap-2 sm:grid-cols-3">
                <StatPill label="Available" value={`${selected.qtyRemaining} ${selected.uom}`} />
                <StatPill
                  label={selected.sortColor ? 'Colour' : 'Type'}
                  value={selected.sortColor ? colorName(selected.sortColor) : selected.batchType}
                  tone="accent"
                />
                <StatPill label="Material" value={selected.material?.name || '—'} />
              </div>
            )}
          </div>
        </Card>

        {isSorting ? (
          <>
            <Card>
              <h2 className="text-lg font-semibold tracking-tight">Colours → new lots</h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                Each colour becomes its own BAT- lot. Reject is whatever is left on the scrap
                ticket.
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
                      <span className="text-[var(--ink-muted)]">{line.qtyKg.toLocaleString()} kg</span>
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
                <Field label="Reject (kg)" hint="Available − colours">
                  <input
                    className="dgn-input bg-[var(--bg)] text-[var(--ink-muted)]"
                    value={qtyInput > 0 ? String(qtyReject) : ''}
                    readOnly
                    tabIndex={-1}
                  />
                </Field>
              </div>
            </Card>
          </>
        ) : (
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Qty in (kg)">
                <input
                  inputMode="decimal"
                  className="dgn-input"
                  {...register('qtyInput', { required: true })}
                />
              </Field>
              <Field label="Usable out (kg)">
                <input
                  inputMode="decimal"
                  className="dgn-input"
                  {...register('qtyUsable', { required: true })}
                />
              </Field>
              <Field label="Reject (kg)" hint="Qty in − usable out">
                <input
                  className="dgn-input bg-[var(--bg)] text-[var(--ink-muted)]"
                  value={qtyInput > 0 || qtyUsable > 0 ? String(qtyReject) : ''}
                  readOnly
                  tabIndex={-1}
                />
              </Field>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <StatPill label="Yield" value={`${yieldPercent}%`} tone="success" />
              <StatPill
                label="Accounted"
                value={`${+(qtyUsable + qtyReject).toFixed(3)} / ${qtyInput || 0} kg`}
              />
            </div>
          </Card>
        )}

        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meta.showMachine && (
              <Field label="Machine">
                <input className="dgn-input" {...register('machineName')} />
              </Field>
            )}
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
            {meta.showTeam !== false && (
              <Field label="Team">
                <input className="dgn-input" {...register('teamName')} />
              </Field>
            )}
            <Field label="Labour cost (₦)">
              <input inputMode="decimal" className="dgn-input" {...register('labourCost')} />
            </Field>
            {isWashing ? (
              <Field
                label="Energy (kWh)"
                hint="Electricity used — kilowatt-hours (kWh). 1 kWh = 1000 W for 1 hour."
              >
                <input inputMode="decimal" className="dgn-input" {...register('energyCost')} />
              </Field>
            ) : (
              <Field label="Energy cost (₦)">
                <input inputMode="decimal" className="dgn-input" {...register('energyCost')} />
              </Field>
            )}
            {meta.showWashFields && (
              <>
                <Field label="Water (litres)">
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
            <Field label="Downtime (min)">
              <input inputMode="numeric" className="dgn-input" {...register('downtimeMinutes')} />
            </Field>
            <Field label="Downtime reason">
              <input className="dgn-input" {...register('downtimeReason')} />
            </Field>
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
          disabled={formState.isSubmitting || (isSorting && colorsOverLot)}
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
