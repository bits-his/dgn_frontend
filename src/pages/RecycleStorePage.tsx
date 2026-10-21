import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  CheckCircle2,
  History,
  PackageCheck,
  Search,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatPill } from '@/components/ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SORT_COLORS } from '@/lib/sortColors'
import { materialKindLabel } from '@/lib/materialLabels'

type BatchColorItem = {
  id?: number
  color: string
  qtyCrushed?: number | string
  qtyWashed?: number | string
  qtyDried?: number | string
}

type BatchItem = {
  id: number
  batchNumber: string
  batchType: string
  qtyRemaining: number | string
  sortColor?: string | null
  colorItems?: BatchColorItem[]
  material?: { name?: string | null } | null
}

function colorName(code?: string | null) {
  if (!code) return ''
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

function fmt(n: number, digits = 1) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
}

export function RecycleStorePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [successBanner, setSuccessBanner] = useState('')
  const [errorBanner, setErrorBanner] = useState('')

  const [transferBatch, setTransferBatch] = useState<BatchItem | null>(null)
  const [transferQty, setTransferQty] = useState('')
  const [transferError, setTransferError] = useState('')
  const [transferring, setTransferring] = useState(false)

  const recycleStoreQuery = useQuery({
    queryKey: ['recycle-store'],
    queryFn: async () => {
      const { data } = await api.get('/production/recycle-store')
      return (data.data || []) as BatchItem[]
    },
  })

  const recycleBatches = recycleStoreQuery.data || []
  const totalRecycleKg = useMemo(
    () => recycleBatches.reduce((sum, b) => sum + Number(b.qtyRemaining || 0), 0),
    [recycleBatches],
  )

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return recycleBatches
    return recycleBatches.filter((b) => {
      const color =
        colorName(b.sortColor) ||
        (b.colorItems || []).map((c) => colorName(c.color)).join(' ')
      const kind = materialKindLabel({ batchType: b.batchType })
      return (
        b.batchNumber.toLowerCase().includes(q) ||
        color.toLowerCase().includes(q) ||
        kind.toLowerCase().includes(q) ||
        String(b.batchType || '')
          .toLowerCase()
          .includes(q)
      )
    })
  }, [recycleBatches, search])

  const openTransferModal = (batch: BatchItem) => {
    setTransferBatch(batch)
    setTransferQty(String(Number(batch.qtyRemaining || 0)))
    setTransferError('')
  }

  const closeTransferModal = () => {
    if (transferring) return
    setTransferBatch(null)
    setTransferQty('')
    setTransferError('')
  }

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault()
    if (!transferBatch) return
    const available = Number(transferBatch.qtyRemaining || 0)
    const qty = Number(transferQty)
    if (!(qty > 0)) {
      setTransferError('Enter how many kg to transfer.')
      return
    }
    if (qty > available + 0.001) {
      setTransferError(`Only ${fmt(available, 1)} kg available on this lot.`)
      return
    }

    setTransferring(true)
    setTransferError('')
    setErrorBanner('')
    setSuccessBanner('')
    try {
      const { data } = await api.post('/production/store/transfer', {
        batchNumber: transferBatch.batchNumber,
        qty,
      })
      setSuccessBanner(
        data.message ||
          `Moved ${fmt(qty, 1)} kg from ${transferBatch.batchNumber} to Material store`,
      )
      setTransferBatch(null)
      setTransferQty('')
      await queryClient.invalidateQueries({ queryKey: ['recycle-store'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      await queryClient.invalidateQueries({ queryKey: ['inventory'] })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; message?: string } } }
      setTransferError(
        axiosErr.response?.data?.err ||
          axiosErr.response?.data?.message ||
          'Could not move to Material store',
      )
    } finally {
      setTransferring(false)
    }
  }

  const columns: ColumnDef<BatchItem>[] = useMemo(
    () => [
      {
        id: 'batchNumber',
        header: 'Lot',
        accessorKey: 'batchNumber',
        cell: ({ row }) => (
          <Link
            to={`/batches/${row.original.batchNumber}`}
            className="font-semibold text-xs text-[var(--accent-strong)] hover:underline font-mono"
          >
            {row.original.batchNumber}
          </Link>
        ),
      },
      {
        id: 'material',
        header: 'Material',
        cell: ({ row }) => (
          <span className="font-semibold text-xs text-zinc-900">
            {materialKindLabel({ batchType: row.original.batchType }) ||
              row.original.batchType}
          </span>
        ),
      },
      {
        id: 'color',
        header: 'Color',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-zinc-800">
            {colorName(row.original.sortColor) ||
              (row.original.colorItems || [])
                .map((c) => colorName(c.color))
                .filter(Boolean)
                .join(', ') ||
              '—'}
          </span>
        ),
      },
      {
        id: 'qtyRemaining',
        header: 'Available',
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-emerald-700 text-xs">
            {fmt(Number(row.original.qtyRemaining || 0), 1)} kg
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2.5 text-xs font-semibold gap-1 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => openTransferModal(row.original)}
          >
            <PackageCheck className="size-3" />
            Transfer
          </Button>
        ),
      },
    ],
    [],
  )

  const availableOnModal = transferBatch
    ? Number(transferBatch.qtyRemaining || 0)
    : 0

  return (
    <PageLayout
      title="Recycle store"
      description="Washed lots and bought recycled pellets. Transfer kg to Material store before mix / issue."
      actions={
        <div className="flex max-w-full items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-9 shrink-0 px-0 sm:w-auto sm:gap-1.5 sm:px-3 text-xs font-semibold"
            onClick={() => navigate('/production/recycle-store/history')}
            aria-label="History"
            title="History"
          >
            <History className="size-3.5" />
            <span className="hidden sm:inline">History</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <StatPill
            label="In store"
            value={`${fmt(totalRecycleKg, 1)} kg`}
            tone="success"
          />
          <StatPill
            label="Lots"
            value={String(recycleBatches.length)}
            tone={recycleBatches.length > 0 ? 'accent' : 'default'}
          />
        </div>

        {successBanner && (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-900 border border-emerald-200 shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              type="button"
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer p-1"
              onClick={() => setSuccessBanner('')}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {errorBanner && (
          <div className="flex items-center justify-between rounded-xl bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-600 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              className="text-red-600 hover:text-red-900 cursor-pointer p-1"
              onClick={() => setErrorBanner('')}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-zinc-900">Store lots</h2>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
              <Input
                type="text"
                className="pl-8 text-xs h-8 w-full bg-white"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {filteredBatches.length === 0 && !recycleStoreQuery.isLoading ? (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-8 text-center text-sm text-muted-foreground">
              Recycle store is empty. Finish washing, or buy recycled pellets.
            </p>
          ) : (
            <CustomTable1
              data={filteredBatches}
              columns={columns}
              filter={false}
              loading={recycleStoreQuery.isLoading}
              card={true}
            />
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(transferBatch)}
        onOpenChange={(open) => {
          if (!open) closeTransferModal()
        }}
      >
        <DialogContent className="max-h-[92vh] w-[min(90vw,28rem)] max-w-[min(90vw,28rem)] overflow-y-auto p-4 sm:p-5 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:pt-[max(1.25rem,env(safe-area-inset-top))] max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <DialogHeader className="mb-0 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <DialogTitle className="text-base font-bold tracking-tight text-foreground">
              Transfer to Material store
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Enter how many kg to move. Leave a portion in Recycle store if needed.
            </DialogDescription>
          </DialogHeader>

          {transferBatch && (
            <form className="mt-3 space-y-4" onSubmit={handleTransfer}>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-xs space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Lot</span>
                  <span className="font-mono font-semibold">{transferBatch.batchNumber}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Color</span>
                  <span className="font-medium">
                    {colorName(transferBatch.sortColor) ||
                      (transferBatch.colorItems || [])
                        .map((c) => colorName(c.color))
                        .filter(Boolean)
                        .join(', ') ||
                      '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-bold tabular-nums text-emerald-700">
                    {fmt(availableOnModal, 1)} kg
                  </span>
                </div>
              </div>

              {transferError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {transferError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  kg to transfer
                </label>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  max={availableOnModal}
                  className="h-10 text-sm font-semibold tabular-nums"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  autoFocus
                />
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
                    onClick={() => setTransferQty(String(availableOnModal))}
                  >
                    Transfer all ({fmt(availableOnModal, 1)} kg)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={transferring}
                  onClick={closeTransferModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={transferring}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1.5"
                  size="sm"
                >
                  <PackageCheck className="size-3.5" />
                  {transferring ? 'Moving…' : 'Move to Material store'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
