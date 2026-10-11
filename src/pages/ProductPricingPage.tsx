import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Search, Tag } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NairaAmountInput } from '@/components/ui'
import CustomTable1 from '@/components/CustomTable1'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { fmtDozenPcs } from '@/lib/units'
import { cn } from '@/lib/utils'

type ProductRow = {
  id: number
  code: string
  name: string
  uom: string
  unitsPerDozen?: number | string | null
  sellingPrice?: number | string | null
  averageWeight?: number | string | null
  qtyOnHand?: number
  stockValue?: number
  isActive?: boolean
}

type ProductFormState = {
  name: string
  averageWeight: string
}

const emptyForm = (): ProductFormState => ({
  name: '',
  averageWeight: '',
})

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function priceToInput(value: number | string | null | undefined) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return String(n)
}

function perDozenOf(row: { unitsPerDozen?: number | string | null } | null | undefined) {
  const n = Number(row?.unitsPerDozen)
  return Number.isFinite(n) && n > 0 ? n : 12
}

function unitPriceFromDozen(pricePerDozen: number, perDozen: number) {
  if (!(pricePerDozen > 0) || !(perDozen > 0)) return 0
  return +(pricePerDozen / perDozen).toFixed(2)
}

function dozenPriceFromUnit(unitPrice: number, perDozen: number) {
  if (!(unitPrice > 0) || !(perDozen > 0)) return 0
  return +(unitPrice * perDozen).toFixed(2)
}

function qtyLabel(row: ProductRow) {
  const qty = Number(row.qtyOnHand) || 0
  const uom = String(row.uom || 'pcs').toLowerCase()
  if (uom === 'pcs' || uom === 'pc' || uom === 'unit' || uom === 'units') {
    return fmtDozenPcs(qty)
  }
  return `${qty.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${row.uom || ''}`
}

function axiosErr(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { err?: string; msg?: string } }; message?: string }
  return e.response?.data?.err || e.response?.data?.msg || e.message || fallback
}

