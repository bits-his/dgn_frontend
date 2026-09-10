import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  ArrowRightLeft,
  ClipboardList,
  SlidersHorizontal,
  Layers,
  Hammer,
  PackageCheck,
  DollarSign,
  MapPin,
  Boxes,
  Package,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, StatPill } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CustomTable1 from '@/components/CustomTable1'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

type StockLine = {
  id: number
  qtyOnHand: number
  uom: string
  locationId: number
  locationCode: string | null
  locationName: string | null
  locationType: string | null
  materialName: string | null
  productName: string | null
  batchNumber: string | null
  batchType: string | null
  ageDays: number | null
}

type Overview = {
  totals: {
    lines: number
    rawMaterialQty: number
    wipQty: number
    finishedGoodsQty: number
    stockValue: number
    unvaluedLines: number
  }
  byLocation: Array<{
    locationId: number
    code: string | null
    name: string
    locationType: string
    qty: number
    lines: number
    uom: string
  }>
  byMaterial: Array<{
    materialId: number
    code: string | null
    name: string
    qty: number
    uom: string
    reorderLevel: number
    belowReorder: boolean
  }>
  byProduct: Array<{
    productId: number
    code: string | null
    name: string
    qty: number
    uom: string
    reorderLevel: number
    belowReorder: boolean
  }>
  currency: string
}

type Alerts = {
  ageingDaysThreshold: number
  counts: { lowStock: number; ageing: number; negative: number }
  lowStock: Array<{
    kind: string
    code: string | null
    name: string
    qty: number
    uom: string
    reorderLevel: number
    shortfall: number
    severity: string
  }>
  ageing: StockLine[]
  negative: StockLine[]
}

type MasterItem = { id: number; name: string; code?: string }

const REASON_LABELS: Record<string, string> = {
  STOCK_COUNT: 'Physical count difference',
  DAMAGE: 'Damaged stock',
  SPILLAGE: 'Spillage',
  THEFT: 'Theft / missing',
  DATA_ENTRY_ERROR: 'Data entry error',
  MOISTURE_LOSS: 'Moisture loss',
  OTHER: 'Other',
}

