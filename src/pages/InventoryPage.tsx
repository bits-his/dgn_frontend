import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, PackageCheck, Layers, Plus, ArrowRight, Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  dozenPriceFromUnit,
  fmtDozenPcs,
  pcsFromDozen,
  perDozenOf,
} from '@/lib/units'
import { SORT_COLORS } from '@/lib/sortColors'
import { cn } from '@/lib/utils'

const RM_STAGES = [
  {
    code: 'SCRAP',
    label: 'Scrap (unsorted)',
    location: 'RM-YARD',
    needsColor: false,
  },
  {
    code: 'SORT',
    label: 'Sorted',
    location: 'WIP-SORT',
    needsColor: true,
  },
  {
    code: 'CRUSH',
    label: 'Crushed',
    location: 'WIP-CRUSH',
    needsColor: true,
  },
  {
    code: 'WASH',
    label: 'Washed',
    location: 'WIP-WASH',
    needsColor: true,
  },
  {
    code: 'DRY',
    label: 'Re-crushed / store-ready',
    location: 'PROD-STORE',
    needsColor: true,
  },
  {
    code: 'RECYCLE',
    label: 'Recycle store (washed / bought)',
    location: 'RECYCLE-STORE',
    needsColor: true,
  },
] as const

type Overview = {
  totals: {
    rawMaterialQty: number
    wipQty: number
    finishedGoodsQty: number
    finishedGoodsValue?: number
  }
  currency?: string
  byMaterial: Array<{
    materialId: number
    code: string | null
    name: string
    qty: number
    uom: string
    reorderLevel?: number
    category?: string | null
    belowReorder?: boolean
  }>
  byProduct: Array<{
    productId: number
    code: string | null
    name: string
    qty: number
    uom: string
    sellingPrice?: number
    unitsPerDozen?: number
    stockValue?: number
    reorderLevel?: number
    belowReorder?: boolean
  }>
}

type ProductOption = {
  id: number
  name: string
  code: string
  uom?: string
  unitsPerDozen?: number | string | null
}

type MaterialOption = {
  id: number
  name: string
  code: string
  uom?: string
  category?: string | null
}

type TabKey = 'finished' | 'raw'

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function qtyLabel(qty: number, uom?: string | null) {
  const unit = String(uom || 'pcs').toLowerCase()
  if (unit === 'pcs' || unit === 'pc' || unit === 'unit' || unit === 'units') {
    return fmtDozenPcs(qty)
  }
  return `${fmt(qty)} ${uom || 'kg'}`
}

