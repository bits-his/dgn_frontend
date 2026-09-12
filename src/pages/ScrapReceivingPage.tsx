import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, Field, ErrorBanner } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { cn } from '@/lib/utils'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'
import { SORT_COLORS } from '@/lib/sortColors'
import { Truck, Scale, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ColorCombobox } from '@/components/ui/color-combobox'
import { ProcessingWalletPayBox } from '@/components/ProcessingWalletPayBox'

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
  const { id: editId } = useParams<{ id?: string }>()
  const isEdit = Boolean(editId)
  const queryClient = useQueryClient()
  const [serverErrors, setServerErrors] = useState<ErrorItem[]>([])
  const [warning, setWarning] = useState<{ netWeight: number } | null>(null)
  const [isCostBreakdownOpen, setIsCostBreakdownOpen] = useState(true)
  const [colorLines, setColorLines] = useState<ColorLine[]>([])
  const [pickColor, setPickColor] = useState('')
  const [pickKg, setPickKg] = useState('')
  const [editBatchNumber, setEditBatchNumber] = useState<string | null>(null)
  const [payFromProcessingWallet, setPayFromProcessingWallet] = useState(true)

  const suppliers = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => fetchMaster('/masters/suppliers'),
  })

  const receiptQuery = useQuery({
    queryKey: ['scrap-receipt', editId],
    enabled: isEdit,
    queryFn: async () => {
      const { data } = await api.get(`/receiving/scrap/${editId}`)
      return data.data as {
        id: number
        inboundForm: 'RAW' | 'CRUSHED'
        netWeight: number | string
        pricePerKg: number | string
        purchaseCost: number | string
        transportCost?: number | string
        loadingCost?: number | string
        unloadingCost?: number | string
        scaleCost?: number | string
        netBagCost?: number | string
        sortingPricePerKg?: number | string
        sortingCost?: number | string
        otherCost?: number | string
        supplier?: { id: number; name: string } | null
        material?: { id: number; name: string } | null
        batch?: { batchNumber: string; notes?: string | null; locationId?: number } | null
        editable?: boolean
        lockReason?: string | null
        colorLines?: { id?: number; color: string; qtyKg: number }[]
      }
    },
  })

  const { register, handleSubmit, watch,  reset, formState } = useForm<FormValues>({
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
      unloadingCost: '0',
      otherCost: '0',
      notes: '',
    },
  })

  useEffect(() => {
    const r = receiptQuery.data
    if (!r || !isEdit) return
    setEditBatchNumber(r.batch?.batchNumber || null)
    reset({
      inboundForm: r.inboundForm || 'RAW',
      supplierName: r.supplier?.name || '',
      kg: String(Number(r.netWeight || 0)),
      pricePerKg: String(Number(r.pricePerKg || 0)),
      sortingPricePerKg: String(Number(r.sortingPricePerKg || 0)),
      transportCost: String(Number(r.transportCost || 0)),
      scaleCost: String(Number(r.scaleCost || 0)),
      netCost: String(Number(r.netBagCost || 0)),
      loadingCost: String(Number(r.loadingCost || 0)),
      unloadingCost: String(Number(r.unloadingCost || 0)),
      otherCost: String(Number(r.otherCost || 0)),
      notes: r.batch?.notes || '',
    })
    if (r.colorLines && r.colorLines.length) {
      setColorLines(r.colorLines.map((l) => ({ color: l.color, qtyKg: Number(l.qtyKg || 0) })))
    }
    setIsCostBreakdownOpen(true)
  }, [receiptQuery.data, isEdit, reset])



  const inboundForm = watch('inboundForm')
  const isCrushed = inboundForm === 'CRUSHED'

  const colorTotal = useMemo(
    () => +colorLines.reduce((sum, line) => sum + line.qtyKg, 0).toFixed(3),
    [colorLines],
  )
  const rawKg = Number(watch('kg') || 0)
  const netKg = isCrushed
    ? colorTotal
    : Number(Math.max(rawKg, 0).toFixed(3))

  const pricePerKg = Number(watch('pricePerKg') || 0)
  const sortingPricePerKg = Number(watch('sortingPricePerKg') || 0)
  const transportCost = Number(watch('transportCost') || 0)
  const scaleCost = Number(watch('scaleCost') || 0)
  const netCost = Number(watch('netCost') || 0)
  const loadingCost = Number(watch('loadingCost') || 0)
  const unloadingCost = Number(watch('unloadingCost') || 0)
  const otherCost = Number(watch('otherCost') || 0)

  const scrapCost = useMemo(() => Number((netKg * pricePerKg).toFixed(2)), [netKg, pricePerKg])
  const sortingCost = useMemo(
    () => (isCrushed ? 0 : Number((netKg * sortingPricePerKg).toFixed(2))),
    [isCrushed, netKg, sortingPricePerKg],
  )
  const totalOtherCosts = useMemo(
    () =>
      Number(
        (transportCost + scaleCost + netCost + loadingCost + unloadingCost + otherCost).toFixed(2),
      ),
    [transportCost, scaleCost, netCost, loadingCost, unloadingCost, otherCost],
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
    if (isEdit) return
    setColorLines([])
    setPickColor('')
    setPickKg('')
    setServerErrors([])
  }, [inboundForm, isEdit])

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

    if (!values.supplierName?.trim() && !isEdit) {
      setServerErrors([{ label: 'Supplier', message: 'Please enter a supplier name.' }])
      return
    }

    if (values.inboundForm === 'CRUSHED' && !colorLines.length) {
      setServerErrors([
        {
          label: 'Colours',
          message: 'Add at least one colour with kg.',
        },
      ])
      return
    }

    try {
      if (isEdit && editId) {
        await api.patch(`/receiving/scrap/${editId}`, {
          inboundForm: values.inboundForm,
          kg: values.inboundForm === 'CRUSHED' ? colorTotal : Number(values.kg),
          colorLines: values.inboundForm === 'CRUSHED' ? colorLines : undefined,
          pricePerKg: Number(values.pricePerKg),
          sortingPricePerKg: values.inboundForm === 'CRUSHED' ? 0 : Number(values.sortingPricePerKg || 0),
          transportCost: Number(values.transportCost || 0),
          scaleCost: Number(values.scaleCost || 0),
          netCost: Number(values.netCost || 0),
          loadingCost: Number(values.loadingCost || 0),
          unloadingCost: Number(values.unloadingCost || 0),
          otherCost: Number(values.otherCost || 0),
          notes: values.notes || null,
        })
        await queryClient.invalidateQueries({ queryKey: ['scrap-receipts'] })
        await queryClient.invalidateQueries({ queryKey: ['scrap-receipt', editId] })
        await queryClient.invalidateQueries({ queryKey: ['batches'] })
        await queryClient.invalidateQueries()
        navigate(`/receiving/${editId}`)
        return
      }

      // Find matching supplier id if exact match exists
      const matchedSup = (suppliers.data || []).find(
        (s) => s.name.trim().toLowerCase() === values.supplierName.trim().toLowerCase()
      )

      await api.post('/receiving/scrap', {
        supplierId: matchedSup ? matchedSup.id : undefined,
        supplierName: values.supplierName.trim(),
        inboundForm: values.inboundForm,
        kg: values.inboundForm === 'CRUSHED' ? colorTotal : Number(values.kg),
        colorLines: values.inboundForm === 'CRUSHED' ? colorLines : undefined,
        pricePerKg: Number(values.pricePerKg),
        sortingPricePerKg: values.inboundForm === 'CRUSHED' ? 0 : Number(values.sortingPricePerKg || 0),
        transportCost: Number(values.transportCost || 0),
        scaleCost: Number(values.scaleCost || 0),
        netCost: Number(values.netCost || 0),
        loadingCost: Number(values.loadingCost || 0),
        unloadingCost: Number(values.unloadingCost || 0),
        otherCost: Number(values.otherCost || 0),
        notes: values.notes || null,
        confirmUnusualNet,
        payFromProcessingWallet,
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

  if (isEdit && receiptQuery.isLoading) {
    return (
      <PageLayout title="Edit scrap buying" back backTo="/receiving">
        <Card className="p-6 text-sm text-[var(--ink-muted)]">Loading receipt…</Card>
      </PageLayout>
    )
  }

  if (isEdit && (receiptQuery.isError || !receiptQuery.data)) {
    return (
      <PageLayout title="Edit scrap buying" back backTo="/receiving">
        <Card className="p-6 text-sm text-red-700">Scrap receipt not found.</Card>
      </PageLayout>
    )
  }

  if (isEdit && receiptQuery.data && receiptQuery.data.editable === false) {
    const lockedBatch = receiptQuery.data.batch?.batchNumber || editBatchNumber
    return (
      <PageLayout
        title={`Edit scrap buying${lockedBatch ? ` · ${lockedBatch}` : ''}`}
        back
        backTo="/receiving"
      >
        <Card className="border-amber-200 bg-amber-50 p-6 text-amber-950">
          <p className="text-sm font-semibold">Editing is locked</p>
          <p className="mt-1 text-sm">
            {receiptQuery.data.lockReason ||
              'This buy has already moved to a later process stage and can no longer be edited.'}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="dgn-btn dgn-btn-secondary"
              onClick={() => navigate('/receiving')}
            >
              Back to list
            </button>
            {lockedBatch && (
              <button
                type="button"
                className="dgn-btn dgn-btn-primary"
                onClick={() => navigate(`/batches/${lockedBatch}`)}
              >
                Open batch
              </button>
            )}
          </div>
        </Card>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={isEdit ? `Edit scrap buying${editBatchNumber ? ` · ${editBatchNumber}` : ''}` : 'New Scrap Buying'}
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
            <span className="text-xs text-[var(--ink-muted)]">
              {isEdit ? 'Locked on edit' : 'Select inbound format'}
            </span>
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
                  isEdit && 'pointer-events-none opacity-70',
                  inboundForm === opt.value
                    ? 'bg-[var(--accent-soft)] ring-[var(--accent)]'
                    : 'ring-[var(--line)] hover:ring-[var(--ink-faint)]',
                )}
              >
                <input
                  type="radio"
                  className="sr-only"
                  value={opt.value}
                  disabled={isEdit}
                  {...register('inboundForm', { required: !isEdit })}
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
                disabled={isEdit}
                {...register('supplierName', { required: !isEdit })}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Crushed colours</h2>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">
                  {isEdit
                    ? 'Edit colour lines and weights. All colours remain in the same batch for washing.'
                    : 'Add each colour and kg. All colours are received in a single batch ready for washing.'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-[var(--ink-muted)]">Total crushed weight</span>
                <p className="text-base font-bold text-emerald-600">{colorTotal.toLocaleString()} kg</p>
              </div>
            </div>

            <div className="mt-3 max-w-sm">
              <Field label="Purchase price / kg (₦)">
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="dgn-input w-full"
                  {...register('pricePerKg', { required: true })}
                />
              </Field>
            </div>

            {/* List of colour lines */}
            {colorLines.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-[var(--line)]">
                <div className="bg-[var(--surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--ink-muted)] grid grid-cols-[1fr_130px_auto] gap-2 items-center">
                  <span>Colour</span>
                  <span className="text-right">Weight (kg)</span>
                  <span className="w-14 text-center">Action</span>
                </div>
                <ul className="divide-y divide-[var(--line)] bg-[var(--surface)]">
                  {colorLines.map((line, idx) => (
                    <li
                      key={line.color}
                      className="grid grid-cols-[1fr_130px_auto] gap-2 items-center px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-[var(--ink)]">{colorName(line.color)}</span>
                        <span className="text-xs text-[var(--ink-muted)] font-mono">({line.color})</span>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          placeholder="0"
                          value={line.qtyKg || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setColorLines((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, qtyKg: val } : r))
                            )
                          }}
                          className="dgn-input w-24 text-right py-1 text-sm font-semibold"
                        />
                        <span className="text-xs text-[var(--ink-muted)]">kg</span>
                      </div>
                      <div className="w-14 text-center">
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-500 hover:text-red-400 p-1"
                          onClick={() =>
                            setColorLines((prev) => prev.filter((_, i) => i !== idx))
                          }
                          title="Remove colour"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add Colour Form — same as crushing: pick colour, type kg, Enter adds */}
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end">
              <div className="flex-1 shrink-0">
                <label className="mb-1 block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">
                  Colour
                </label>
                <ColorCombobox
                  value={pickColor}
                  onChange={(code) => {
                    setPickColor(code)
                    setServerErrors([])
                    setTimeout(() => {
                      document.getElementById('scrap-pick-kg-input')?.focus()
                    }, 80)
                  }}
                  exclude={colorLines.map((l) => l.color)}
                  placeholder="Pick a colour…"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wide">
                  Kg
                </label>
                <input
                  id="scrap-pick-kg-input"
                  inputMode="decimal"
                  className="dgn-input w-full"
                  placeholder="0.000"
                  value={pickKg}
                  onChange={(e) => setPickKg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      addColorLine()
                    }
                  }}
                />
              </div>
              <div className="sm:w-28 sm:shrink-0">
                <Button
                  type="button"
                  className="h-11 w-full font-semibold"
                  onClick={addColorLine}
                >
                  + Add
                </Button>
              </div>
            </div>
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
                {!isCrushed && (
                  <div className="flex justify-between text-indigo-700">
                    <span>Sorting ({netKg.toLocaleString()} kg @ ₦{sortingPricePerKg.toLocaleString()})</span>
                    <span className="font-mono font-medium">₦{sortingCost.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-600">
                  <span>Scale / Weighbridge fee</span>
                  <span className="font-mono text-zinc-900">₦{scaleCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Net bag cost</span>
                  <span className="font-mono text-zinc-900">₦{netCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Transport</span>
                  <span className="font-mono text-zinc-900">₦{transportCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Loading</span>
                  <span className="font-mono text-zinc-900">₦{loadingCost.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-zinc-600">
                  <span>Other</span>
                  <span className="font-mono text-zinc-900">₦{otherCost.toLocaleString()}</span>
                </div>

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

        {!isEdit && (
          <ProcessingWalletPayBox
            checked={payFromProcessingWallet}
            onChange={setPayFromProcessingWallet}
          />
        )}

        {(serverErrors.length > 0 || Object.keys(formState.errors).length > 0) && (
          <ErrorBanner
            items={
              serverErrors.length > 0
                ? serverErrors
                : Object.entries(formState.errors).map(([field, err]) => ({
                    label: field,
                    message: (err as { message?: string })?.message || 'Required',
                  }))
            }
          />
        )}

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
                {isEdit ? 'Saving changes…' : 'Saving scrap ticket…'}
              </>
            ) : (
              <>
                <ShoppingCart className="h-4.5 w-4.5" />
                {isEdit ? 'Save changes' : 'Record Scrap Buying'}
              </>
            )}
          </button>
        </div>
      </form>
    </PageLayout>
  )
}