export function ProductPricingPage() {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const canManage =
    hasPermission(user, 'sales.create') || hasPermission(user, 'masters.manage')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductRow | null>(null)
  const [priceTarget, setPriceTarget] = useState<ProductRow | null>(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [form, setForm] = useState<ProductFormState>(emptyForm())
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const products = useQuery({
    queryKey: ['masters-products-pricing'],
    queryFn: async () => {
      const { data } = await api.get('/masters/products')
      return (data.data || []) as ProductRow[]
    },
  })

  const filtered = useMemo(() => {
    const rows = products.data || []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.code || '')
          .toLowerCase()
          .includes(q),
    )
  }, [products.data, search])

  const totals = useMemo(() => {
    const rows = filtered
    const qty = rows.reduce((sum, r) => sum + (Number(r.qtyOnHand) || 0), 0)
    const value = rows.reduce((sum, r) => {
      const price = Number(r.sellingPrice) || 0
      const onHand = Number(r.qtyOnHand) || 0
      return sum + (Number(r.stockValue) || onHand * price)
    }, 0)
    return { qty, value, count: rows.length }
  }, [filtered])

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['masters-products-pricing'] })
    await qc.invalidateQueries({ queryKey: ['masters', 'products'] })
    await qc.invalidateQueries({ queryKey: ['sellable-batches'] })
    await qc.invalidateQueries({ queryKey: ['outlet-overview'] })
  }

  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        isActive: true,
      }
      const avg = Number(form.averageWeight)
      if (Number.isFinite(avg) && avg > 0) payload.averageWeight = avg
      else if (editing) payload.averageWeight = 0

      if (editing) {
        const { data } = await api.patch(`/masters/products/${editing.id}`, payload)
        return data.data as ProductRow
      }
      const { data } = await api.post('/masters/products', payload)
      return data.data as ProductRow
    },
    onSuccess: async () => {
      setError('')
      setMessage(editing ? 'Product updated' : 'Product created')
      setFormOpen(false)
      setEditing(null)
      setForm(emptyForm())
      await invalidate()
    },
    onError: (err: unknown) => setError(axiosErr(err, 'Could not save product')),
  })

  const savePrice = useMutation({
    mutationFn: async ({ id, sellingPrice }: { id: number; sellingPrice: number }) => {
      const { data } = await api.patch(`/masters/products/${id}/selling-price`, { sellingPrice })
      return data.data as ProductRow
    },
    onSuccess: async () => {
      setError('')
      setMessage('Price updated')
      setPriceTarget(null)
      setPriceDraft('')
      await invalidate()
    },
    onError: (err: unknown) => setError(axiosErr(err, 'Could not save price')),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setError('')
    setFormOpen(true)
  }

  const openEdit = (row: ProductRow) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      averageWeight:
        row.averageWeight != null && Number(row.averageWeight) > 0
          ? String(row.averageWeight)
          : '',
    })
    setError('')
    setFormOpen(true)
  }

  const openPrice = (row: ProductRow) => {
    setPriceTarget(row)
    const per = perDozenOf(row)
    const unit = Number(row.sellingPrice) || 0
    setPriceDraft(priceToInput(dozenPriceFromUnit(unit, per)))
    setError('')
  }

  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        id: 'product',
        header: 'Product',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold text-zinc-900">{row.original.name}</p>
            <p className="text-[11px] font-mono text-zinc-500">{row.original.code}</p>
          </div>
        ),
      },
      {
        id: 'qty',
        header: 'Stock',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums font-medium text-zinc-800">
            {qtyLabel(row.original)}
          </span>
        ),
      },
      {
        id: 'avgWeight',
        header: 'Avg weight',
        cell: ({ row }) => {
          const w = Number(row.original.averageWeight)
          if (!Number.isFinite(w) || !(w > 0)) {
            return <span className="text-xs text-zinc-400">—</span>
          }
          return (
            <span className="text-xs tabular-nums font-medium text-zinc-800">
              {w.toLocaleString(undefined, { maximumFractionDigits: 3 })} g
            </span>
          )
        },
      },
      {
        id: 'price',
        header: 'Price',
        cell: ({ row }) => {
          const unit = Number(row.original.sellingPrice)
          if (!Number.isFinite(unit) || unit <= 0) {
            return <span className="text-xs text-zinc-400">—</span>
          }
          const per = perDozenOf(row.original)
          const dozen = dozenPriceFromUnit(unit, per)
          return (
            <div className="space-y-0.5">
              <p className="text-xs tabular-nums font-semibold text-zinc-900">{money(dozen)}/dz</p>
              <p className="text-[11px] tabular-nums text-zinc-500">{money(unit)}/pc</p>
            </div>
          )
        },
      },
      {
        id: 'value',
        header: 'Stock value',
        cell: ({ row }) => {
          const price = Number(row.original.sellingPrice) || 0
          const qty = Number(row.original.qtyOnHand) || 0
          const value = Number(row.original.stockValue) || qty * price
          return (
            <span className="text-xs tabular-nums font-semibold text-zinc-900">
              {value > 0 ? money(value) : '—'}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1"
              disabled={!canManage}
              onClick={() => openPrice(row.original)}
            >
              <Tag className="size-3.5" />
              Price
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1"
              disabled={!canManage}
              onClick={() => openEdit(row.original)}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [canManage],
  )

  return (
    <PageLayout
      title="Product pricing"
      description="Create products, set average weight, and price per dozen when ready."
      actions={
        canManage ? (
          <Button
            size="sm"
            className="h-8 px-3 text-xs font-semibold gap-1.5"
            onClick={openCreate}
          >
            <Plus className="size-3.5" />
            Add product
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <SummaryTile label="Products" value={String(totals.count)} />
          <SummaryTile label="Total stock" value={fmtDozenPcs(totals.qty)} />
          <SummaryTile
            label="Stock value"
            value={money(totals.value)}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product or code"
              className="pl-8 h-9 text-xs"
            />
          </div>
          {!canManage && (
            <p className="text-xs text-amber-700">
              You can view prices but need sales access to change them.
            </p>
          )}
        </div>

        {(error || message) && (
          <p
            className={cn(
              'text-xs rounded-md px-3 py-2 border',
              error
                ? 'text-red-600 bg-red-50 border-red-100'
                : 'text-emerald-700 bg-emerald-50 border-emerald-100',
            )}
          >
            {error || message}
          </p>
        )}

        <div className="overflow-x-auto">
          {!products.isLoading && filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">
              No products yet. Add your first product to get started.
            </p>
          ) : (
            <CustomTable1 data={filtered} columns={columns} loading={products.isLoading} />
          )}
        </div>
      </div>

      {/* Create / edit product */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false)
            setEditing(null)
            setForm(emptyForm())
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit product' : 'Add product'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Update ${editing.name}. Set selling price separately with Price.`
                : 'Enter the product name and average weight. Price can be set later.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              setError('')
              setMessage('')
              if (!form.name.trim()) {
                setError('Name is required')
                return
              }
              saveProduct.mutate()
            }}
            className="space-y-3.5"
          >
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-8 text-xs"
                placeholder="Product name"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Average weight (g)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                value={form.averageWeight}
                onChange={(e) => setForm((f) => ({ ...f, averageWeight: e.target.value }))}
                className="h-8 text-xs"
                placeholder="e.g. 12.5"
              />
            </div>

            {error && formOpen ? (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {error}
              </p>
            ) : null}

            <DialogFooter className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setFormOpen(false)
                  setEditing(null)
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs font-semibold"
                disabled={saveProduct.isPending || !form.name.trim()}
              >
                {saveProduct.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update price modal — keeps focus stable */}
      <Dialog
        open={Boolean(priceTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setPriceTarget(null)
            setPriceDraft('')
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update price</DialogTitle>
            <DialogDescription>
              {priceTarget
                ? `Enter price per dozen for ${priceTarget.name}. Unit price is calculated automatically.`
                : null}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!priceTarget) return
              const pricePerDozen = Number(priceDraft)
              if (!(pricePerDozen > 0)) {
                setError('Price must be greater than zero')
                return
              }
              const sellingPrice = unitPriceFromDozen(pricePerDozen, perDozenOf(priceTarget))
              if (!(sellingPrice > 0)) {
                setError('Price must be greater than zero')
                return
              }
              setError('')
              setMessage('')
              savePrice.mutate({ id: priceTarget.id, sellingPrice })
            }}
            className="space-y-3.5"
          >
            {priceTarget ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs space-y-1">
                <p className="font-semibold text-zinc-900">{priceTarget.name}</p>
                <p className="text-zinc-500">
                  Stock {qtyLabel(priceTarget)}
                  {Number(priceTarget.sellingPrice) > 0
                    ? ` · Current ${money(dozenPriceFromUnit(Number(priceTarget.sellingPrice), perDozenOf(priceTarget)))}/dz · ${money(Number(priceTarget.sellingPrice))}/pc`
                    : ''}
                </p>
              </div>
            ) : null}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Price per dozen</Label>
              <NairaAmountInput
                value={priceDraft}
                onChange={setPriceDraft}
                placeholder="0"
                required
              />
            </div>

            {priceTarget && Number(priceDraft) > 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] space-y-1">
                <p className="text-zinc-500">
                  Unit price{' '}
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {money(unitPriceFromDozen(Number(priceDraft), perDozenOf(priceTarget)))}
                  </span>
                  {' '}/ pc
                </p>
                <p className="text-zinc-500">
                  Est. stock value{' '}
                  <span className="font-semibold tabular-nums text-zinc-800">
                    {money(
                      (Number(priceTarget.qtyOnHand) || 0) *
                        unitPriceFromDozen(Number(priceDraft), perDozenOf(priceTarget)),
                    )}
                  </span>
                </p>
              </div>
            ) : null}

            {error && priceTarget ? (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setPriceTarget(null)
                  setPriceDraft('')
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs font-semibold"
                disabled={savePrice.isPending || !(Number(priceDraft) > 0)}
              >
                {savePrice.isPending ? 'Saving…' : 'Save price'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

function SummaryTile({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-xs',
        className,
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900">{value}</p>
    </div>
  )
}
