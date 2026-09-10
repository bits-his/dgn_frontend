import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, Field, ErrorBanner } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { cn } from '@/lib/utils'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'
import { SORT_COLORS } from '@/lib/sortColors'
import { Truck, Scale, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react'
import { ColorCombobox } from '@/components/ui/color-combobox'

type MasterItem = { id: number; name: string; code?: string }
type ColorLine = { color: string; qtyKg: number }

type FormValues = {
  inboundForm: 'RAW' | 'CRUSHED'
  supplierName: string
  kg: string
  pricePerKg: string
  sortingPricePerKg: string
  transportCost: string
  scaleCost: string
  netCost: string
  loadingCost: string
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
  const queryClient = useQueryClient()
  const [serverErrors, setServerErrors] = useState<ErrorItem[]>([])
  const [warning, setWarning] = useState<{ netWeight: number } | null>(null)
  const [isCostBreakdownOpen, setIsCostBreakdownOpen] = useState(false)
  const [colorLines, setColorLines] = useState<ColorLine[]>([])
  const [pickColor, setPickColor] = useState('')
  const [pickKg, setPickKg] = useState('')

  const suppliers = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => fetchMaster('/masters/suppliers'),
  })

  const { register, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    defaultValues: {
      inboundForm: 'RAW',
      supplierName: '',
      kg: '',
      pricePerKg: '',
      sortingPricePerKg: '0',
      transportCost: '0',
      scaleCost: '0',
      netCost: '0',
      loadingCost: '0',
      otherCost: '0',
      notes: '',
    },
  })

  const inboundForm = watch('inboundForm')
  const isCrushed = inboundForm === 'CRUSHED'

  const colorTotal = useMemo(
    () => +colorLines.reduce((sum, line) => sum + line.qtyKg, 0).toFixed(3),
    [colorLines],
  )
  const rawKg = Number(watch('kg') || 0)
  const netKg = isCrushed ? colorTotal : Number(Math.max(rawKg, 0).toFixed(3))

  const pricePerKg = Number(watch('pricePerKg') || 0)
  const sortingPricePerKg = Number(watch('sortingPricePerKg') || 0)
  const transportCost = Number(watch('transportCost') || 0)
  const scaleCost = Number(watch('scaleCost') || 0)
  const netCost = Number(watch('netCost') || 0)
  const loadingCost = Number(watch('loadingCost') || 0)
  const otherCost = Number(watch('otherCost') || 0)

  const scrapCost = useMemo(() => Number((netKg * pricePerKg).toFixed(2)), [netKg, pricePerKg])
  const sortingCost = useMemo(() => Number((netKg * sortingPricePerKg).toFixed(2)), [netKg, sortingPricePerKg])
  const totalOtherCosts = useMemo(
    () => Number((transportCost + scaleCost + netCost + loadingCost + otherCost).toFixed(2)),
    [transportCost, scaleCost, netCost, loadingCost, otherCost]
  )
  const grandTotalCost = useMemo(
    () => Number((scrapCost + sortingCost + totalOtherCosts).toFixed(2)),
    [scrapCost, sortingCost, totalOtherCosts]
  )
  const effectiveCostPerKg = useMemo(
    () => (netKg > 0 ? Number((grandTotalCost / netKg).toFixed(2)) : 0),
    [grandTotalCost, netKg]
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

    if (!values.supplierName?.trim()) {
      setServerErrors([{ label: 'Supplier', message: 'Please enter a supplier name.' }])
      return
    }

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
      // Find matching supplier id if exact match exists
      const matchedSup = (suppliers.data || []).find(
        (s) => s.name.trim().toLowerCase() === values.supplierName.trim().toLowerCase()
      )

      const { data } = await api.post('/receiving/scrap', {
        supplierId: matchedSup ? matchedSup.id : undefined,
        supplierName: values.supplierName.trim(),
        inboundForm: values.inboundForm,
        kg: values.inboundForm === 'CRUSHED' ? colorTotal : Number(values.kg),
        colorLines: values.inboundForm === 'CRUSHED' ? colorLines : undefined,
        pricePerKg: Number(values.pricePerKg),
        sortingPricePerKg: Number(values.sortingPricePerKg || 0),
        transportCost: Number(values.transportCost || 0),
        scaleCost: Number(values.scaleCost || 0),
        netCost: Number(values.netCost || 0),
        loadingCost: Number(values.loadingCost || 0),
        otherCost: Number(values.otherCost || 0),
        notes: values.notes || null,
        confirmUnusualNet,
      })

      // Invalidate queries so that navigation back to receiving list, batches, or stages immediately shows fresh data
      await queryClient.invalidateQueries({ queryKey: ['scrap-receipts'] })
      await queryClient.invalidateQueries({ queryKey: ['batches'] })
      await queryClient.invalidateQueries({ queryKey: ['process-inputs'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['stock-ledger'] })
      await queryClient.invalidateQueries()

      navigate('/receiving')
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



  return (
    <PageLayout
      title="New Scrap Buying"
      description="Processing · Inbound raw scrap or crushed flakes"
      back={true}
      backTo="/receiving"
    >

      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => submitPayload(values, false))}
      >
        {/* Section 1: Inbound Form Selector */}
        <Card className="p-3 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Scrap condition</h2>
            <span className="text-xs text-[var(--ink-muted)]">Select inbound format</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {(
              [
                {
                  value: 'RAW' as const,
                  title: 'Raw / Unprocessed',
                  desc: 'Sorted on buying → Crushing',
                },
                {
                  value: 'CRUSHED' as const,
                  title: 'Already Crushed',
                  desc: 'By colour → Washing',
                },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'cursor-pointer rounded-xl p-3 ring-1 transition select-none',
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

        {/* Section 2: Supplier Details */}
        <Card className="p-3 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight">Supplier details</h2>
          </div>

          <div className="mt-3">
            <Field label="Supplier name">
              <input
                type="text"
                list="suppliers-datalist"
                placeholder="Type or select supplier name"
                className="dgn-input w-full"
                autoComplete="off"
                {...register('supplierName', { required: true })}
              />
              <datalist id="suppliers-datalist">
                {suppliers.data?.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </Field>
          </div>
        </Card>

        {/* Section 3: Quantity & Buying Rates */}
        {isCrushed ? (
          <Card className="p-3 sm:p-5">
            <h2 className="text-base font-semibold tracking-tight">Crushed colours → batches</h2>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Add each colour and kg. Each colour mints its own BAT- batch for washing.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Purchase price / kg (₦)">
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  className="dgn-input w-full"
                  {...register('pricePerKg', { required: true })}
                />
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-[1.2fr_1fr_auto]">
              <Field label="Colour">
                <ColorCombobox
                  value={pickColor}
                  onChange={setPickColor}
                  exclude={colorLines.map((l) => l.color)}
                  placeholder="Select colour…"
                />
              </Field>
              <Field label="Kg">
                <input
                  inputMode="decimal"
                  placeholder="0"
                  className="dgn-input w-full"
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
                  + Add colour
                </button>
              </div>
            </div>

            {colorLines.length > 0 && (
              <ul className="mt-3 divide-y divide-[var(--line)] rounded-xl ring-1 ring-[var(--line)]">
                {colorLines.map((line) => (
                  <li
                    key={line.color}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{colorName(line.color)}</span>
                    <span className="text-[var(--ink-muted)]">{line.qtyKg.toLocaleString()} kg</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-500 hover:text-red-400"
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
          </Card>
        ) : (
          <Card className="p-3 sm:p-5">
            <h2 className="text-base font-semibold tracking-tight">Quantity & rates</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Total quantity (kg)">
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 1500"
                  className="dgn-input w-full font-semibold"
                  {...register('kg', { required: !isCrushed })}
                />
              </Field>
              <Field label="Buying price / kg (₦)">
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 350"
                  className="dgn-input w-full"
                  {...register('pricePerKg', { required: true })}
                />
              </Field>
              <Field label="Sorting price / kg (₦)">
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="e.g. 20"
                  className="dgn-input w-full"
                  {...register('sortingPricePerKg')}
                />
              </Field>
            </div>
          </Card>
        )}

        {/* Section 4: Unified Card - Costs, Notes & Live Grand Total Calculation */}
        <Card className="p-3 sm:p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Expenses, notes & total cost</h2>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              Record transport, scale, net cost, and view live totals.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Transport (₦)">
              <div className="relative flex items-center">
                <Truck className="pointer-events-none absolute left-2.5 z-10 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  style={{ paddingLeft: '2rem' }}
                  className="dgn-input w-full"
                  {...register('transportCost')}
                />
              </div>
            </Field>

            <Field label="Scale fee (₦)">
              <div className="relative flex items-center">
                <Scale className="pointer-events-none absolute left-2.5 z-10 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  style={{ paddingLeft: '2rem' }}
                  className="dgn-input w-full"
                  {...register('scaleCost')}
                />
              </div>
            </Field>

            <Field label="Net bag cost (₦)">
              <div className="relative flex items-center">
                <ShoppingCart className="pointer-events-none absolute left-2.5 z-10 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  style={{ paddingLeft: '2rem' }}
                  className="dgn-input w-full"
                  {...register('netCost')}
                />
              </div>
            </Field>

            <Field label="Loading (₦)">
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0"
                className="dgn-input w-full"
                {...register('loadingCost')}
              />
            </Field>

            <Field label="Other (₦)">
              <input
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0"
                className="dgn-input w-full"
                {...register('otherCost')}
              />
            </Field>
          </div>

          <Field label="Notes / Truck or Driver details">
            <textarea
              className="dgn-input w-full text-sm"
              rows={2}
              placeholder="e.g. Weighbridge ticket #, vehicle reg, driver name..."
              {...register('notes')}
            />
          </Field>

          {/* Live Calculation Box - White & Collapsible by default */}
          <div className="rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 shadow-xs">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsCostBreakdownOpen((prev) => !prev)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  Cost Breakdown & Grand Total
                </span>
                <span className="text-[11px] text-zinc-400 font-normal">
                  {isCostBreakdownOpen ? '(Click to hide)' : '(Click to view breakdown)'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-base sm:text-lg font-black font-mono text-emerald-600">
                    ₦{grandTotalCost.toLocaleString()}
                  </span>
                  {effectiveCostPerKg > 0 && (
                    <span className="block text-[11px] text-zinc-500 font-mono">
                      ₦{effectiveCostPerKg.toLocaleString()} / kg
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  {isCostBreakdownOpen ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {isCostBreakdownOpen && (
              <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2 text-xs sm:text-sm text-zinc-600 animate-in fade-in duration-200">
                <div className="flex justify-between">
                  <span>Material purchase ({netKg.toLocaleString()} kg @ ₦{pricePerKg.toLocaleString()})</span>
                  <span className="font-mono font-medium text-zinc-900">₦{scrapCost.toLocaleString()}</span>
                </div>
                {sortingPricePerKg > 0 && (
                  <div className="flex justify-between text-indigo-700">
                    <span>Sorting fee ({netKg.toLocaleString()} kg @ ₦{sortingPricePerKg.toLocaleString()})</span>
                    <span className="font-mono font-medium">₦{sortingCost.toLocaleString()}</span>
                  </div>
                )}
                {scaleCost > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Scale / Weighbridge fee</span>
                    <span className="font-mono text-zinc-900">₦{scaleCost.toLocaleString()}</span>
                  </div>
                )}
                {netCost > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Net bags</span>
                    <span className="font-mono text-zinc-900">₦{netCost.toLocaleString()}</span>
                  </div>
                )}
                {transportCost > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Transport</span>
                    <span className="font-mono text-zinc-900">₦{transportCost.toLocaleString()}</span>
                  </div>
                )}
                {loadingCost > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Loading expense</span>
                    <span className="font-mono text-zinc-900">₦{loadingCost.toLocaleString()}</span>
                  </div>
                )}
                {otherCost > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Other expenses</span>
                    <span className="font-mono text-zinc-900">₦{otherCost.toLocaleString()}</span>
                  </div>
                )}

                <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-xs font-bold text-zinc-900">
                  <span>Grand Total Net Cost:</span>
                  <span className="text-sm font-mono font-black text-emerald-600">
                    ₦{grandTotalCost.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {serverErrors.length > 0 && <ErrorBanner items={serverErrors} />}

        {warning && (
          <Card className="border-amber-200 bg-amber-50 text-amber-950 p-4">
            <p className="text-sm font-medium">
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

        <div className="pt-1">
          <button
            type="submit"
            disabled={formState.isSubmitting || (isCrushed && !colorLines.length)}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3.5 text-[15px] font-bold tracking-wide text-white shadow-lg shadow-emerald-800/30 transition-all hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-700/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
          >
            {formState.isSubmitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Saving scrap ticket…
              </>
            ) : (
              <>
                <ShoppingCart className="h-4.5 w-4.5" />
                Record Scrap Buying
              </>
            )}
          </button>
        </div>
      </form>
    </PageLayout>
  )
}
