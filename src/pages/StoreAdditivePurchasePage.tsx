import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBusinessDate } from '@/lib/dates'
import { cn } from '@/lib/utils'

type FormValues = {
  kind: 'masterbatch' | 'virgin'
  name: string
  qtyKg: string
  pricePerKg: string
  supplierName: string
  notes: string
}

type AdditiveLot = {
  batchNumber: string
  colorName: string
  type: string
  qtyRemaining: number
  costPerKg: number
  businessDate?: string | null
  kindLabel?: string
}

export function StoreAdditivePurchasePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, watch, setValue, reset } = useForm<FormValues>({
    defaultValues: {
      kind: 'masterbatch',
      name: '',
      qtyKg: '',
      pricePerKg: '',
      supplierName: '',
      notes: '',
    },
  })

  const kind = watch('kind')
  const qtyKg = Number(watch('qtyKg') || 0)
  const pricePerKg = Number(watch('pricePerKg') || 0)
  const total = qtyKg > 0 && pricePerKg > 0 ? +(qtyKg * pricePerKg).toFixed(2) : 0

  const stock = useQuery({
    queryKey: ['production-store-colors'],
    queryFn: async () => {
      const { data } = await api.get('/production/store/colors')
      return data.data as {
        masterbatches: AdditiveLot[]
        virginMaterials: AdditiveLot[]
      }
    },
  })

  const recentLots = useMemo(() => {
    const mb = stock.data?.masterbatches || []
    const virgin = stock.data?.virginMaterials || []
    return [...mb, ...virgin].slice(0, 12)
  }, [stock.data])

  const onSubmit = async (values: FormValues) => {
    setError('')
    setSuccess('')
    const qty = Number(values.qtyKg)
    const price = Number(values.pricePerKg)
    if (!values.name.trim()) {
      setError('Enter the type / name.')
      return
    }
    if (!(qty > 0)) {
      setError('Enter quantity in kg.')
      return
    }
    if (!(price > 0)) {
      setError('Enter price per kg.')
      return
    }

    setSubmitting(true)
    try {
      const { data } = await api.post('/production/store/purchase-additive', {
        kind: values.kind,
        name: values.name.trim(),
        qtyKg: qty,
        pricePerKg: price,
        supplierName: values.supplierName.trim() || undefined,
        notes: values.notes.trim() || undefined,
      })
      setSuccess(
        data.message ||
          `Purchased ${qty} kg into Material Store as ${data.data?.batchNumber || 'lot'}.`,
      )
      reset({
        kind: values.kind,
        name: '',
        qtyKg: '',
        pricePerKg: '',
        supplierName: values.supplierName,
        notes: '',
      })
      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store-colors'] })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { err?: string } } })?.response?.data?.err ||
        'Purchase failed.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout
      title="Buy additives"
      description="Purchase masterbatch or virgin material into the Material Store. They appear in the issue colour list."
      actions={
        <Button type="button" variant="outline" size="sm" className="h-9 text-xs" asChild>
          <Link to="/production/store">Material store</Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <ShoppingCart className="size-4 text-violet-600" />
            New purchase
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {success}{' '}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => navigate('/production/store')}
              >
                Open store
              </button>
            </p>
          ) : null}

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-zinc-600">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={cn(
                  'h-9 rounded-lg border text-xs font-semibold transition-colors',
                  kind === 'masterbatch'
                    ? 'border-violet-600 bg-violet-50 text-violet-800'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                )}
                onClick={() => setValue('kind', 'masterbatch')}
              >
                Masterbatch
              </button>
              <button
                type="button"
                className={cn(
                  'h-9 rounded-lg border text-xs font-semibold transition-colors',
                  kind === 'virgin'
                    ? 'border-violet-600 bg-violet-50 text-violet-800'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                )}
                onClick={() => setValue('kind', 'virgin')}
              >
                Virgin material
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-zinc-600">Type</label>
            <Input
              className="h-9 text-sm"
              placeholder={
                kind === 'masterbatch' ? 'e.g. Royal Blue' : 'e.g. Virgin PP / HDPE'
              }
              {...register('name')}
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Type the name — it shows in the material store colour select when issuing.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-600">
                Quantity (kg)
              </label>
              <Input
                type="number"
                step="any"
                min={0}
                className="h-9 text-sm"
                placeholder="0"
                {...register('qtyKg')}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-600">
                Price per kg
              </label>
              <Input
                type="number"
                step="any"
                min={0}
                className="h-9 text-sm"
                placeholder="0"
                {...register('pricePerKg')}
              />
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
            <span className="text-zinc-500">Total </span>
            <span className="font-mono font-bold tabular-nums text-zinc-900">
              ₦{total.toLocaleString()}
            </span>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-zinc-600">
              Supplier (optional)
            </label>
            <Input className="h-9 text-sm" placeholder="Supplier name" {...register('supplierName')} />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-zinc-600">
              Notes (optional)
            </label>
            <Input className="h-9 text-sm" placeholder="Invoice / remarks" {...register('notes')} />
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3">
            <Button type="submit" disabled={submitting} className="font-semibold">
              {submitting ? 'Saving…' : 'Purchase into store'}
            </Button>
          </div>
        </form>

        <aside className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-bold tracking-tight">In store now</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Available masterbatch and virgin lots for issue.
          </p>
          <ul className="mt-3 space-y-2">
            {stock.isLoading ? (
              <li className="text-xs text-zinc-500">Loading…</li>
            ) : recentLots.length === 0 ? (
              <li className="text-xs text-zinc-500">No purchased additives yet.</li>
            ) : (
              recentLots.map((lot) => (
                <li
                  key={lot.batchNumber}
                  className="rounded-lg border border-zinc-100 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-800">
                      {lot.kindLabel || (lot.type === 'virgin' ? 'Virgin' : 'Masterbatch')}
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {lot.qtyRemaining.toLocaleString()} kg
                    </span>
                  </div>
                  <p className="mt-0.5 text-zinc-700">{lot.colorName}</p>
                  <p className="font-mono text-[10px] text-zinc-400">
                    {lot.batchNumber}
                    {lot.businessDate ? ` · ${formatBusinessDate(lot.businessDate)}` : ''}
                    {lot.costPerKg > 0
                      ? ` · ₦${lot.costPerKg.toLocaleString()}/kg`
                      : ''}
                  </p>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </PageLayout>
  )
}