function fmt(n: number) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function InventoryPage() {
  const user = useAuthStore((s) => s.user)
  const canAdjust = hasPermission(user, 'inventory.adjust')
  const queryClient = useQueryClient()

  const [locationFilter, setLocationFilter] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [viewMode, setViewMode] = useState<'lines' | 'location' | 'material' | 'product'>('lines')
  const [panel, setPanel] = useState<{ mode: 'adjust' | 'transfer'; line: StockLine } | null>(null)

  const overview = useQuery({
    queryKey: ['inventory-overview'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/overview')
      return data.data as Overview
    },
  })

  const alerts = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/alerts')
      return data.data as Alerts
    },
  })

  const locations = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data } = await api.get('/masters/locations')
      return data.data as MasterItem[]
    },
  })

  const balances = useQuery({
    queryKey: ['inventory-balances', locationFilter, batchFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (locationFilter) params.set('locationId', locationFilter)
      if (batchFilter) params.set('batchNumber', batchFilter)
      const { data } = await api.get(`/inventory/balances?${params.toString()}`)
      return data.data as StockLine[]
    },
  })

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-overview'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
  }

  const totals = overview.data?.totals
  const alertCount = alerts.data
    ? alerts.data.counts.lowStock + alerts.data.counts.ageing + alerts.data.counts.negative
    : 0

  const columns = useMemo<ColumnDef<StockLine>[]>(
    () => [
      {
        id: 'batchNumber',
        header: 'Batch',
        cell: ({ row }) => {
          const line = row.original
          return line.batchNumber ? (
            <Link
              to={`/batches/${line.batchNumber}`}
              className="font-semibold text-xs text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              {line.batchNumber}
            </Link>
          ) : (
            <span className="text-zinc-400 text-xs">—</span>
          )
        },
      },
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <span className="font-medium text-xs text-zinc-800">
            {row.original.productName || row.original.materialName || '—'}
          </span>
        ),
      },
      {
        id: 'location',
        header: 'Location',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600">
            {row.original.locationName || '—'}
          </span>
        ),
      },
      {
        id: 'qtyOnHand',
        header: 'On Hand',
        cell: ({ row }) => (
          <span className="font-semibold text-xs tabular-nums text-zinc-800">
            {fmt(row.original.qtyOnHand)} {row.original.uom}
          </span>
        ),
      },
      {
        id: 'age',
        header: 'Age',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 tabular-nums">
            {row.original.ageDays != null ? `${row.original.ageDays}d` : '—'}
          </span>
        ),
      },
      ...(canAdjust
        ? [
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }: { row: { original: StockLine } }) => {
                const line = row.original
                return (
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
                      onClick={() => setPanel({ mode: 'adjust', line })}
                    >
                      <SlidersHorizontal className="size-3.5 shrink-0" />
                      <span>Adjust</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
                      onClick={() => setPanel({ mode: 'transfer', line })}
                    >
                      <ArrowRightLeft className="size-3.5 shrink-0" />
                      <span>Transfer</span>
                    </Button>
                  </div>
                )
              },
            } as ColumnDef<StockLine>,
          ]
        : []),
    ],
    [canAdjust]
  )

  const locationColumns = useMemo<ColumnDef<Overview['byLocation'][number]>[]>(
    () => [
      {
        id: 'name',
        header: 'Location',
        cell: ({ row }) => (
          <span className="font-medium text-xs text-zinc-900 flex items-center gap-1.5">
            <MapPin className="size-3.5 text-zinc-400 shrink-0" />
            <span>{row.original.name}</span>
          </span>
        ),
      },
      {
        id: 'locationType',
        header: 'Type',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 capitalize">
            {row.original.locationType.toLowerCase()}
          </span>
        ),
      },
      {
        id: 'lines',
        header: 'Active Lines',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-600 font-medium">
            {row.original.lines}
          </span>
        ),
      },
      {
        id: 'qty',
        header: 'On Hand Quantity',
        cell: ({ row }) => (
          <span className="text-xs font-semibold tabular-nums text-zinc-900">
            {fmt(row.original.qty)} {row.original.uom}
          </span>
        ),
      },
    ],
    []
  )

  const materialColumns = useMemo<ColumnDef<Overview['byMaterial'][number]>[]>(
    () => [
      {
        id: 'name',
        header: 'Material',
        cell: ({ row }) => (
          <span className="font-medium text-xs text-zinc-900 flex items-center gap-1.5">
            <Boxes className="size-3.5 text-zinc-400 shrink-0" />
            <span>{row.original.name}</span>
          </span>
        ),
      },
      {
        id: 'reorderLevel',
        header: 'Reorder Level',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-500">
            {fmt(row.original.reorderLevel)} {row.original.uom}
          </span>
        ),
      },
      {
        id: 'qty',
        header: 'On Hand Quantity',
        cell: ({ row }) => (
          <span
            className={`text-xs font-semibold tabular-nums ${
              row.original.belowReorder ? 'text-red-700' : 'text-zinc-900'
            }`}
          >
            {fmt(row.original.qty)} {row.original.uom}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.belowReorder ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
              Low Stock
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Adequate
            </span>
          ),
      },
    ],
    []
  )

  const productColumns = useMemo<ColumnDef<Overview['byProduct'][number]>[]>(
    () => [
      {
        id: 'name',
        header: 'Product',
        cell: ({ row }) => (
          <span className="font-medium text-xs text-zinc-900 flex items-center gap-1.5">
            <Package className="size-3.5 text-zinc-400 shrink-0" />
            <span>{row.original.name}</span>
          </span>
        ),
      },
      {
        id: 'reorderLevel',
        header: 'Reorder Level',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-500">
            {fmt(row.original.reorderLevel)} {row.original.uom}
          </span>
        ),
      },
      {
        id: 'qty',
        header: 'On Hand Quantity',
        cell: ({ row }) => (
          <span
            className={`text-xs font-semibold tabular-nums ${
              row.original.belowReorder ? 'text-red-700' : 'text-zinc-900'
            }`}
          >
            {fmt(row.original.qty)} {row.original.uom}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.belowReorder ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
              Low Stock
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Adequate
            </span>
          ),
      },
    ],
    []
  )

  return (
    <PageLayout
      title="Stock visibility"
      description="Inventory · Balances, locations, alerts, and reorder levels"
      actions={
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center" asChild>
          <Link to="/inventory/ledger" className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <ClipboardList className="size-3.5 shrink-0" />
            <span>Movement ledger</span>
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-xl sm:rounded-2xl border border-zinc-200/80 bg-white p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1 sm:mb-1.5">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500 truncate">Raw Material</span>
            <div className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-amber-50 text-amber-600">
              <Layers className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 truncate">{fmt(totals?.rawMaterialQty ?? 0)} kg</div>
          <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-400 truncate">Scrap & sorted stock</p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-zinc-200/80 bg-white p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1 sm:mb-1.5">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500 truncate">Work in Progress</span>
            <div className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-slate-50 text-slate-600">
              <Hammer className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 truncate">{fmt(totals?.wipQty ?? 0)} kg</div>
          <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-400 truncate">Crushed, washed & drying</p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-zinc-200/80 bg-white p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1 sm:mb-1.5">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500 truncate">Finished Goods</span>
            <div className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600">
              <PackageCheck className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 truncate">{fmt(totals?.finishedGoodsQty ?? 0)} pcs</div>
          <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-400 truncate">Manufactured outputs</p>
        </div>

        <div className="rounded-xl sm:rounded-2xl border border-zinc-200/80 bg-white p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1 sm:mb-1.5">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500 truncate">Stock Value</span>
            <div className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-teal-50 text-teal-600">
              <DollarSign className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 truncate">₦{fmt(totals?.stockValue ?? 0)}</div>
          <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-400 truncate">Inventory valuation</p>
        </div>

        <div className="col-span-2 sm:col-span-2 lg:col-span-1 xl:col-span-1 rounded-xl sm:rounded-2xl border border-zinc-200/80 bg-white p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1 sm:mb-1.5">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500 truncate">Open Alerts</span>
            <div className={`flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ${alertCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertTriangle className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div className={`text-base sm:text-xl font-bold tracking-tight truncate ${alertCount > 0 ? 'text-red-700' : 'text-zinc-900'}`}>
            {alertCount}
          </div>
          <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-400 truncate">
            {alertCount > 0 ? `${alertCount} items need attention` : 'All levels nominal'}
          </p>
        </div>
      </div>

      {alerts.data && alertCount > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50/70 !p-4">
          <div className="flex items-center gap-2 text-amber-950">
            <AlertTriangle className="size-4.5 text-amber-700" />
            <h2 className="text-sm font-semibold tracking-tight">Attention needed ({alertCount} alerts)</h2>
          </div>
          <div className="mt-3 space-y-3 text-xs text-amber-950">
            {alerts.data.lowStock.length > 0 && (
              <div>
                <p className="font-semibold text-amber-900 mb-1">Below reorder level</p>
                <ul className="space-y-1">
                  {alerts.data.lowStock.map((item) => (
                    <li key={`${item.kind}-${item.code}`} className="flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-amber-700" />
                      <span>
                        <strong className="font-semibold">{item.name}</strong>: {fmt(item.qty)} {item.uom} on hand (min {fmt(item.reorderLevel)} {item.uom}, short by {fmt(item.shortfall)} {item.uom})
                        {item.severity === 'CRITICAL' && <span className="ml-1.5 font-bold text-red-700">(Out of Stock)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alerts.data.ageing.length > 0 && (
              <div>
                <p className="font-semibold text-amber-900 mb-1">Sitting longer than {alerts.data.ageingDaysThreshold} days</p>
                <ul className="space-y-1">
                  {alerts.data.ageing.slice(0, 5).map((line) => (
                    <li key={line.id} className="flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-amber-700" />
                      <span>{line.batchNumber || line.materialName}: {fmt(line.qtyOnHand)} {line.uom} at {line.locationName} ({line.ageDays} days old)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alerts.data.negative.length > 0 && (
              <div>
                <p className="font-semibold text-red-900 mb-1">Negative balances (data anomaly)</p>
                <ul className="space-y-1 text-red-800">
                  {alerts.data.negative.map((line) => (
                    <li key={line.id} className="flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-red-700" />
                      <span>{line.batchNumber || line.materialName}: {fmt(line.qtyOnHand)} {line.uom} at {line.locationName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {/* View Select and Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="w-full sm:w-60">
            <Select value={viewMode} onValueChange={(val) => setViewMode(val as 'lines' | 'location' | 'material' | 'product')}>
              <SelectTrigger className="w-full h-8 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-full">
                <SelectItem value="lines">
                  Stock Lines ({balances.data?.length ?? 0})
                </SelectItem>
                <SelectItem value="location">
                  By Location ({overview.data?.byLocation.length ?? 0})
                </SelectItem>
                <SelectItem value="material">
                  By Material ({overview.data?.byMaterial.length ?? 0})
                </SelectItem>
                <SelectItem value="product">
                  By Product ({overview.data?.byProduct.length ?? 0})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {viewMode === 'lines' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-52">
                <Select
                  value={locationFilter || "ALL"}
                  onValueChange={(val) => setLocationFilter(val === "ALL" ? "" : val)}
                >
                  <SelectTrigger className="w-full h-8 text-xs font-medium">
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    <SelectItem value="ALL">All locations</SelectItem>
                    {locations.data?.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-52">
                <Input
                  className="h-8 text-xs w-full"
                  placeholder="Search batch..."
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* CustomTable rendering based on viewMode without any surrounding card */}
        {viewMode === 'lines' && (
          <CustomTable1
            data={balances.data || []}
            columns={columns}
            loading={balances.isLoading}
          />
        )}
        {viewMode === 'location' && (
          <CustomTable1
            data={overview.data?.byLocation || []}
            columns={locationColumns}
            loading={overview.isLoading}
          />
        )}
        {viewMode === 'material' && (
          <CustomTable1
            data={overview.data?.byMaterial || []}
            columns={materialColumns}
            loading={overview.isLoading}
          />
        )}
        {viewMode === 'product' && (
          <CustomTable1
            data={overview.data?.byProduct || []}
            columns={productColumns}
            loading={overview.isLoading}
          />
        )}
      </div>

      {panel && (
        <StockActionDialog
          mode={panel.mode}
          line={panel.line}
          locations={locations.data ?? []}
          onClose={() => setPanel(null)}
          onDone={() => {
            setPanel(null)
            refreshAll()
          }}
        />
      )}
      </div>
    </PageLayout>
  )
}

function StockActionDialog({
  mode,
  line,
  locations,
  onClose,
  onDone,
}: {
  mode: 'adjust' | 'transfer'
  line: StockLine
  locations: MasterItem[]
  onClose: () => void
  onDone: () => void
}) {
  const [qtyDelta, setQtyDelta] = useState('')
  const [reasonCode, setReasonCode] = useState('STOCK_COUNT')
  const [notes, setNotes] = useState('')
  const [writeOffCost, setWriteOffCost] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState('')

  const destinations = useMemo(
    () => locations.filter((loc) => loc.id !== line.locationId),
    [locations, line.locationId],
  )

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'adjust') {
        await api.post('/inventory/adjustments', {
          balanceId: line.id,
          qtyDelta: Number(qtyDelta),
          reasonCode,
          notes,
          writeOffCost: writeOffCost ? Number(writeOffCost) : 0,
        })
      } else {
        await api.post('/inventory/transfers', {
          balanceId: line.id,
          toLocationId: Number(toLocationId),
          qty: Number(qty),
          notes,
        })
      }
    },
    onSuccess: onDone,
    onError: (err: unknown) => {
      const res = (err as { response?: { data?: { err?: string; errors?: Record<string, string> } } })
        .response
      if (res?.data?.errors) setError(Object.values(res.data.errors).join(' · '))
      else setError(res?.data?.err || 'Could not save this change')
    },
  })

  const projected =
    mode === 'adjust' && qtyDelta !== ''
      ? line.qtyOnHand + Number(qtyDelta || 0)
      : mode === 'transfer' && qty !== ''
        ? line.qtyOnHand - Number(qty || 0)
        : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="dgn-card w-full max-w-lg p-5 sm:p-6">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            {mode === 'adjust' ? 'Stock adjustment' : 'Stock transfer'}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {line.batchNumber || line.materialName || line.productName}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {fmt(line.qtyOnHand)} {line.uom} on hand at {line.locationName}
          </p>
        </div>

        <div className="space-y-4">
          {mode === 'adjust' ? (
            <>
              <Field
                label="Adjustment quantity"
                hint="Use a negative number for a loss, positive for a gain"
              >
                <Input
                  inputMode="decimal"
                  placeholder="-8"
                  value={qtyDelta}
                  onChange={(e) => setQtyDelta(e.target.value)}
                />
              </Field>
              <Field label="Reason">
                <Select value={reasonCode} onValueChange={(val) => setReasonCode(val)}>
                  <SelectTrigger className="w-full h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    {Object.entries(REASON_LABELS).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Explanation" hint="Required, minimum 5 characters">
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <Field label="Write-off cost ₦" hint="Optional, charged to the batch as a loss">
                <Input
                  inputMode="decimal"
                  value={writeOffCost}
                  onChange={(e) => setWriteOffCost(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Destination location">
                <Select value={toLocationId} onValueChange={(val) => setToLocationId(val)}>
                  <SelectTrigger className="w-full h-8 text-xs font-medium">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    {destinations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={`Quantity to move (${line.uom})`}>
                <Input
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </>
          )}

          {projected != null && (
            <StatPill
              label="Balance at this location after saving"
              value={`${fmt(projected)} ${line.uom}`}
              tone={projected < 0 ? 'danger' : 'accent'}
            />
          )}

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-4 font-semibold"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 px-4 font-semibold"
              disabled={mutation.isPending}
              onClick={() => {
                setError('')
                mutation.mutate()
              }}
            >
              {mutation.isPending
                ? 'Saving…'
                : mode === 'adjust'
                  ? 'Post adjustment'
                  : 'Post transfer'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
