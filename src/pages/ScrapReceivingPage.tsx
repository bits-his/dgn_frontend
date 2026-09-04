import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill, ErrorBanner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'
import { SORT_COLORS } from '@/lib/sortColors'
import { MATERIAL_BUY_TYPES } from '@/lib/materials'

type MasterItem = { id: number; name: string; code?: string }
type ColorLine = { color: string; qtyKg: number }
type ColorLot = { batchNumber: string; color: string; qtyKg: number }

type FormValues = {
  inboundForm: 'RAW' | 'CRUSHED'
  supplierId: string
  materialId: string
  locationId: string
  kg: string
  pricePerKg: string
  transportCost: string
  loadingCost: string
  unloadingCost: string
  otherCost: string
  notes: string
}

async function fetchMaster(path: string) {
  const { data } = await api.get(path)
  return data.data as MasterItem[]
}

function colorName(code: string) {
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

export function ScrapReceivingPage() {
  const navigate = useNavigate()
  const [serverErrors, setServerErrors] = useState<ErrorItem[]>([])
  const [warning, setWarning] = useState<{ netWeight: number } | null>(null)
  const [success, setSuccess] = useState<{
    batchNumber: string
    nextStage: string
    inboundForm: string
    colorLots: ColorLot[]
  } | null>(null)
  const [colorLines, setColorLines] = useState<ColorLine[]>([])
  const [pickColor, setPickColor] = useState('')
  const [pickKg, setPickKg] = useState('')

  const materials = useQuery({
    queryKey: ['materials'],
    queryFn: () => fetchMaster('/masters/materials'),
  })
  const suppliers = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => fetchMaster('/masters/suppliers'),
  })
  const locations = useQuery({
    queryKey: ['locations'],
    queryFn: () => fetchMaster('/masters/locations'),
  })

  const { register, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    defaultValues: {
      inboundForm: 'RAW',
      supplierId: '',
      materialId: '',
      locationId: '',
      kg: '',
      pricePerKg: '',
      transportCost: '0',
      loadingCost: '0',
      unloadingCost: '0',
      otherCost: '0',
      notes: '',
    },
  })

  const buyMaterials = useMemo(() => {
    const codes = new Set(MATERIAL_BUY_TYPES.map((m) => m.code))
    const fromApi = (materials.data || []).filter((m) => m.code && codes.has(m.code))
    return MATERIAL_BUY_TYPES.map((wanted) => {
      const hit =
        fromApi.find((m) => m.code === wanted.code) ||
        (materials.data || []).find(
          (m) => m.name.toLowerCase() === wanted.name.toLowerCase(),
        )
      return hit
        ? { id: hit.id, name: wanted.name, code: wanted.code }
        : { id: 0, name: wanted.name, code: wanted.code }
    }).filter((m) => m.id > 0)
  }, [materials.data])

  useEffect(() => {
    if (!buyMaterials.length) return
    const current = watch('materialId')
    if (!current || !buyMaterials.some((m) => String(m.id) === String(current))) {
      setValue('materialId', String(buyMaterials[0].id))
    }
  }, [buyMaterials, setValue, watch])

  useEffect(() => {
    if (locations.data?.length && !watch('locationId')) {
      const yard = locations.data.find((l) => l.code === 'RM-YARD') || locations.data[0]
      setValue('locationId', String(yard.id))
    }
  }, [locations.data, setValue, watch])

  const inboundForm = watch('inboundForm')
  const isCrushed = inboundForm === 'CRUSHED'
  const price = Number(watch('pricePerKg') || 0)
  const colorTotal = useMemo(
    () => +colorLines.reduce((sum, line) => sum + line.qtyKg, 0).toFixed(3),
    [colorLines],
  )
  const rawKg = Number(watch('kg') || 0)
  const netKg = isCrushed ? colorTotal : Number(Math.max(rawKg, 0).toFixed(3))
  const purchaseCost = useMemo(
    () => Number((netKg * price).toFixed(2)),
    [netKg, price],
  )

  const availableColors = SORT_COLORS.filter(
    (c) => !colorLines.some((line) => line.color === c.code),
  )

  useEffect(() => {
    setColorLines([])
    setPickColor('')
    setPickKg('')
    setServerErrors([])
  }, [inboundForm])

  const addColorLine = () => {
    setServerErrors([])
    const color = pickColor
    const qtyKg = Number(pickKg)
    if (!color) {
      setServerErrors([{ label: 'Colour', message: 'Select a colour before adding.' }])
      return
    }
    if (!(qtyKg > 0)) {
      setServerErrors([{ label: 'Kg', message: 'Enter kg greater than zero for this colour.' }])
      return
    }
    if (colorLines.some((line) => line.color === color)) {
      setServerErrors([
        {
          label: 'Colour',
          message: `${colorName(color)} is already on the list.`,
        },
      ])
      return
    }
    setColorLines((prev) => [...prev, { color, qtyKg: +qtyKg.toFixed(3) }])
    setPickColor('')
    setPickKg('')
  }

  const submitPayload = async (values: FormValues, confirmUnusualNet = false) => {
    setServerErrors([])
    setWarning(null)

    if (values.inboundForm === 'CRUSHED' && !colorLines.length) {
      setServerErrors([
        {
          label: 'Colours',
          message: 'Add at least one colour with kg. Each colour gets its own BAT- batch.',
        },
      ])
      return
    }

    try {
      const { data } = await api.post('/receiving/scrap', {
        supplierId: Number(values.supplierId),
        materialId: Number(values.materialId),
        locationId: Number(values.locationId),
        inboundForm: values.inboundForm,
        kg: values.inboundForm === 'CRUSHED' ? colorTotal : Number(values.kg),
        colorLines: values.inboundForm === 'CRUSHED' ? colorLines : undefined,
        pricePerKg: Number(values.pricePerKg),
        transportCost: Number(values.transportCost || 0),
        loadingCost: Number(values.loadingCost || 0),
        unloadingCost: Number(values.unloadingCost || 0),
        otherCost: Number(values.otherCost || 0),
        notes: values.notes || null,
        confirmUnusualNet,
      })
      setSuccess({
        batchNumber: data.batchNumber,
        nextStage: data.nextStage || (values.inboundForm === 'CRUSHED' ? 'washing' : 'sorting'),
        inboundForm: data.inboundForm || values.inboundForm,
        colorLots: Array.isArray(data.colorLots) ? data.colorLots : [],
      })
      setColorLines([])
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number
          data?: {
            warning?: boolean
            message?: string
            netWeight?: number
            errors?: Record<string, string>
            err?: string
          }
        }
      }
      const res = axiosErr.response
      if (res?.status === 422 && res.data?.warning) {
        setWarning({ netWeight: res.data.netWeight || netKg })
        return
      }
      setServerErrors(
        formatApiErrors(
          res?.data?.errors,
          res?.data?.err || res?.data?.message || 'Failed to save receiving',
        ),
      )
    }
  }

  if (success) {
    const nextLabel = success.nextStage === 'washing' ? 'Washing' : 'Sorting'
    const crushedLots = success.colorLots.length > 0
    return (
      <Card>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            {success.inboundForm === 'CRUSHED' ? 'Crushed colour batches created' : 'Scrap ticket created'}
          </p>
          {!crushedLots && (
            <p className="mt-3 text-3xl font-semibold tracking-tight">{success.batchNumber}</p>
          )}
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            {success.inboundForm === 'CRUSHED'
              ? 'Each colour has its own BAT- number and goes to washing.'
              : 'Raw scrap ticket (SCR-). Sorting will split it into BAT- lots by colour.'}
          </p>
        </div>

        {crushedLots && (
          <ul className="mt-5 divide-y divide-[var(--line)] rounded-xl ring-1 ring-[var(--line)]">
            {success.colorLots.map((lot) => (
              <li key={lot.batchNumber} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold tracking-tight">{lot.batchNumber}</p>
                  <p className="text-sm text-[var(--ink-muted)]">
                    {colorName(lot.color)} · {lot.qtyKg.toLocaleString()} kg
                  </p>
                </div>
                <button
                  type="button"
                  className="dgn-btn dgn-btn-secondary"
                  onClick={() => navigate(`/batches/${lot.batchNumber}`)}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            className="dgn-btn dgn-btn-primary"
            onClick={() => navigate(`/process/${success.nextStage}`)}
          >
            Go to {nextLabel}
          </button>
          {!crushedLots && (
            <button
              type="button"
              className="dgn-btn dgn-btn-secondary"
              onClick={() => navigate(`/batches/${success.batchNumber}`)}
            >
              Open record
            </button>
          )}
          <button
            type="button"
            className="dgn-btn dgn-btn-secondary"
            onClick={() => setSuccess(null)}
          >
            New buying
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Processing · inbound"
        title="Scrap buying"
        description="Buy raw scrap (SCR- ticket) or already-crushed material by colour (one BAT- per colour)."
      />

      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => submitPayload(values, false))}
      >
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">What did you buy?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  value: 'RAW' as const,
                  title: 'Raw / unprocessed',
                  desc: 'Sort → Crush → Wash → Dry',
                },
                {
                  value: 'CRUSHED' as const,
                  title: 'Already crushed',
                  desc: 'Enter by colour → Wash → Dry',
                },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'cursor-pointer rounded-xl px-4 py-3 ring-1 transition',
                  inboundForm === opt.value
                    ? 'bg-[var(--accent-soft)] ring-[var(--accent)]'
                    : 'ring-[var(--line)] hover:ring-[var(--ink-faint)]',
                )}
              >
                <input
                  type="radio"
                  className="sr-only"
                  value={opt.value}
                  {...register('inboundForm', { required: true })}
                />
                <span className="block text-sm font-semibold">{opt.title}</span>
                <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">{opt.desc}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Material & store</h2>
            <Link
              to="/suppliers"
              className="text-sm font-semibold text-[var(--accent-strong)]"
            >
              Manage suppliers
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Supplier">
              <select className="dgn-input" {...register('supplierId', { required: true })}>
                <option value="">Select supplier</option>
                {suppliers.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Material type">
              <select className="dgn-input" {...register('materialId', { required: true })}>
                <option value="">Select material type</option>
                {buyMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            {!isCrushed && (
              <Field label="Store location">
                <select className="dgn-input" {...register('locationId', { required: true })}>
                  <option value="">Select location</option>
                  {locations.data?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </Card>

        {isCrushed ? (
          <Card>
            <h2 className="text-lg font-semibold tracking-tight">Colours → batches</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Add each colour and its kg. Each colour gets its own BAT- number for washing.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Price / kg (₦)">
                <input
                  inputMode="decimal"
                  className="dgn-input"
                  {...register('pricePerKg', { required: true })}
                />
              </Field>
            </div>
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
              <Field label="Kg">
                <input
                  inputMode="decimal"
                  className="dgn-input"
                  value={pickKg}
                  onChange={(e) => setPickKg(e.target.value)}
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  className="dgn-btn dgn-btn-secondary w-full"
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
                      onClick={() =>
                        setColorLines((prev) => prev.filter((row) => row.color !== line.color))
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatPill
                label="Total weight"
                value={netKg > 0 ? `${netKg.toLocaleString()} kg` : '—'}
                tone="accent"
              />
              <StatPill
                label="Purchase cost"
                value={purchaseCost > 0 ? `₦${purchaseCost.toLocaleString()}` : '—'}
                tone="success"
              />
            </div>
          </Card>
        ) : (
          <Card>
            <h2 className="text-lg font-semibold tracking-tight">Quantity & price</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Quantity (kg)">
                <input
                  inputMode="decimal"
                  className="dgn-input"
                  {...register('kg', { required: !isCrushed })}
                />
              </Field>
              <Field label="Price / kg (₦)">
                <input
                  inputMode="decimal"
                  className="dgn-input"
                  {...register('pricePerKg', { required: true })}
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatPill
                label="Weight"
                value={netKg > 0 ? `${netKg.toLocaleString()} kg` : '—'}
                tone="accent"
              />
              <StatPill
                label="Purchase cost"
                value={purchaseCost > 0 ? `₦${purchaseCost.toLocaleString()}` : '—'}
                tone="success"
              />
            </div>
          </Card>
        )}

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Other costs & notes</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Transport ₦">
              <input inputMode="decimal" className="dgn-input" {...register('transportCost')} />
            </Field>
            <Field label="Loading ₦">
              <input inputMode="decimal" className="dgn-input" {...register('loadingCost')} />
            </Field>
            <Field label="Unloading ₦">
              <input inputMode="decimal" className="dgn-input" {...register('unloadingCost')} />
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

        {serverErrors.length > 0 && <ErrorBanner items={serverErrors} />}

        {warning && (
          <Card className="border-amber-200 bg-amber-50 text-amber-950">
            <p className="text-sm">
              Weight {warning.netWeight.toLocaleString()} kg looks unusually high. Confirm to save?
            </p>
            <button
              type="button"
              className="dgn-btn dgn-btn-primary mt-3"
              onClick={handleSubmit((values) => submitPayload(values, true))}
            >
              Confirm unusual weight
            </button>
          </Card>
        )}

        <button
          type="submit"
          disabled={formState.isSubmitting || (isCrushed && !colorLines.length)}
          className="dgn-btn dgn-btn-primary w-full sm:w-auto"
        >
          {formState.isSubmitting ? 'Saving…' : 'Save buying'}
        </button>
      </form>
    </div>
  )
}
