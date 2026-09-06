import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Warehouse,
  Flame,
  ArrowRightLeft,
  CheckCircle2,
  Search,
  ExternalLink,
  X,
  AlertTriangle,
  Palette,
} from 'lucide-react'
import { api } from '@/lib/api'
import { StatPill } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ColorCombobox } from '@/components/ui/color-combobox'
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

  // Transfer from Drying Area Modal state
  const [transferBatch, setTransferBatch] = useState<BatchItem | null>(null)
  const [transferQty, setTransferQty] = useState('')
  const [transferNotes, setTransferNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transferSuccess, setTransferSuccess] = useState('')
  const [transferError, setTransferError] = useState('')

  // Add Color to Store Modal state
  const [isAddColorModalOpen, setIsAddColorModalOpen] = useState(false)
  const [colorType, setColorType] = useState<'master' | 'normal'>('master')
  const [colorNameInput, setColorNameInput] = useState('')
  const [colorQtyKg, setColorQtyKg] = useState('')
  const [colorCostPerKg, setColorCostPerKg] = useState('')
  const [colorNotes, setColorNotes] = useState('')
  const [colorError, setColorError] = useState('')
  const [colorSuccess, setColorSuccess] = useState('')
  const [isColorSubmitting, setIsColorSubmitting] = useState(false)

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

  // Execute Transfer from Drying Area to Production Store
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

  // Execute Add Color to Production Store
  const handleExecuteAddColorToStore = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!colorNameInput.trim()) {
      setColorError('Please provide a color name or code.')
      return
    }
    const qty = Number(colorQtyKg || 0)
    if (!(qty > 0)) {
      setColorError('Please enter quantity in kg greater than zero.')
      return
    }
    setIsColorSubmitting(true)
    setColorError('')
    setColorSuccess('')

    try {
      const { data } = await api.post('/production/store/add-color', {
        colorType,
        colorName: colorNameInput.trim(),
        qtyKg: qty,
        costPerKg: Number(colorCostPerKg || 0),
        notes: colorNotes || undefined,
      })

      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })

      setColorSuccess(data.message || `Successfully stocked ${colorNameInput} in Production Store`)
      setIsAddColorModalOpen(false)
      setColorNameInput('')
      setColorQtyKg('')
      setColorCostPerKg('')
      setColorNotes('')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; message?: string } } }
      setColorError(
        axiosErr.response?.data?.err ||
        axiosErr.response?.data?.message ||
        'Failed to stock color formulation in Production Store'
      )
    } finally {
      setIsColorSubmitting(false)
    }
  }

  // Table Columns for Batches in Production Store
  const storeColumns: ColumnDef<BatchItem>[] = useMemo(
    () => [
      {
        id: 'batchNumber',
        header: 'Batch Number',
        accessorKey: 'batchNumber',
        cell: ({ row }) => (
          <Link
            to={`/batches/${row.original.batchNumber}`}
            className="font-semibold text-xs text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1 font-mono"
          >
            {row.original.batchNumber}
            <ExternalLink className="size-3 text-zinc-400" />
          </Link>
        ),
      },
      {
        id: 'material',
        header: 'Material / Item',
        accessorKey: 'material',
        cell: ({ row }) => (
          <span className="font-medium text-xs text-zinc-900">
            {row.original.material?.name || row.original.batchType || 'Raw Material'}
          </span>
        ),
      },
      {
        id: 'color',
        header: 'Color / Formulation',
        accessorKey: 'sortColor',
        cell: ({ row }) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200/80">
            {colorName(row.original.sortColor)}
          </span>
        ),
      },
      {
        id: 'qtyRemaining',
        header: 'Available (kg)',
        accessorKey: 'qtyRemaining',
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-emerald-800 text-xs">
            {fmt(row.original.qtyRemaining, 1)}{' '}
            <span className="text-[11px] font-normal text-zinc-500">{row.original.uom || 'kg'}</span>
          </span>
        ),
      },
      {
        id: 'updatedAt',
        header: 'Received Date',
        accessorKey: 'updatedAt',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 tabular-nums">
            {formatDate(row.original.updatedAt || row.original.createdAt)}
          </span>
        ),
      },
    ],
    []
  )

  // Table Columns for Batches Pending in Drying Area
  const pendingColumns: ColumnDef<BatchItem>[] = useMemo(
    () => [
      {
        id: 'batchNumber',
        header: 'Batch Number',
        accessorKey: 'batchNumber',
        cell: ({ row }) => (
          <Link
            to={`/batches/${row.original.batchNumber}`}
            className="font-semibold text-xs text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1 font-mono"
          >
            {row.original.batchNumber}
            <ExternalLink className="size-3 text-zinc-400" />
          </Link>
        ),
      },
      {
        id: 'material',
        header: 'Material',
        accessorKey: 'material',
        cell: ({ row }) => (
          <span className="font-medium text-xs text-zinc-900">
            {row.original.material?.name || row.original.batchType || 'Raw Material'}
          </span>
        ),
      },
      {
        id: 'color',
        header: 'Color',
        accessorKey: 'sortColor',
        cell: ({ row }) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200/80">
            {colorName(row.original.sortColor)}
          </span>
        ),
      },
      {
        id: 'qtyRemaining',
        header: 'Dry Quantity (kg)',
        accessorKey: 'qtyRemaining',
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-amber-800 text-xs">
            {fmt(row.original.qtyRemaining, 1)}{' '}
            <span className="text-[11px] font-normal text-zinc-500">{row.original.uom || 'kg'}</span>
          </span>
        ),
      },
      {
        id: 'location',
        header: 'Current Location',
        accessorKey: 'location',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-800 font-medium">
            <Flame className="size-3.5 text-amber-600 shrink-0" />
            {row.original.location?.name || 'Drying Area'}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        header: 'Dried Date',
        accessorKey: 'updatedAt',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 tabular-nums">
            {formatDate(row.original.updatedAt || row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Handover Action',
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7 px-2.5 font-medium border-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
            onClick={() => openTransferModal(row.original)}
          >
            <ArrowRightLeft className="size-3" />
            <span>Transfer to Store</span>
          </Button>
        ),
      },
    ],
    []
  )

  return (
    <PageLayout
      title="Production Store"
      description="Raw material, masterbatch & pigment inventory for production machines."
      actions={
        <Button
          type="button"
          className="gap-1.5 font-semibold"
          onClick={() => {
            setColorType('master')
            setColorNameInput('')
            setColorQtyKg('')
            setColorCostPerKg('')
            setColorNotes('')
            setColorError('')
            setIsAddColorModalOpen(true)
          }}
        >
          <Palette className="size-4" />
          <span>Add Color<span className="hidden sm:inline"> to Store</span></span>
        </Button>
      }
    >
      <div className="space-y-2 sm:space-y-3">
        {/* KPI Summary Stats */}
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
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
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
              className="text-red-600 hover:text-red-900 cursor-pointer"
              onClick={() => setTransferError('')}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {colorSuccess && (
          <div className="flex items-center justify-between rounded-xl bg-violet-50 p-2.5 text-xs font-medium text-violet-900 border border-violet-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-violet-600 shrink-0" />
              <span>{colorSuccess}</span>
            </div>
            <button
              type="button"
              className="text-violet-600 hover:text-violet-900 cursor-pointer"
              onClick={() => setColorSuccess('')}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {colorError && (
          <div className="flex items-center justify-between rounded-xl bg-red-50 p-2.5 text-xs font-medium text-red-800 border border-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-600 shrink-0" />
              <span>{colorError}</span>
            </div>
            <button
              type="button"
              className="text-red-600 hover:text-red-900 cursor-pointer"
              onClick={() => setColorError('')}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Shadcn Tabs with Search Bar */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'store' | 'pending')}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2">
            <TabsList>
              <TabsTrigger value="store" className="gap-1.5">
                <Warehouse className="size-3.5" />
                <span>In Store</span>
                <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.2 text-[10px] font-bold">
                  {storeBatches.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-1.5">
                <Flame className="size-3.5 text-amber-600" />
                <span>Pending from Drying</span>
                {pendingBatches.length > 0 && (
                  <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px] font-bold">
                    {pendingBatches.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="relative sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
              <Input
                type="text"
                className="pl-8 text-xs h-8 w-full bg-white"
                placeholder="Filter by batch, color, material…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Tab 1: In Production Store */}
          <TabsContent value="store">
            <CustomTable1
              data={filteredStore}
              columns={storeColumns}
              filter={false}
              loading={storeQuery.isLoading}
            />
          </TabsContent>

          {/* Tab 2: Pending from Drying Area */}
          <TabsContent value="pending">
            <div className="mb-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2">
              <Flame className="size-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-950">
                  Dried Batches in Drying Area (Waiting for Handover)
                </p>
                <p className="text-[11px] text-amber-800">
                  These materials have finished drying and stay in the Drying Area until transferred to the Production Store. Click <strong>Transfer to Store</strong> to hand over.
                </p>
              </div>
            </div>

            <CustomTable1
              data={filteredPending}
              columns={pendingColumns}
              filter={false}
              loading={pendingQuery.isLoading}
            />
          </TabsContent>
        </Tabs>

        {/* MODAL 1: ADD COLOR (MASTERBATCH / PIGMENT) TO STORE */}
        {isAddColorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-800">
                    <Palette className="size-3.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">Add Color to Production Store</h2>
                    <p className="text-[11px] text-zinc-500">
                      Stock Masterbatch pellets or Normal Pigment powder directly into the store.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                  onClick={() => setIsAddColorModalOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>

              <form className="mt-3 space-y-3" onSubmit={handleExecuteAddColorToStore}>
                {/* Formulation Type Selector */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Color Formulation Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        colorType === 'master'
                          ? 'border-violet-500 bg-violet-50 text-violet-950 font-bold ring-1 ring-violet-400'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                      onClick={() => setColorType('master')}
                    >
                      <span className="block text-xs font-semibold">Masterbatch</span>
                      <span className="block text-[10px] text-zinc-500">Concentrated pellets</span>
                    </button>

                    <button
                      type="button"
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        colorType === 'normal'
                          ? 'border-violet-500 bg-violet-50 text-violet-950 font-bold ring-1 ring-violet-400'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                      onClick={() => setColorType('normal')}
                    >
                      <span className="block text-xs font-semibold">Normal Pigment</span>
                      <span className="block text-[10px] text-zinc-500">Standard powder / dye</span>
                    </button>
                  </div>
                </div>

                {/* Color Selection with Searchable Combobox */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Batch Color
                  </label>
                  <ColorCombobox
                    value={colorNameInput}
                    onChange={(col) => setColorNameInput(col)}
                    placeholder="Search and select color…"
                  />
                </div>

                {/* Quantity in kg and Cost per kg */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Quantity to Store (kg)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="e.g. 50"
                      className="dgn-input text-xs font-bold"
                      value={colorQtyKg}
                      onChange={(e) => setColorQtyKg(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Cost per kg (₦/kg)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 2500"
                      className="dgn-input text-xs"
                      value={colorCostPerKg}
                      onChange={(e) => setColorCostPerKg(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Formulation Notes / Remarks
                  </label>
                  <textarea
                    rows={2}
                    className="dgn-input text-xs"
                    placeholder="e.g. Purchased from vendor for upcoming injection runs..."
                    value={colorNotes}
                    onChange={(e) => setColorNotes(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddColorModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isColorSubmitting}
                    className="bg-violet-600 hover:bg-violet-700 text-white font-semibold gap-1.5"
                    size="sm"
                  >
                    <Palette className="size-3.5" />
                    {isColorSubmitting ? 'Stocking in Store…' : 'Stock Color in Store'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: TRANSFER FROM DRYING AREA TO PRODUCTION STORE */}
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
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
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
                    required
                    max={Number(transferBatch.qtyRemaining)}
                    min={0.01}
                    className="dgn-input font-bold"
                    placeholder="Enter kg to hand over"
                    value={transferQty}
                    onChange={(e) => setTransferQty(e.target.value)}
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Default is full batch remaining ({fmt(transferBatch.qtyRemaining, 1)} kg). You can also do a partial transfer.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Handover Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    className="dgn-input text-xs"
                    placeholder="e.g. Transferred to store bin #3 by drying team..."
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTransferBatch(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
                    size="sm"
                  >
                    <ArrowRightLeft className="size-3.5" />
                    {isSubmitting ? 'Transferring…' : 'Complete Handover to Store'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
