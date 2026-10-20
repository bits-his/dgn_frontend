import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardList, PackageCheck, Layers, Plus } from 'lucide-react'
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
import CustomTable1 from '@/components/CustomTable1'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { fmtDozenPcs, pcsFromDozen, perDozenOf } from '@/lib/units'
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
    label: 'Recycled pellets',
    location: 'PROD-STORE',
    needsColor: true,
  },
] as const

type Overview = {
  totals: {
    rawMaterialQty: number
    wipQty: number
    finishedGoodsQty: number
  }
  byMaterial: Array<{
    materialId: number
    code: string | null
    name: string
    qty: number
    uom: string
  }>
  byProduct: Array<{
    productId: number
    code: string | null
    name: string
    qty: number
    uom: string
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

  const finishedColumns = useMemo<ColumnDef<Overview['byProduct'][number]>[]>(
    () => [
      {
        id: 'name',
        header: 'Product',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">{row.original.name}</p>
            {row.original.code ? (
              <p className="text-[11px] font-mono text-zinc-500">{row.original.code}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'qty',
        header: 'Stock',
        cell: ({ row }) => (
          <span className="text-sm font-bold tabular-nums text-emerald-700">
            {qtyLabel(row.original.qty, row.original.uom)}
          </span>
        ),
      },
    ],
    [],
  )

  const rawColumns = useMemo<ColumnDef<Overview['byMaterial'][number]>[]>(
    () => [
      {
        id: 'name',
        header: 'Material',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">{row.original.name}</p>
            {row.original.code ? (
              <p className="text-[11px] font-mono text-zinc-500">{row.original.code}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'qty',
        header: 'Stock',
        cell: ({ row }) => (
          <span className="text-sm font-bold tabular-nums text-amber-700">
            {fmt(row.original.qty)} {row.original.uom || 'kg'}
          </span>
        ),
      },
    ],
    [],
  )

  const totals = overview.data?.totals
  const finishedTotal = Number(totals?.finishedGoodsQty || 0)
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
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTab('finished')}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition-colors',
              tab === 'finished'
                ? 'border-emerald-300 bg-emerald-50/80'
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
          </button>
          <button
            type="button"
            onClick={() => setTab('raw')}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition-colors',
              tab === 'raw'
                ? 'border-amber-300 bg-amber-50/80'
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

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === 'finished' ? 'Search product…' : 'Search material…'}
          className="h-8 max-w-xs text-xs"
        />

        <div className="overflow-x-auto">
          {tab === 'finished' ? (
            <CustomTable1
              data={finishedRows}
              columns={finishedColumns}
              loading={overview.isLoading}
            />
          ) : (
            <CustomTable1 data={rawRows} columns={rawColumns} loading={overview.isLoading} />
          )}
        </div>
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
