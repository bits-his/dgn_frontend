import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  CheckCircle2,
  Search,
  ExternalLink,
  X,
  AlertTriangle,
  Palette,
  Package,
} from 'lucide-react'
import { api } from '@/lib/api'
import { StatPill } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
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
  const [search, setSearch] = useState('')

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

  const storeBatches = storeQuery.data || []

  // Metrics
  const totalStoreKg = useMemo(
    () => storeBatches.reduce((acc, b) => acc + Number(b.qtyRemaining || 0), 0),
    [storeBatches]
  )

  const uniqueMaterialsCount = useMemo(() => {
    const set = new Set(storeBatches.map((b) => b.material?.name || b.batchType).filter(Boolean))
    return set.size
  }, [storeBatches])

  const uniqueColorsCount = useMemo(() => {
    const set = new Set(storeBatches.map((b) => b.sortColor).filter(Boolean))
    return set.size
  }, [storeBatches])

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

  // Handle Add Color Formulation directly to Store
  const handleExecuteAddColorToStore = async (e: React.FormEvent) => {
    e.preventDefault()
    setColorError('')
    setColorSuccess('')

    const qty = Number(colorQtyKg)
    if (!colorNameInput.trim()) {
      setColorError('Please choose or enter a color formulation name.')
      return
    }
    if (!(qty > 0)) {
      setColorError('Please enter a valid positive quantity in kilograms.')
      return
    }

    setIsColorSubmitting(true)
    try {
      const cost = colorCostPerKg ? Number(colorCostPerKg) : undefined
      await api.post('/production/store/add-color', {
        type: colorType,
        colorName: colorNameInput.trim(),
        qtyKg: qty,
        costPerKg: cost,
        notes: colorNotes || undefined,
      })

      setColorSuccess(
        `Added ${qty} kg of ${colorNameInput} (${colorType === 'master' ? 'Masterbatch' : 'Normal Pigment'}) to Production Store!`
      )
      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store-colors'] })

      setTimeout(() => {
        setIsAddColorModalOpen(false)
        setColorSuccess('')
      }, 1200)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string } } }
      setColorError(
        axiosErr.response?.data?.err || 'Failed to add color stock to Production Store.'
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
      <div className="space-y-3">
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
            label="Unique Materials"
            value={String(uniqueMaterialsCount)}
            tone="default"
          />
          <StatPill
            label="Active Formulations / Colors"
            value={String(uniqueColorsCount)}
            tone="default"
          />
        </div>

        {/* Notifications */}
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

        {/* Search Bar & Store Inventory Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2.5">
            <div className="relative w-full max-w-xs">
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

          <CustomTable1
            data={filteredStore}
            columns={storeColumns}
            filter={false}
            loading={storeQuery.isLoading}
            card={true}
          />
        </div>

        {/* MODAL: ADD COLOR (MASTERBATCH / PIGMENT) TO STORE */}
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
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Select a standard color preset or type a custom color formulation name.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Quantity (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      min={0.01}
                      className="dgn-input font-bold"
                      placeholder="e.g. 50"
                      value={colorQtyKg}
                      onChange={(e) => setColorQtyKg(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Cost per kg (₦)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className="dgn-input"
                      placeholder="e.g. 3500"
                      value={colorCostPerKg}
                      onChange={(e) => setColorCostPerKg(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    className="dgn-input text-xs"
                    placeholder="e.g. Received from supplier XYZ, batch code #449..."
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
                    className="bg-violet-700 hover:bg-violet-800 text-white font-semibold gap-1.5"
                    size="sm"
                  >
                    <Package className="size-3.5" />
                    {isColorSubmitting ? 'Adding…' : 'Add to Store'}
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
