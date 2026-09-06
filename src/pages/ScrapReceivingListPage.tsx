import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, PackagePlus, Eye, Scale } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Card } from '@/components/ui/card'
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
  otherCost?: number | string
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
  const receiptsQuery = useQuery({
    queryKey: ['scrap-receipts'],
    queryFn: async () => {
      const { data } = await api.get('/receiving/scrap')
      return data.data as ScrapReceiptRow[]
    },
  })

  const rows = receiptsQuery.data || []

  // Calculate summary metrics
  const totalReceipts = rows.length
  const totalNetKg = rows.reduce((acc, r) => acc + Number(r.netWeight || 0), 0)
  const totalCost = rows.reduce((acc, r) => acc + Number(r.purchaseCost || 0), 0)
  const avgPricePerKg = totalNetKg > 0 ? totalCost / totalNetKg : 0

  const columns: ColumnDef<ScrapReceiptRow>[] = useMemo(
    () => [
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
        id: 'receivedAt',
        header: 'Received Date',
        accessorKey: 'receivedAt',
        cell: ({ row }) => (
          <span className="text-xs text-[var(--ink-muted)] whitespace-nowrap">
            {formatDate(row.original.receivedAt)}
          </span>
        ),
      },
      {
        id: 'inboundForm',
        header: 'Form',
        accessorKey: 'inboundForm',
        cell: ({ row }) => {
          const isRaw = row.original.inboundForm === 'RAW'
          return (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider',
                isRaw
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-purple-100 text-purple-800',
              )}
            >
              {row.original.inboundForm || 'RAW'}
            </span>
          )
        },
      },
      {
        id: 'material',
        header: 'Material',
        accessorKey: 'material.name',
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground">
            {row.original.material?.name || 'Scrap Material'}
          </span>
        ),
      },
      {
        id: 'netWeight',
        header: 'Net Qty (kg)',
        accessorKey: 'netWeight',
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold text-sm text-foreground">
            {Number(row.original.netWeight || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 3,
            })}{' '}
            <span className="text-xs font-normal text-muted-foreground">kg</span>
          </span>
        ),
      },
      {
        id: 'pricePerKg',
        header: 'Price / kg',
        accessorKey: 'pricePerKg',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs text-[var(--ink-muted)]">
            ₦{Number(row.original.pricePerKg || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        id: 'purchaseCost',
        header: 'Purchase Cost',
        accessorKey: 'purchaseCost',
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold text-sm text-foreground">
            ₦{Number(row.original.purchaseCost || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
 
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => {
          const batchNum = row.original.batch?.batchNumber
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium"
              asChild
              disabled={!batchNum}
            >
              {batchNum ? (
                <Link to={`/batches/${batchNum}`} className="inline-flex items-center justify-center gap-1.5 leading-none">
                  <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span>View</span>
                </Link>
              ) : (
                <span>—</span>
              )}
            </Button>
          )
        },
      },
    ],
    [],
  )

  return (
    <PageLayout
      title="Scrap Buying"
      description="Inbound scrap receipts and raw material purchasing ledger"
      actions={
        <Button asChild size="sm" className="h-8 text-xs font-semibold">
          <Link to="/receiving/new" className="inline-flex items-center justify-center gap-1.5 leading-none">
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>New Scrap Buying</span>
          </Link>
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Receipts
              </span>
              <PackagePlus className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {totalReceipts}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Recorded inbound deliveries</p>
          </Card>

          <Card className="p-4 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Inbound
              </span>
              <Scale className="h-4 w-4 text-sky-600" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {totalNetKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
              <span className="text-xs font-normal text-muted-foreground">kg</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Net scrap weight purchased</p>
          </Card>

          <Card className="p-4 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Spend
              </span>
              <span className="text-sm font-bold text-emerald-600">₦</span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground truncate">
              ₦{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Material purchase costs</p>
          </Card>

          <Card className="p-4 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Avg Price / kg
              </span>
              <span className="text-sm font-bold text-purple-600">₦</span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              ₦{avgPricePerKg.toFixed(2)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Weighted average inbound</p>
          </Card>
        </div>

        {/* Table */}
        <CustomTable1
          data={rows}
          columns={columns}
          // filter={true}
          loading={receiptsQuery.isLoading}
        />
      </div>
    </PageLayout>
  )
}
