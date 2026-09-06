import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownLeft, ArrowUpRight, Filter, RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CustomTable1 from '@/components/CustomTable1'
import { formatBusinessDate } from '@/lib/dates'

type LedgerRow = {
  id: number
  direction: 'IN' | 'OUT'
  qty: number
  uom: string
  reason: string
  referenceType: string | null
  notes: string | null
  businessDate: string | null
  createdAt: string
  batchNumber: string | null
  materialName: string | null
  productName: string | null
  locationName: string | null
  createdBy: string | null
}

type MasterItem = { id: number; name: string }

const REASONS = [
  'RECEIVING',
  'PROCESSING',
  'CONSUMPTION',
  'PRODUCTION',
  'TRANSFER',
  'ADJUSTMENT',
  'REJECTION',
  'WASTE',
  'SALE',
  'RETURN',
]

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function StockLedgerPage() {
  const [direction, setDirection] = useState('')
  const [reason, setReason] = useState('')
  const [locationId, setLocationId] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const locations = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data } = await api.get('/masters/locations')
      return data.data as MasterItem[]
    },
  })

  const ledger = useQuery({
    queryKey: ['inventory-ledger', direction, reason, locationId, batchNumber, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (direction) params.set('direction', direction)
      if (reason) params.set('reason', reason)
      if (locationId) params.set('locationId', locationId)
      if (batchNumber) params.set('batchNumber', batchNumber)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const { data } = await api.get(`/inventory/ledger?${params.toString()}`)
      return data.data as LedgerRow[]
    },
  })

  const totalIn = useMemo(
    () => ledger.data?.filter((r) => r.direction === 'IN').reduce((s, r) => s + Number(r.qty), 0) ?? 0,
    [ledger.data]
  )
  const totalOut = useMemo(
    () => ledger.data?.filter((r) => r.direction === 'OUT').reduce((s, r) => s + Number(r.qty), 0) ?? 0,
    [ledger.data]
  )

  const resetFilters = () => {
    setDirection('')
    setReason('')
    setLocationId('')
    setBatchNumber('')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = Boolean(direction || reason || locationId || batchNumber || dateFrom || dateTo)

  const columns = useMemo<ColumnDef<LedgerRow>[]>(
    () => [
      {
        id: 'businessDate',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 tabular-nums">
            {formatBusinessDate(row.original.businessDate)}
          </span>
        ),
      },
      {
        id: 'batchNumber',
        header: 'Batch',
        cell: ({ row }) => {
          const bn = row.original.batchNumber
          return bn ? (
            <Link
              to={`/batches/${bn}`}
              className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
            >
              {bn}
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
          <span className="font-medium text-xs text-zinc-900">
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
        id: 'direction',
        header: 'Flow',
        cell: ({ row }) => {
          const isIn = row.original.direction === 'IN'
          return (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                isIn
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                  : 'bg-rose-50 text-rose-700 border border-rose-200/80'
              }`}
            >
              {isIn ? <ArrowDownLeft className="size-3 shrink-0" /> : <ArrowUpRight className="size-3 shrink-0" />}
              <span>{row.original.direction}</span>
            </span>
          )
        },
      },
      {
        id: 'qty',
        header: 'Quantity',
        cell: ({ row }) => (
          <span className="font-semibold text-xs tabular-nums text-zinc-900">
            {fmt(row.original.qty)} {row.original.uom}
          </span>
        ),
      },
      {
        id: 'reason',
        header: 'Reason / Notes',
        cell: ({ row }) => (
          <div>
            <span className="text-xs font-medium text-zinc-800 capitalize">
              {row.original.reason.toLowerCase().replace(/_/g, ' ')}
            </span>
            {row.original.notes && (
              <p className="text-[11px] text-zinc-400 line-clamp-1">{row.original.notes}</p>
            )}
          </div>
        ),
      },
      {
        id: 'createdBy',
        header: 'User',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500">
            {row.original.createdBy || '—'}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <PageLayout
      title="Movement ledger"
      description="Audit trail of all inventory receipts, transfers, usages, and adjustments"
      back={true}
      backLabel="Back to stock"
      onBack={() => window.history.back()}
      actions={
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs font-semibold sm:hidden gap-1.5"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="size-3.5" />
          <span>{showFilters ? 'Hide filters' : 'Filters'}</span>
          {hasActiveFilters && (
            <span className="size-1.5 rounded-full bg-amber-500" />
          )}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Metric summary banner */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-xs">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Total Movements
            </span>
            <div className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 mt-0.5">
              {ledger.data?.length ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-xs">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Total Receipts (IN)
            </span>
            <div className="text-base sm:text-xl font-bold tracking-tight text-emerald-700 mt-0.5 tabular-nums">
              {fmt(totalIn)}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-xs">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-600">
              Total Outflow (OUT)
            </span>
            <div className="text-base sm:text-xl font-bold tracking-tight text-rose-700 mt-0.5 tabular-nums">
              {fmt(totalOut)}
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className={`space-y-3 ${showFilters ? 'block' : 'hidden sm:block'}`}>
          <div className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-xs">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {/* Direction Filter */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Direction
                </label>
                <Select value={direction || 'ALL'} onValueChange={(v) => setDirection(v === 'ALL' ? '' : v)}>
                  <SelectTrigger className="w-full h-8 text-xs font-medium">
                    <SelectValue placeholder="All directions" />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    <SelectItem value="ALL">All directions</SelectItem>
                    <SelectItem value="IN">Inbound (IN)</SelectItem>
                    <SelectItem value="OUT">Outbound (OUT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reason Filter */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Reason
                </label>
                <Select value={reason || 'ALL'} onValueChange={(v) => setReason(v === 'ALL' ? '' : v)}>
                  <SelectTrigger className="w-full h-8 text-xs font-medium">
                    <SelectValue placeholder="All reasons" />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    <SelectItem value="ALL">All reasons</SelectItem>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Location
                </label>
                <Select value={locationId || 'ALL'} onValueChange={(v) => setLocationId(v === 'ALL' ? '' : v)}>
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

              {/* Batch Filter */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Batch #
                </label>
                <Input
                  className="h-8 text-xs w-full"
                  placeholder="e.g. PRD-..."
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                />
              </div>

              {/* From Date */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  From Date
                </label>
                <Input
                  type="date"
                  className="h-8 text-xs w-full"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  To Date
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    className="h-8 text-xs w-full"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                  {hasActiveFilters && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-zinc-500 hover:text-zinc-900 shrink-0"
                      onClick={resetFilters}
                      title="Reset filters"
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Table with No Outer Card Wrapper */}
        <CustomTable1
          data={ledger.data || []}
          columns={columns}
          loading={ledger.isLoading}
        />
      </div>
    </PageLayout>
  )
}
