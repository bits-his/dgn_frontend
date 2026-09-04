import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill, ErrorBanner } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatApiErrors, type ErrorItem } from '@/lib/errors'

type MasterItem = { id: number; name: string; code?: string }

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

export function ScrapReceivingPage() {
  const navigate = useNavigate()
  const [serverErrors, setServerErrors] = useState<ErrorItem[]>([])
  const [warning, setWarning] = useState<{ netWeight: number } | null>(null)
  const [success, setSuccess] = useState<{
    batchNumber: string
    nextStage: string
    inboundForm: string
  } | null>(null)

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

  useEffect(() => {
    if (locations.data?.length && !watch('locationId')) {
      const yard = locations.data.find((l) => l.code === 'RM-YARD') || locations.data[0]
      setValue('locationId', String(yard.id))
    }
  }, [locations.data, setValue, watch])

  const inboundForm = watch('inboundForm')
  const kg = Number(watch('kg') || 0)
  const price = Number(watch('pricePerKg') || 0)
  const netKg = useMemo(() => Number(Math.max(kg, 0).toFixed(3)), [kg])
  const purchaseCost = useMemo(
    () => Number((netKg * price).toFixed(2)),
    [netKg, price],
  )

  const submitPayload = async (values: FormValues, confirmUnusualNet = false) => {
    setServerErrors([])
    setWarning(null)
    try {
      const { data } = await api.post('/receiving/scrap', {
        supplierId: Number(values.supplierId),
        materialId: Number(values.materialId),
        locationId: Number(values.locationId),
        inboundForm: values.inboundForm,
        kg: Number(values.kg),
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
      })
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
    return (
      <Card className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
          {success.inboundForm === 'CRUSHED' ? 'Process lot created' : 'Scrap ticket created'}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{success.batchNumber}</p>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          {success.inboundForm === 'CRUSHED'
            ? 'Already crushed — this BAT- number goes straight to washing.'
            : 'Raw scrap ticket (SCR-). Sorting will split it into BAT- lots by colour.'}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            className="dgn-btn dgn-btn-primary"
            onClick={() => navigate(`/process/${success.nextStage}`)}
          >
            Go to {nextLabel}
          </button>
          <button
            type="button"
            className="dgn-btn dgn-btn-secondary"
            onClick={() => navigate(`/batches/${success.batchNumber}`)}
          >
            Open record
          </button>
          <button type="button" className="dgn-btn dgn-btn-secondary" onClick={() => setSuccess(null)}>
            New buying
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Recycling · inbound"
        title="Scrap buying"
        description="Buy raw scrap (SCR- ticket) or already-crushed material (BAT- lot). Raw scrap is split into colour lots at sorting."
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
                  desc: 'Skip to Wash → Dry',
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
            <Field label="Material">
              <select className="dgn-input" {...register('materialId', { required: true })}>
                <option value="">Select material</option>
                {materials.data?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            {inboundForm === 'RAW' && (
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

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Quantity & price</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Quantity (kg)">
              <input
                inputMode="decimal"
                className="dgn-input"
                {...register('kg', { required: true })}
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
          disabled={formState.isSubmitting}
          className="dgn-btn dgn-btn-primary w-full sm:w-auto"
        >
          {formState.isSubmitting ? 'Saving…' : 'Save buying'}
        </button>
      </form>
    </div>
  )
}
