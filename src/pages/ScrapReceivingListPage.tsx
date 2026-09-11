import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Eye, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ScrapReceiptRow = {
  id: number
  batchId: number
  receivedAt: string
  inboundForm: 'RAW' | 'CRUSHED'
  sourceLocation?: string | null
  grossWeight: number | string
  tareWeight: number | string
  netWeight: number | string
  pricePerKg: number | string
  purchaseCost: number | string
  transportCost?: number | string
  loadingCost?: number | string
  unloadingCost?: number | string
  scaleCost?: number | string
  netBagCost?: number | string
  sortingCost?: number | string
  otherCost?: number | string
  totalInboundCost?: number | string
  editable?: boolean
  lockReason?: string | null
  contaminationLevel?: string | null
  vehicleInfo?: string | null
  transporterName?: string | null
  batch?: {
    id: number
    batchNumber: string
    batchType: string
    status: string
    qtyRemaining: number | string
  } | null
  supplier?: { id: number; name: string; code?: string } | null
  material?: { id: number; name: string; code?: string } | null
}

function formatDate(raw?: string) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ScrapReceivingListPage() {
  const navigate = useNavigate()
  const receiptsQuery = useQuery({
    queryKey: ['scrap-receipts'],
    queryFn: async () => {
      const { data } = await api.get('/receiving/scrap')
      return data.data as ScrapReceiptRow[]
    },
  })

  const rows = receiptsQuery.data || []

  const columns: ColumnDef<ScrapReceiptRow>[] = useMemo(
    () => [
      {
        id: 'receivedAt',
        header: 'Date Received',
        accessorKey: 'receivedAt',
        cell: ({ row }) => (
          <span className="text-xs font-bold text-foreground">
            {formatDate(row.original.receivedAt)}
          </span>
        ),
      },
      {
        id: 'batchNumber',
        header: 'Batch / Ticket',
        accessorKey: 'batch.batchNumber',
        cell: ({ row }) => {
          const r = row.original
          const batchNum = r.batch?.batchNumber || `REC-${r.id}`
          return (
            <div>
              <Link
                to={r.batch?.batchNumber ? `/batches/${r.batch.batchNumber}` : '#'}
                className="font-semibold text-sm hover:underline text-[var(--accent-strong)]"
              >
                {batchNum}
              </Link>
              {r.supplier?.name && (
                <p className="text-xs text-[var(--ink-faint)] truncate max-w-[160px]">
                  {r.supplier.name}
                </p>
              )}
            </div>
          )
        },
      },
      {
        id: 'condition',
        header: 'Condition / Type',
        accessorKey: 'inboundForm',
        cell: ({ row }) => {
          const r = row.original
          const isRaw = r.inboundForm === 'RAW'
          return (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-foreground">
                  {isRaw ? 'Raw Scrap' : 'Crushed Scrap'}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border tracking-wide uppercase',
                    isRaw
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-indigo-50 text-indigo-800 border-indigo-300',
                  )}
                >
                  {r.inboundForm || 'RAW'}
                </span>
              </div>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                {Number(r.netWeight || 0).toLocaleString()} kg
              </p>
            </div>
          )
        },
      },
      // {
      //   id: 'supplier',
      //   header: 'Supplier',
      //   accessorKey: 'supplier.name',
      //   cell: ({ row }) => (
      //     <span className="text-sm text-foreground">
      //       {row.original.supplier?.name || '—'}
      //     </span>
      //   ),
      // },
      {
        id: 'totalInboundCost',
        header: 'Total cost',
        accessorFn: (row) =>
          Number(
            row.totalInboundCost ??
              Number(row.purchaseCost || 0) +
                Number(row.transportCost || 0) +
                Number(row.loadingCost || 0) +
                Number(row.unloadingCost || 0) +
                Number(row.scaleCost || 0) +
                Number(row.netBagCost || 0) +
                Number(row.sortingCost || 0) +
                Number(row.otherCost || 0),
          ),
        cell: ({ row }) => {
          const r = row.original
          const total = Number(
            r.totalInboundCost ??
              Number(r.purchaseCost || 0) +
                Number(r.transportCost || 0) +
                Number(r.loadingCost || 0) +
                Number(r.unloadingCost || 0) +
                Number(r.scaleCost || 0) +
                Number(r.netBagCost || 0) +
                Number(r.sortingCost || 0) +
                Number(r.otherCost || 0),
          )
          return (
            <div>
              <span className="text-sm font-semibold text-foreground block">
                ₦
                {total.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs text-[var(--ink-muted)] block mt-0.5">
                Buy ₦
                {Number(r.purchaseCost || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                · @ ₦
                {Number(r.pricePerKg || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                /kg
              </span>
            </div>
          )
        },
      },
 
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => {
          const batchNum = row.original.batch?.batchNumber
          return (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium cursor-pointer"
                disabled={!batchNum}
                onClick={() => {
                  if (batchNum) navigate(`/batches/${batchNum}`)
                }}
              >
                <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span>View</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium cursor-pointer"
                disabled={row.original.editable === false}
                title={
                  row.original.editable === false
                    ? row.original.lockReason || 'Already moved to a later stage'
                    : 'Edit costs'
                }
                onClick={() => navigate(`/receiving/${row.original.id}/edit`)}
              >
                <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                <span>Edit</span>
              </Button>
            </div>
          )
        },
      },
    ],
    [navigate],
  )

  return (
    <PageLayout
      title="Scrap Buying"
      description="Inbound scrap receipts and raw material purchasing ledger"
      actions={
        <Button
          size="sm"
          className="h-8 text-xs font-semibold cursor-pointer"
          onClick={() => navigate('/receiving/new')}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span>New Scrap Buying</span>
        </Button>
      }
    >
      <div className="space-y-5">
     

        {/* Table */}
        <CustomTable1
          data={rows}
          columns={columns}
          // filter={true}
          loading={receiptsQuery.isLoading}
          card={true}
        />
      </div>
    </PageLayout>
  )
}
