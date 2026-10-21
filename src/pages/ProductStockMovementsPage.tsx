import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { formatDateTime } from '@/lib/dates'
import { fmtDozenPcs } from '@/lib/units'
import { cn } from '@/lib/utils'

type Mismatch = {
  code: string
  message: string
  balanceOnHand?: number
  ledgerNet?: number
  batchRemainingSum?: number
  delta?: number
}

type Movement = {
  id: number
  direction: string
  qty: number
  uom: string
  reason: string
  referenceType: string | null
  referenceId: number | null
  notes: string | null
  businessDate: string | null
  createdAt: string
  batchNumber: string | null
  locationName: string | null
  createdBy: string | null
}

type ProductStockData = {
  product: {
    id: number
    code: string | null
    name: string
    uom: string
    unitsPerDozen: number
  }
  balanceOnHand: number
  ledgerNet: number
  totalIn: number
  totalOut: number
  batchRemainingSum: number
  mismatches: Mismatch[]
  hasMismatch: boolean
  balanceLines: Array<{
    id: number
    qtyOnHand: number
    locationName: string | null
    batchNumber: string | null
    batchQtyRemaining: number | null
  }>
  movements: Movement[]
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function ProductStockMovementsPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canAdjust = hasPermission(user, 'inventory.adjust')

  const [direction, setDirection] = useState('')
  const [reason, setReason] = useState('')
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [correctOnHand, setCorrectOnHand] = useState('')
  const [notes, setNotes] = useState('')
  const [reasonCode, setReasonCode] = useState('STOCK_COUNT')
  const [formError, setFormError] = useState('')
  const [banner, setBanner] = useState('')

  const detail = useQuery({
    queryKey: ['product-stock-movements', productId, direction, reason],
    enabled: Boolean(productId),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (direction) params.set('direction', direction)
      if (reason) params.set('reason', reason)
      const { data } = await api.get(
        `/inventory/products/${productId}/movements?${params.toString()}`,
      )
      return data.data as ProductStockData
    },
  })

  const d = detail.data
  const product = d?.product

  const reconcile = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/inventory/products/${productId}/reconcile`, {
        correctOnHand: Number(correctOnHand),
        notes,
        reasonCode,
      })
      return data
    },
    onSuccess: (data) => {
      setBanner(data.message || 'Reconciled')
      setReconcileOpen(false)
      setNotes('')
      setFormError('')
      queryClient.invalidateQueries({ queryKey: ['product-stock-movements', productId] })
      queryClient.invalidateQueries({ queryKey: ['inventory-overview'] })
      queryClient.invalidateQueries({ queryKey: ['sellable-batches'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: { data?: { err?: string; errors?: Record<string, string> } }
      }
      const errors = axiosErr.response?.data?.errors
      setFormError(
        axiosErr.response?.data?.err ||
          (errors && Object.values(errors)[0]) ||
          'Could not reconcile',
      )
    },
  })

  const syncBatches = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/inventory/products/${productId}/sync-batches`)
      return data
    },
    onSuccess: (data) => {
      setBanner(data.message || 'Batch remaining synced')
      queryClient.invalidateQueries({ queryKey: ['product-stock-movements', productId] })
      queryClient.invalidateQueries({ queryKey: ['sellable-batches'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { err?: string } } }
      setBanner(axiosErr.response?.data?.err || 'Could not sync batches')
    },
  })

  const openReconcile = () => {
    setCorrectOnHand(String(d?.balanceOnHand ?? 0))
    setNotes('')
    setReasonCode('STOCK_COUNT')
    setFormError('')
    setReconcileOpen(true)
  }

  const deltaPreview = useMemo(() => {
    const target = Number(correctOnHand)
    const before = Number(d?.balanceOnHand || 0)
    if (!Number.isFinite(target)) return null
    return +(target - before).toFixed(3)
  }, [correctOnHand, d?.balanceOnHand])

  const columns = useMemo<ColumnDef<Movement>[]>(
    () => [
      {
        id: 'when',
        header: 'When',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-zinc-800">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'dir',
        header: 'In/Out',
        cell: ({ row }) => {
          const inn = row.original.direction === 'IN'
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold',
                inn ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900',
              )}
            >
              {inn ? (
                <ArrowDownLeft className="size-3" />
              ) : (
                <ArrowUpRight className="size-3" />
              )}
              {row.original.direction}
            </span>
          )
        },
      },
      {
        id: 'qty',
        header: 'Qty',
        cell: ({ row }) => (
          <span
            className={cn(
              'font-bold tabular-nums text-xs',
              row.original.direction === 'IN' ? 'text-emerald-700' : 'text-amber-800',
            )}
          >
            {row.original.direction === 'IN' ? '+' : '−'}
            {fmt(row.original.qty)} {row.original.uom}
          </span>
        ),
      },
      {
        id: 'reason',
        header: 'Reason',
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-semibold text-zinc-900">{row.original.reason}</p>
            {row.original.referenceType ? (
              <p className="text-[11px] text-zinc-500">
                {row.original.referenceType}
                {row.original.referenceId != null ? ` #${row.original.referenceId}` : ''}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'batch',
        header: 'Batch',
        cell: ({ row }) =>
          row.original.batchNumber ? (
            <Link
              to={`/batches/${encodeURIComponent(row.original.batchNumber)}`}
              className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
            >
              {row.original.batchNumber}
            </Link>
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          ),
      },
      {
        id: 'location',
        header: 'Location',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-700">{row.original.locationName || '—'}</span>
        ),
      },
      {
        id: 'by',
        header: 'By',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600">{row.original.createdBy || '—'}</span>
        ),
      },
      {
        id: 'notes',
        header: 'Notes',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 line-clamp-2 max-w-[14rem]">
            {row.original.notes || '—'}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <PageLayout
      title={product ? product.name : 'Product movements'}
      description={
        product
          ? `${product.code || 'Product'} · IN/OUT history and stock reconcile`
          : 'Loading…'
      }
      actions={
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {canAdjust && d?.hasMismatch ? (
            <>
              {d.mismatches.some((m) => m.code === 'BALANCE_VS_BATCH') ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold"
                  disabled={syncBatches.isPending}
                  onClick={() => syncBatches.mutate()}
                >
                  <RefreshCw className="size-3.5" />
                  Sync batches
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
                onClick={openReconcile}
              >
                Reconcile
              </Button>
            </>
          ) : canAdjust ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={openReconcile}
            >
              Reconcile
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold"
            onClick={() => navigate('/inventory')}
          >
            <ArrowLeft className="size-3.5" />
            Inventory
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {banner ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              {banner}
            </div>
            <button type="button" className="cursor-pointer" onClick={() => setBanner('')}>
              ×
            </button>
          </div>
        ) : null}

        {d?.hasMismatch ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 space-y-1.5">
            <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              Mismatch detected
            </p>
            {d.mismatches.map((m) => (
              <p key={m.code} className="text-[11px] text-amber-900">
                {m.message}
              </p>
            ))}
            <p className="text-[11px] text-amber-800/80 pt-1">
              On hand (balances) is the sellable truth. Use <strong>Sync batches</strong> if only
              batch remaining drifted. Use <strong>Reconcile</strong> to set the correct physical
              count (posts an ADJUSTMENT IN/OUT).
            </p>
          </div>
        ) : d && !detail.isLoading ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[11px] font-medium text-emerald-900 flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" />
            Balances, ledger net, and batch remaining agree.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatPill
            label="On hand"
            value={product ? fmtDozenPcs(d?.balanceOnHand || 0) : '—'}
            tone="success"
          />
          <StatPill
            label="Ledger net"
            value={fmt(d?.ledgerNet || 0)}
            tone={d?.mismatches.some((m) => m.code === 'BALANCE_VS_LEDGER') ? 'danger' : 'default'}
            hint={`IN ${fmt(d?.totalIn || 0)} · OUT ${fmt(d?.totalOut || 0)}`}
          />
          <StatPill
            label="Batch remaining"
            value={fmt(d?.batchRemainingSum || 0)}
            tone={d?.mismatches.some((m) => m.code === 'BALANCE_VS_BATCH') ? 'danger' : 'default'}
          />
          <StatPill
            label="Movements"
            value={String(d?.movements?.length || 0)}
            tone="accent"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={direction || 'all'}
            onValueChange={(v) => setDirection(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="h-8 w-[7.5rem] text-xs">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="IN">IN</SelectItem>
              <SelectItem value="OUT">OUT</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reason || 'all'} onValueChange={(v) => setReason(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-[10rem] text-xs">
              <SelectValue placeholder="Reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reasons</SelectItem>
              {[
                'PRODUCTION',
                'SALE',
                'TRANSFER',
                'ADJUSTMENT',
                'RETURN',
                'RECEIVING',
                'WASTE',
              ].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {d?.balanceLines?.length ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Balance lines
            </p>
            <ul className="space-y-1">
              {d.balanceLines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-2 text-xs text-zinc-800"
                >
                  <span>
                    {line.locationName || 'Location'}
                    {line.batchNumber ? (
                      <>
                        {' · '}
                        <Link
                          to={`/batches/${encodeURIComponent(line.batchNumber)}`}
                          className="font-mono font-semibold text-[var(--accent-strong)] hover:underline"
                        >
                          {line.batchNumber}
                        </Link>
                      </>
                    ) : null}
                  </span>
                  <span className="font-bold tabular-nums text-emerald-700">
                    {fmt(line.qtyOnHand)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <CustomTable1
          data={d?.movements || []}
          columns={columns}
          loading={detail.isLoading}
          card={true}
        />
      </div>

      <Dialog open={reconcileOpen} onOpenChange={setReconcileOpen}>
        <DialogContent className="max-h-[92vh] w-[min(90vw,28rem)] max-w-[min(90vw,28rem)] overflow-y-auto p-4 sm:p-5">
          <DialogHeader className="mb-0 pb-2 border-b border-zinc-100">
            <DialogTitle className="text-base font-bold">Reconcile stock</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Set the correct physical on hand. We post an ADJUSTMENT IN or OUT for the difference,
              then sync batch remaining from balances.
            </DialogDescription>
          </DialogHeader>

          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              setFormError('')
              if (!(Number(correctOnHand) >= 0)) {
                setFormError('Enter a valid on-hand quantity.')
                return
              }
              if (notes.trim().length < 5) {
                setFormError('Add a short note (at least 5 characters).')
                return
              }
              reconcile.mutate()
            }}
          >
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">System on hand</span>
                <span className="font-bold tabular-nums">{fmt(d?.balanceOnHand || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ledger net</span>
                <span className="font-bold tabular-nums">{fmt(d?.ledgerNet || 0)}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Correct on hand
              </label>
              <Input
                type="number"
                step="any"
                min={0}
                className="h-10 text-sm font-semibold tabular-nums"
                value={correctOnHand}
                onChange={(e) => setCorrectOnHand(e.target.value)}
                autoFocus
              />
              {deltaPreview != null && Math.abs(deltaPreview) > 0.0001 ? (
                <p className="mt-1 text-[11px] text-zinc-600">
                  Will post ADJUSTMENT {deltaPreview > 0 ? 'IN' : 'OUT'}{' '}
                  <strong>
                    {Math.abs(deltaPreview)} {product?.uom || 'pcs'}
                  </strong>
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-zinc-500">
                  No balance change — will only sync batch remaining.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Reason</label>
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['STOCK_COUNT', 'DATA_ENTRY_ERROR', 'DAMAGE', 'OTHER'].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Note (required)
              </label>
              <Input
                className="h-9 text-xs"
                placeholder="e.g. stock take 21 Oct"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {formError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={reconcile.isPending}
                onClick={() => setReconcileOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={reconcile.isPending}>
                {reconcile.isPending ? 'Saving…' : 'Confirm reconcile'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