export function InventoryPage() {
  const user = useAuthStore((s) => s.user)
  const canAdjust = hasPermission(user, 'inventory.adjust')
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabKey>('finished')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const overview = useQuery({
    queryKey: ['inventory-overview'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/overview')
      return data.data as Overview
    },
  })

  const products = useQuery({
    queryKey: ['masters-products-pricing'],
    queryFn: async () => {
      const { data } = await api.get('/masters/products')
      return (data.data || []) as ProductOption[]
    },
    enabled: canAdjust && tab === 'finished',
  })

  const materials = useQuery({
    queryKey: ['masters-materials'],
    queryFn: async () => {
      const { data } = await api.get('/masters/materials')
      return (data.data || []) as MaterialOption[]
    },
    enabled: canAdjust && tab === 'raw',
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['inventory-overview'] })
    await queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
    await queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] })
    await queryClient.invalidateQueries({ queryKey: ['sellable-batches'] })
  }

  const finishedRows = useMemo(() => {
    const rows = overview.data?.byProduct || []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        String(r.code || '')
          .toLowerCase()
          .includes(q),
    )
  }, [overview.data?.byProduct, search])

  const rawRows = useMemo(() => {
    const rows = overview.data?.byMaterial || []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        String(r.code || '')
          .toLowerCase()
          .includes(q),
    )
  }, [overview.data?.byMaterial, search])

  const totals = overview.data?.totals
  const finishedTotal = Number(totals?.finishedGoodsQty || 0)
  const finishedValue = Number(totals?.finishedGoodsValue || 0)
  const rawTotal = Number(totals?.rawMaterialQty || 0) + Number(totals?.wipQty || 0)

  return (
    <PageLayout
      title="Inventory"
      description="Finished = recorded product stock · Raw = material on hand"
      actions={
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {canAdjust ? (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="size-3.5" />
              Initial stock
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold" asChild>
            <Link to="/inventory/ledger">
              <ClipboardList className="size-3.5" />
              Ledger
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Top category selector buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTab('finished')}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition-colors',
              tab === 'finished'
                ? 'border-emerald-300 bg-emerald-50/80 shadow-xs'
                : 'border-zinc-200 bg-white hover:bg-zinc-50',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Finished
              </span>
              <PackageCheck
                className={cn(
                  'size-3.5',
                  tab === 'finished' ? 'text-emerald-600' : 'text-zinc-400',
                )}
              />
            </div>
            <p className="mt-0.5 text-base font-bold tabular-nums text-zinc-900">
              {fmtDozenPcs(finishedTotal)}
            </p>
            {finishedValue > 0 ? (
              <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-emerald-700">
                {money(finishedValue)}
              </p>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('raw')}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition-colors',
              tab === 'raw'
                ? 'border-amber-300 bg-amber-50/80 shadow-xs'
                : 'border-zinc-200 bg-white hover:bg-zinc-50',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Raw material
              </span>
              <Layers
                className={cn('size-3.5', tab === 'raw' ? 'text-amber-600' : 'text-zinc-400')}
              />
            </div>
            <p className="mt-0.5 text-base font-bold tabular-nums text-zinc-900">
              {fmt(rawTotal)} kg
            </p>
          </button>
        </div>

        {/* Search bar with count */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'finished' ? 'Search product…' : 'Search material…'}
              className="h-8 pl-8 pr-7 text-xs bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          <span className="text-[11px] text-zinc-500 font-medium">
            {tab === 'finished' ? `${finishedRows.length} products` : `${rawRows.length} materials`}
          </span>
        </div>

        {/* Inventory Table / Cards Container (Account Statement Style) */}
        <article className="overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-xs sm:rounded-xl">
          <header className="space-y-2 border-b border-zinc-300 px-3 py-2.5 sm:space-y-0 sm:flex sm:items-start sm:justify-between sm:gap-3 sm:px-5 sm:py-3.5 bg-gradient-to-br from-zinc-50/80 via-white to-zinc-50/30">
            <div>
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                {tab === 'finished' ? 'Finished goods inventory' : 'Raw material stock'} ·{' '}
                {tab === 'finished' ? `${finishedRows.length} products` : `${rawRows.length} materials`}
              </p>
              <p className="mt-0.5 text-xs sm:text-sm font-semibold text-zinc-900">
                {tab === 'finished' ? 'Warehouse stock on hand & valuation' : 'Material storage & processing levels'}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-right">
              {tab === 'finished' ? (
                <>
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Total stock
                    </p>
                    <p className="mt-0.5 text-xs sm:text-sm font-bold tabular-nums text-zinc-900">
                      {fmtDozenPcs(finishedTotal)}
                    </p>
                  </div>
                  {finishedValue > 0 ? (
                    <div className="border-l border-zinc-200 pl-3 sm:pl-4">
                      <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Total value
                      </p>
                      <p className="mt-0.5 text-xs sm:text-sm font-black tabular-nums text-emerald-700">
                        {money(finishedValue)}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <div>
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Total weight
                  </p>
                  <p className="mt-0.5 text-xs sm:text-sm font-bold tabular-nums text-zinc-900">
                    {fmt(rawTotal)} kg
                  </p>
                </div>
              )}
            </div>
          </header>

          {/* Desktop Table (sm and up) */}
          <div className="hidden sm:block overflow-x-auto">
            <div className="w-full min-w-[640px]">
              {tab === 'finished' ? (
                <>
                  <div className="grid grid-cols-[minmax(200px,1.5fr)_7.5rem_8rem_8rem_6.5rem] items-center gap-x-4 border-b border-zinc-200 bg-zinc-50/90 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <span>Product</span>
                    <span className="text-right">Stock</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Value</span>
                    <span className="text-right">Movements</span>
                  </div>
                  {finishedRows.length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-zinc-500">
                      {overview.isLoading ? 'Loading products…' : 'No products found.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {finishedRows.map((prod) => {
                        const hasStock = prod.qty > 0.001
                        const unit = Number(prod.sellingPrice || 0)
                        const per = perDozenOf(prod.unitsPerDozen)
                        const value = Number(prod.stockValue || 0)
                        const belowReorder = Boolean(prod.belowReorder)
                        return (
                          <div
                            key={prod.productId}
                            className="grid grid-cols-[minmax(200px,1.5fr)_7.5rem_8rem_8rem_6.5rem] items-center gap-x-4 px-5 py-2.5 text-xs sm:text-sm hover:bg-zinc-50/80 transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-zinc-900 leading-tight">
                                  {prod.name}
                                </span>
                                {hasStock ? (
                                  belowReorder ? (
                                    <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200/80">
                                      Low stock
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/80">
                                      In stock
                                    </span>
                                  )
                                ) : (
                                  <span className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 border border-zinc-200/80">
                                    0 stock
                                  </span>
                                )}
                              </div>
                              {prod.code ? (
                                <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">
                                  {prod.code}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <span
                                className={cn(
                                  'tabular-nums whitespace-nowrap font-bold text-sm',
                                  hasStock ? 'text-emerald-700' : 'text-zinc-400 font-medium',
                                )}
                              >
                                {qtyLabel(prod.qty, prod.uom)}
                              </span>
                            </div>
                            <div className="text-right tabular-nums whitespace-nowrap leading-tight">
                              {unit > 0 ? (
                                <>
                                  <p className="font-semibold text-zinc-900 text-xs sm:text-sm">
                                    {money(dozenPriceFromUnit(unit, per))}/dz
                                  </p>
                                  <p className="text-[11px] text-zinc-500">{money(unit)}/pc</p>
                                </>
                              ) : (
                                <span className="text-xs text-zinc-400">—</span>
                              )}
                            </div>
                            <div className="text-right">
                              <span
                                className={cn(
                                  'tabular-nums whitespace-nowrap font-bold text-sm',
                                  value > 0 ? 'text-zinc-900' : 'text-zinc-300',
                                )}
                              >
                                {value > 0 ? money(value) : '—'}
                              </span>
                            </div>
                            <div className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-xs font-semibold hover:bg-zinc-100"
                                asChild
                              >
                                <Link to={`/inventory/products/${prod.productId}`}>
                                  Movements
                                </Link>
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-[minmax(220px,2fr)_8rem_8rem_7rem] items-center gap-x-4 border-b border-zinc-200 bg-zinc-50/90 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <span>Material</span>
                    <span className="text-right">Stock</span>
                    <span className="text-right">Reorder Level</span>
                    <span className="text-right">Status</span>
                  </div>
                  {rawRows.length === 0 ? (
                    <p className="px-5 py-8 text-center text-xs text-zinc-500">
                      {overview.isLoading ? 'Loading materials…' : 'No materials found.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {rawRows.map((mat) => {
                        const hasStock = mat.qty > 0.001
                        const belowReorder = Boolean(mat.belowReorder)
                        return (
                          <div
                            key={mat.materialId}
                            className="grid grid-cols-[minmax(220px,2fr)_8rem_8rem_7rem] items-center gap-x-4 px-5 py-2.5 text-xs sm:text-sm hover:bg-zinc-50/80 transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-zinc-900 leading-tight">
                                {mat.name}
                              </p>
                              {mat.code ? (
                                <span className="mt-0.5 block font-mono text-[11px] text-zinc-500">
                                  {mat.code}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <span
                                className={cn(
                                  'tabular-nums whitespace-nowrap font-bold text-sm',
                                  hasStock ? 'text-amber-800' : 'text-zinc-400 font-medium',
                                )}
                              >
                                {fmt(mat.qty)} {mat.uom || 'kg'}
                              </span>
                            </div>
                            <div className="text-right tabular-nums whitespace-nowrap text-zinc-500 text-xs sm:text-sm">
                              {mat.reorderLevel ? `${fmt(mat.reorderLevel)} ${mat.uom || 'kg'}` : '—'}
                            </div>
                            <div className="text-right">
                              {hasStock ? (
                                belowReorder ? (
                                  <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200/80">
                                    Low stock
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/80">
                                    In stock
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 border border-zinc-200/80">
                                  0 stock
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Mobile Cards View (< sm) */}
          <div className="sm:hidden space-y-2 p-2.5 bg-zinc-50/60">
            {tab === 'finished' ? (
              finishedRows.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500 bg-white rounded-lg border border-zinc-200">
                  {overview.isLoading ? 'Loading products…' : 'No products found.'}
                </p>
              ) : (
                finishedRows.map((prod) => {
                  const hasStock = prod.qty > 0.001
                  const unit = Number(prod.sellingPrice || 0)
                  const per = perDozenOf(prod.unitsPerDozen)
                  const value = Number(prod.stockValue || 0)
                  const belowReorder = Boolean(prod.belowReorder)
                  return (
                    <div
                      key={prod.productId}
                      className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-xs space-y-2.5"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-900 text-sm leading-snug">
                            {prod.name}
                          </p>
                          {prod.code ? (
                            <p className="font-mono text-[11px] text-zinc-500 mt-0.5">
                              {prod.code}
                            </p>
                          ) : null}
                        </div>
                        {hasStock ? (
                          belowReorder ? (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200 shrink-0">
                              Low stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shrink-0">
                              In stock
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 border border-zinc-200 shrink-0">
                            0 stock
                          </span>
                        )}
                      </div>

                      {/* Card Metrics Grid */}
                      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-zinc-50 border border-zinc-100 p-2 text-center">
                        <div>
                          <p className="text-[9.5px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Stock
                          </p>
                          <p
                            className={cn(
                              'mt-0.5 text-xs font-bold tabular-nums',
                              hasStock ? 'text-emerald-700' : 'text-zinc-400 font-medium',
                            )}
                          >
                            {qtyLabel(prod.qty, prod.uom)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9.5px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Price / dz
                          </p>
                          <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-900">
                            {unit > 0 ? money(dozenPriceFromUnit(unit, per)) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9.5px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Value
                          </p>
                          <p className="mt-0.5 text-xs font-bold tabular-nums text-zinc-900">
                            {value > 0 ? money(value) : '—'}
                          </p>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-xs">
                        <span className="text-[11px] text-zinc-500">
                          {unit > 0 ? `${money(unit)} / pc` : 'No price set'}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs font-semibold hover:bg-zinc-100"
                          asChild
                        >
                          <Link to={`/inventory/products/${prod.productId}`}>
                            <span>Movements</span>
                            <ArrowRight className="size-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )
                })
              )
            ) : (
              rawRows.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500 bg-white rounded-lg border border-zinc-200">
                  {overview.isLoading ? 'Loading materials…' : 'No materials found.'}
                </p>
              ) : (
                rawRows.map((mat) => {
                  const hasStock = mat.qty > 0.001
                  const belowReorder = Boolean(mat.belowReorder)
                  return (
                    <div
                      key={mat.materialId}
                      className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-900 text-sm leading-snug">
                            {mat.name}
                          </p>
                          {mat.code ? (
                            <p className="font-mono text-[11px] text-zinc-500 mt-0.5">
                              {mat.code}
                            </p>
                          ) : null}
                        </div>
                        {hasStock ? (
                          belowReorder ? (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200 shrink-0">
                              Low stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 shrink-0">
                              In stock
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 border border-zinc-200 shrink-0">
                            0 stock
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 border border-zinc-100 p-2 text-center">
                        <div>
                          <p className="text-[9.5px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Stock on hand
                          </p>
                          <p
                            className={cn(
                              'mt-0.5 text-xs font-bold tabular-nums',
                              hasStock ? 'text-amber-800' : 'text-zinc-400 font-medium',
                            )}
                          >
                            {fmt(mat.qty)} {mat.uom || 'kg'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9.5px] font-semibold text-zinc-500 uppercase tracking-wider">
                            Reorder Level
                          </p>
                          <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-600">
                            {mat.reorderLevel ? `${fmt(mat.reorderLevel)} ${mat.uom || 'kg'}` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )
            )}
          </div>
        </article>
      </div>

      {tab === 'finished' ? (
        <InitialStockDialog
          open={addOpen}
          products={products.data || []}
          onClose={() => setAddOpen(false)}
          onDone={async () => {
            setAddOpen(false)
            await refresh()
          }}
        />
      ) : (
        <InitialRmStockDialog
          open={addOpen}
          materials={materials.data || []}
          onClose={() => setAddOpen(false)}
          onDone={async () => {
            setAddOpen(false)
            await refresh()
          }}
        />
      )}
    </PageLayout>
  )
}

function InitialStockDialog({
  open,
  products,
  onClose,
  onDone,
}: {
  open: boolean
  products: ProductOption[]
  onClose: () => void
  onDone: () => void
}) {
  const [productId, setProductId] = useState('')
  const [dozen, setDozen] = useState('')
  const [pcs, setPcs] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const selected = products.find((p) => String(p.id) === productId)
  const per = perDozenOf(selected?.unitsPerDozen)
  const totalPcs = pcsFromDozen(dozen || 0, per) + Math.round(Number(pcs) || 0)

  const resetForm = () => {
    setProductId('')
    setDozen('')
    setPcs('')
    setNotes('')
    setError('')
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/inventory/initial-stock', {
        productId: Number(productId),
        qty: totalPcs,
        notes: notes.trim() || undefined,
      })
      return data
    },
    onSuccess: () => {
      resetForm()
      onDone()
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { err?: string; errors?: Record<string, string> } }
      }
      setError(
        e.response?.data?.err ||
        (e.response?.data?.errors
          ? Object.values(e.response.data.errors).join(', ')
          : null) ||
        'Could not add initial stock',
      )
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add initial stock</DialogTitle>
          <DialogDescription>
            Create opening finished-goods stock from a product in the system.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            if (!productId) {
              setError('Select a product')
              return
            }
            if (!(totalPcs > 0)) {
              setError('Enter dozen and/or pieces greater than zero')
              return
            }
            save.mutate()
          }}
        >
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Product</Label>
            <Select value={productId || undefined} onValueChange={setProductId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select product…" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                    {p.code ? ` · ${p.code}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-950">Quantity</span>
              <span className="text-xs font-black text-emerald-800 tabular-nums">
                = {fmtDozenPcs(totalPcs, per)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Dozen (dz)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  className="h-9 text-xs font-bold tabular-nums"
                  placeholder="0"
                  value={dozen}
                  onChange={(e) => setDozen(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Pieces (pcs)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min={0}
                  className="h-9 text-xs font-bold tabular-nums"
                  placeholder="0"
                  value={pcs}
                  onChange={(e) => setPcs(e.target.value)}
                />
              </div>
            </div>
            {selected ? (
              <p className="text-[10px] text-emerald-800/80">
                {per} pcs per dozen
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Notes (optional)</Label>
            <Input
              className="h-9 text-xs"
              placeholder="e.g. Opening balance"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs font-semibold" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Add stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function InitialRmStockDialog({
  open,
  materials,
  onClose,
  onDone,
}: {
  open: boolean
  materials: MaterialOption[]
  onClose: () => void
  onDone: () => void
}) {
  const [materialId, setMaterialId] = useState('')
  const [stage, setStage] = useState<(typeof RM_STAGES)[number]['code']>('CRUSH')
  const [sortColor, setSortColor] = useState('')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const stageCfg = RM_STAGES.find((s) => s.code === stage) || RM_STAGES[2]
  const amount = Number(qty) || 0

  const resetForm = () => {
    setMaterialId('')
    setStage('CRUSH')
    setSortColor('')
    setQty('')
    setNotes('')
    setError('')
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/inventory/initial-stock-rm', {
        materialId: Number(materialId),
        qty: amount,
        stage,
        sortColor: stageCfg.needsColor ? sortColor : undefined,
        notes: notes.trim() || undefined,
      })
      return data
    },
    onSuccess: () => {
      resetForm()
      onDone()
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { err?: string; errors?: Record<string, string> } }
      }
      setError(
        e.response?.data?.err ||
        (e.response?.data?.errors
          ? Object.values(e.response.data.errors).join(', ')
          : null) ||
        'Could not add initial stock',
      )
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add raw material stock</DialogTitle>
          <DialogDescription>
            Opening lot with material, colour, and the stage it is already at.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            if (!materialId) {
              setError('Select a material')
              return
            }
            if (!(amount > 0)) {
              setError('Enter kg greater than zero')
              return
            }
            if (stageCfg.needsColor && !sortColor) {
              setError('Select a colour for this stage')
              return
            }
            save.mutate()
          }}
        >
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Material</Label>
            <Select value={materialId || undefined} onValueChange={setMaterialId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select material…" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                    {m.code ? ` · ${m.code}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Stage right now</Label>
            <Select
              value={stage}
              onValueChange={(v) => {
                setStage(v as (typeof RM_STAGES)[number]['code'])
                const next = RM_STAGES.find((s) => s.code === v)
                if (next && !next.needsColor) setSortColor('')
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RM_STAGES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-zinc-500">
              Lands in <span className="font-mono font-semibold">{stageCfg.location}</span>
            </p>
          </div>

          {stageCfg.needsColor ? (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Colour</Label>
              <Select value={sortColor || undefined} onValueChange={setSortColor}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select colour…" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_COLORS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600">
              Unsorted scrap has no colour yet — sort it later on the floor.
            </p>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Quantity (kg)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              className="h-9 text-xs font-bold tabular-nums"
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Notes (optional)</Label>
            <Input
              className="h-9 text-xs"
              placeholder="e.g. Opening balance"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs font-semibold" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Add stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
