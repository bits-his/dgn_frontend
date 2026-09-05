import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Warehouse,
  Flame,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Search,
  ExternalLink,
  X,
  AlertTriangle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card, StatPill } from '@/components/ui'
import { SORT_COLORS } from '@/lib/sortColors'

type BatchItem = {
  id: number
  batchNumber: string
  batchType: string
  status: string
  qtyRemaining: number | string
  qtyIn?: number | string
  qtyOut?: number | string
  uom: string
  sortColor?: string | null
  businessDate?: string | null
  createdAt?: string
  updatedAt?: string
  notes?: string | null
  material?: { id: number; name: string; code?: string }
  location?: { id: number; name: string; code: string }
}

function colorName(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

function fmt(value: string | number | null | undefined, digits = 1) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: digits })
    : String(value)
}

function formatDate(raw?: string | null) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ProductionStorePage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'store' | 'pending'>('store')
  const [search, setSearch] = useState('')
  const [transferBatch, setTransferBatch] = useState<BatchItem | null>(null)
  const [transferQty, setTransferQty] = useState('')
  const [transferNotes, setTransferNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transferSuccess, setTransferSuccess] = useState('')
  const [transferError, setTransferError] = useState('')

  // Query batches in Production Store
  const storeQuery = useQuery({
    queryKey: ['production-store'],
    queryFn: async () => {
      const { data } = await api.get('/production/store')
      return (data.data || []) as BatchItem[]
    },
  })

  // Query pending dried batches sitting in Drying Area
  const pendingQuery = useQuery({
    queryKey: ['production-store-pending'],
    queryFn: async () => {
      const { data } = await api.get('/production/store/pending')
      return (data.data || []) as BatchItem[]
    },
  })

  const storeBatches = storeQuery.data || []
  const pendingBatches = pendingQuery.data || []

  // Metrics
  const totalStoreKg = useMemo(
    () => storeBatches.reduce((acc, b) => acc + Number(b.qtyRemaining || 0), 0),
    [storeBatches]
  )
  const totalPendingKg = useMemo(
    () => pendingBatches.reduce((acc, b) => acc + Number(b.qtyRemaining || 0), 0),
    [pendingBatches]
  )

  // Filter store batches
  const filteredStore = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return storeBatches
    return storeBatches.filter(
      (b) =>
        b.batchNumber.toLowerCase().includes(q) ||
        (b.material?.name || '').toLowerCase().includes(q) ||
        (b.sortColor || '').toLowerCase().includes(q) ||
        colorName(b.sortColor).toLowerCase().includes(q)
    )
  }, [storeBatches, search])

  // Filter pending batches
  const filteredPending = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pendingBatches
    return pendingBatches.filter(
      (b) =>
        b.batchNumber.toLowerCase().includes(q) ||
        (b.material?.name || '').toLowerCase().includes(q) ||
        (b.sortColor || '').toLowerCase().includes(q) ||
        colorName(b.sortColor).toLowerCase().includes(q)
    )
  }, [pendingBatches, search])

  // Execute Transfer to Production Store
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferBatch) return
    setIsSubmitting(true)
    setTransferError('')
    setTransferSuccess('')

    try {
      const amount = transferQty ? Number(transferQty) : Number(transferBatch.qtyRemaining)
      await api.post('/production/store/transfer', {
        batchNumber: transferBatch.batchNumber,
        qty: amount,
        notes: transferNotes || undefined,
      })

      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store-pending'] })
      await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })

      setTransferSuccess(`Successfully transferred ${transferBatch.batchNumber} (${amount} kg) to Production Store`)
      setTransferBatch(null)
      setTransferQty('')
      setTransferNotes('')
      setActiveTab('store')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; message?: string } } }
      setTransferError(
        axiosErr.response?.data?.err ||
        axiosErr.response?.data?.message ||
        'Failed to transfer batch to Production Store'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Quick Handover Trigger
  const openTransferModal = (batch: BatchItem) => {
    setTransferBatch(batch)
    setTransferQty(String(batch.qtyRemaining))
    setTransferNotes('')
    setTransferError('')
    setTransferSuccess('')
  }

  return (
    <div className="space-y-3">
      {/* Top Header - Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
            Production Store
          </h1>
          <p className="text-xs text-zinc-500">
            Raw material inventory in store available to feed production machines.
          </p>
        </div>
      </div>

      {/* KPI Stats - Compact */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatPill
          label="Available in Store"
          value={`${fmt(totalStoreKg, 1)} kg`}
          tone="success"
        />
        <StatPill
          label="Store Batches"
          value={String(storeBatches.length)}
          tone={storeBatches.length > 0 ? 'accent' : 'default'}
        />
        <StatPill
          label="Pending in Drying"
          value={`${fmt(totalPendingKg, 1)} kg`}
          tone={pendingBatches.length > 0 ? 'danger' : 'default'}
        />
        <StatPill
          label="Batches Waiting"
          value={String(pendingBatches.length)}
          tone={pendingBatches.length > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Notifications */}
      {transferSuccess && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-2.5 text-xs font-medium text-emerald-800 border border-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span>{transferSuccess}</span>
          </div>
          <button
            type="button"
            className="text-emerald-600 hover:text-emerald-900"
            onClick={() => setTransferSuccess('')}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {transferError && (
        <div className="flex items-center justify-between rounded-xl bg-red-50 p-2.5 text-xs font-medium text-red-800 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-600 shrink-0" />
            <span>{transferError}</span>
          </div>
          <button
            type="button"
            className="text-red-600 hover:text-red-900"
            onClick={() => setTransferError('')}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Tab Switcher & Search Bar - Compact */}
      <Card className="!p-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 w-fit">
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'store'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              onClick={() => setActiveTab('store')}
            >
              <Warehouse className="size-3.5" />
              <span>In Store</span>
              <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.2 text-[10px] font-bold">
                {storeBatches.length}
              </span>
            </button>

            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'pending'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              onClick={() => setActiveTab('pending')}
            >
              <Flame className="size-3.5 text-amber-600" />
              <span>Pending from Drying</span>
              {pendingBatches.length > 0 && (
                <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px] font-bold">
                  {pendingBatches.length}
                </span>
              )}
            </button>
          </div>

          <div className="relative sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
            <input
              type="text"
              className="dgn-input pl-8 text-xs h-8"
              placeholder="Filter by batch, color, material…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Tab 1: In Production Store (Compact, No Actions Column) */}
      {activeTab === 'store' && (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2 px-3">Batch Number</th>
                  <th className="py-2 px-3">Material</th>
                  <th className="py-2 px-3">Color</th>
                  <th className="py-2 px-3 text-right">Available (kg)</th>
                  <th className="py-2 px-3">Location</th>
                  <th className="py-2 px-3">Received Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {storeQuery.isLoading && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      <Clock className="size-5 animate-spin mx-auto text-[var(--accent)] mb-1" />
                      Loading production store items…
                    </td>
                  </tr>
                )}

                {!storeQuery.isLoading && filteredStore.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-zinc-500">
                      <Warehouse className="size-8 mx-auto text-zinc-300 mb-2" />
                      <p className="font-semibold text-zinc-700">No material in Production Store yet</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {pendingBatches.length > 0
                          ? `You have ${pendingBatches.length} dried batch(es) waiting in Drying Area to be transferred.`
                          : 'Complete a drying batch first, then transfer it here to use in production.'}
                      </p>
                      {pendingBatches.length > 0 && (
                        <button
                          type="button"
                          className="dgn-btn dgn-btn-secondary text-xs mt-3 inline-flex items-center gap-1.5"
                          onClick={() => setActiveTab('pending')}
                        >
                          <Flame className="size-3.5 text-amber-600" />
                          View Batches in Drying Area
                        </button>
                      )}
                    </td>
                  </tr>
                )}

                {!storeQuery.isLoading &&
                  filteredStore.map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-2 px-3 font-semibold text-zinc-900">
                        <Link
                          to={`/batches/${b.batchNumber}`}
                          className="text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
                        >
                          {b.batchNumber}
                          <ExternalLink className="size-2.5 text-zinc-400" />
                        </Link>
                      </td>
                      <td className="py-2 px-3 font-bold text-zinc-900 text-xs">
                        {b.material?.name || b.batchType || 'Raw Material'}
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {colorName(b.sortColor)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-black tabular-nums text-emerald-800 text-sm">
                        {fmt(b.qtyRemaining, 1)} {b.uom || 'kg'}
                      </td>
                      <td className="py-2 px-3 text-zinc-600">
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-700 font-medium">
                          <Warehouse className="size-3 text-zinc-400" />
                          {b.location?.name || 'Production Store'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-500 tabular-nums">
                        {formatDate(b.updatedAt || b.createdAt)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Pending in Drying Area */}
      {activeTab === 'pending' && (
        <Card className="!p-0 overflow-hidden">
          <div className="p-3 bg-amber-50/60 border-b border-amber-200 flex items-start gap-2.5">
            <Flame className="size-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-950">
                Dried Batches in Drying Area (Waiting for Handover)
              </p>
              <p className="text-[11px] text-amber-800">
                These materials have finished drying and stay in the Drying Area until transferred to the Production Store. Click <strong>Transfer to Store</strong> to hand over and make available for machine production.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2 px-3">Batch Number</th>
                  <th className="py-2 px-3">Material</th>
                  <th className="py-2 px-3">Color</th>
                  <th className="py-2 px-3 text-right">Dry Quantity</th>
                  <th className="py-2 px-3">Current Location</th>
                  <th className="py-2 px-3">Dried Date</th>
                  <th className="py-2 px-3 text-right">Handover Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pendingQuery.isLoading && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500">
                      <Clock className="size-5 animate-spin mx-auto text-[var(--accent)] mb-1" />
                      Checking drying area…
                    </td>
                  </tr>
                )}

                {!pendingQuery.isLoading && filteredPending.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-zinc-500">
                      <Flame className="size-8 mx-auto text-zinc-300 mb-2" />
                      <p className="font-semibold text-zinc-700">No dried batches waiting in Drying Area</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        All dried batches have already been handed over to the Production Store.
                      </p>
                      <Link
                        to="/process/drying"
                        className="dgn-btn dgn-btn-secondary text-xs mt-3 inline-flex items-center gap-1.5"
                      >
                        <Flame className="size-3.5 text-amber-600" />
                        Go to Drying Process
                      </Link>
                    </td>
                  </tr>
                )}

                {!pendingQuery.isLoading &&
                  filteredPending.map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-2 px-3 font-semibold text-zinc-900">
                        <Link
                          to={`/batches/${b.batchNumber}`}
                          className="text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
                        >
                          {b.batchNumber}
                          <ExternalLink className="size-2.5 text-zinc-400" />
                        </Link>
                      </td>
                      <td className="py-2 px-3 font-bold text-zinc-900 text-xs">
                        {b.material?.name || b.batchType || 'Raw Material'}
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {colorName(b.sortColor)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-black tabular-nums text-amber-900 text-sm">
                        {fmt(b.qtyRemaining, 1)} {b.uom || 'kg'}
                      </td>
                      <td className="py-2 px-3 text-zinc-600">
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-medium">
                          <Flame className="size-3 text-amber-600" />
                          {b.location?.name || 'Drying Area'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-500 tabular-nums">
                        {formatDate(b.updatedAt || b.createdAt)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          className="dgn-btn dgn-btn-primary text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
                          onClick={() => openTransferModal(b)}
                        >
                          <ArrowRightLeft className="size-3" />
                          Transfer to Store
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL: TRANSFER TO PRODUCTION STORE */}
      {transferBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <ArrowRightLeft className="size-3.5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900">Transfer to Production Store</h2>
                  <p className="text-[11px] text-zinc-500">
                    Hand over dried material from Drying Area to Production Store.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => setTransferBatch(null)}
              >
                <X className="size-4" />
              </button>
            </div>

            <form className="mt-3 space-y-3" onSubmit={handleExecuteTransfer}>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Batch Number:</span>
                  <span className="font-bold text-zinc-900">{transferBatch.batchNumber}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Material & Colour:</span>
                  <span className="font-semibold text-zinc-800">
                    {transferBatch.material?.name || 'Recycled Plastic'} · {colorName(transferBatch.sortColor)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Available in Drying Area:</span>
                  <span className="font-bold text-amber-800">
                    {fmt(transferBatch.qtyRemaining, 1)} {transferBatch.uom || 'kg'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Quantity to Transfer (kg)
                </label>
                <input
                  type="number"
                  step="any"
                  max={Number(transferBatch.qtyRemaining)}
                  required
                  className="dgn-input text-xs font-bold"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  placeholder={`Max ${transferBatch.qtyRemaining}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Handover Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  className="dgn-input text-xs"
                  placeholder="e.g. Clean dried HDPE ready for injection moulding..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  className="dgn-btn dgn-btn-ghost text-xs"
                  onClick={() => setTransferBatch(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="dgn-btn dgn-btn-primary text-xs flex items-center gap-1.5"
                >
                  <Warehouse className="size-3.5" />
                  {isSubmitting ? 'Transferring…' : 'Confirm Handover to Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
