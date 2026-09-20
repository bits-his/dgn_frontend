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
  sellingPrice?: number | string | null
  reorderLevel?: number | string | null
  standardMaterialPerUnit?: number | string | null
  qtyOnHand?: number
  stockValue?: number
  isActive?: boolean
}

type ProductFormState = {
  code: string
  name: string
  uom: string
  reorderLevel: string
  standardMaterialPerUnit: string
  sellingPrice: string
}

const emptyForm = (): ProductFormState => ({
  code: '',
  name: '',
  uom: 'pcs',
  reorderLevel: '',
  standardMaterialPerUnit: '',
  sellingPrice: '',
})

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function priceToInput(value: number | string | null | undefined) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return ''
  return String(n)
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
        code: form.code.trim(),
        name: form.name.trim(),
        uom: form.uom.trim() || 'pcs',
        isActive: true,
      }
      if (form.reorderLevel !== '') payload.reorderLevel = Number(form.reorderLevel)
      if (form.standardMaterialPerUnit !== '') {
        payload.standardMaterialPerUnit = Number(form.standardMaterialPerUnit)
      }
      const price = Number(form.sellingPrice)
      if (Number.isFinite(price) && price > 0) payload.sellingPrice = price

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
      code: row.code || '',
      name: row.name || '',
      uom: row.uom || 'pcs',
      reorderLevel: row.reorderLevel != null && row.reorderLevel !== '' ? String(row.reorderLevel) : '',
      standardMaterialPerUnit:
        row.standardMaterialPerUnit != null && row.standardMaterialPerUnit !== ''
          ? String(row.standardMaterialPerUnit)
          : '',
      sellingPrice: priceToInput(row.sellingPrice),
    })
    setError('')
    setFormOpen(true)
  }

  const openPrice = (row: ProductRow) => {
    setPriceTarget(row)
    setPriceDraft(priceToInput(row.sellingPrice))
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
        id: 'price',
        header: 'Unit price',
        cell: ({ row }) => {
          const n = Number(row.original.sellingPrice)
          return (
            <span className="text-xs tabular-nums font-medium text-zinc-800">
              {Number.isFinite(n) && n > 0 ? money(n) : '—'}
            </span>
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
      description="Create products, edit details, and set the selling price used on sales."
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

        {/* Mobile cards */}
        <div className="md:hidden space-y-2.5">
          {products.isLoading ? (
            <p className="text-xs text-zinc-500 py-8 text-center">Loading products…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">
              No products yet. Add your first product to set a selling price.
            </p>
          ) : (
            filtered.map((row) => {
              const price = Number(row.sellingPrice) || 0
              const qty = Number(row.qtyOnHand) || 0
              const value = Number(row.stockValue) || qty * price
              return (
                <article
                  key={row.id}
                  className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{row.name}</p>
                      <p className="text-[11px] font-mono text-zinc-500">{row.code}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500 shrink-0">
                      {row.uom}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="Stock" value={qtyLabel(row)} />
                    <Metric
                      label="Price"
                      value={price > 0 ? money(price) : '—'}
                    />
                    <Metric
                      label="Value"
                      value={value > 0 ? money(value) : '—'}
                    />
                  </div>

                  {canManage && (
                    <div className="flex gap-2 pt-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1 text-xs gap-1.5"
                        onClick={() => openPrice(row)}
                      >
                        <Tag className="size-3.5" />
                        Update price
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1 text-xs gap-1.5"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    </div>
                  )}
                </article>
              )
            })
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          {!products.isLoading && filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">
              No products yet. Add your first product to set a selling price.
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
                ? `Update details for ${editing.name}.`
                : 'Create a finished product and optionally set its selling price.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              setError('')
              setMessage('')
              if (!form.code.trim() || !form.name.trim()) {
                setError('Code and name are required')
                return
              }
              saveProduct.mutate()
            }}
            className="space-y-3.5"
          >
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="h-8 text-xs font-mono"
                placeholder="e.g. CUP-250"
                required
              />
            </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Unit</Label>
                <Input
                  value={form.uom}
                  onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="pcs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Reorder level</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.reorderLevel}
                  onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Material per unit (optional)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={form.standardMaterialPerUnit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, standardMaterialPerUnit: e.target.value }))
                }
                className="h-8 text-xs"
                placeholder="kg per unit"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Selling price</Label>
              <NairaAmountInput
                value={form.sellingPrice}
                onChange={(v) => setForm((f) => ({ ...f, sellingPrice: v }))}
                placeholder="0"
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
                disabled={saveProduct.isPending || !form.code.trim() || !form.name.trim()}
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
                ? `Set the selling price for ${priceTarget.name}. Sales will use this by default.`
                : null}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!priceTarget) return
              const sellingPrice = Number(priceDraft)
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
                    ? ` · Current ${money(Number(priceTarget.sellingPrice))}`
                    : ''}
                </p>
              </div>
            ) : null}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">New unit price</Label>
              <NairaAmountInput
                value={priceDraft}
                onChange={setPriceDraft}
                placeholder="0"
                required
              />
            </div>

            {priceTarget && Number(priceDraft) > 0 ? (
              <p className="text-[11px] text-zinc-500">
                Est. stock value:{' '}
                <span className="font-semibold text-zinc-800 tabular-nums">
                  {money((Number(priceTarget.qtyOnHand) || 0) * Number(priceDraft))}
                </span>
              </p>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-xs font-semibold tabular-nums text-zinc-900 truncate">{value}</p>
    </div>
  )
}
