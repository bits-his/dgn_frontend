import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Eye, Pencil, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { parsePhotoUrls, mediaUrl } from '@/lib/maintenanceForm'

type ScrapReceiptRow = {
  id: number
  batchId: number
  receivedAt: string
  inboundForm: 'RAW' | 'CRUSHED' | 'RECYCLED'
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
  photoUrls?: string[] | string | null
  batch?: {
    id: number
    batchNumber: string
    batchType: string
    status: string
    qtyRemaining: number | string
    businessDate?: string | null
  } | null
  supplier?: { id: number; name: string; code?: string } | null
  material?: { id: number; name: string; code?: string } | null
}

const STAGE_LABEL: Record<string, string> = {
  SCRAP: 'Bought',
  SORT: 'Sorted',
  CRUSH: 'Crushed',
  WASH: 'Washed',
  DRY: 'Dried',
  RECYCLE: 'Recycled',
  PROD: 'Production',
}

function stageBadgeClass(stage?: string) {
  const s = (stage || '').toUpperCase()
  if (s === 'SCRAP') return 'bg-amber-50 text-amber-800 border-amber-300'
  if (s === 'SORT') return 'bg-blue-50 text-blue-800 border-blue-300'
  if (s === 'CRUSH') return 'bg-purple-50 text-purple-800 border-purple-300'
  if (s === 'WASH') return 'bg-cyan-50 text-cyan-800 border-cyan-300'
  if (s === 'DRY') return 'bg-orange-50 text-orange-800 border-orange-300'
  if (s === 'RECYCLE' || s === 'PROD') return 'bg-emerald-50 text-emerald-800 border-emerald-300'
  return 'bg-zinc-50 text-zinc-700 border-zinc-300'
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
  const qc = useQueryClient()
  const [deleteError, setDeleteError] = useState('')
  const receiptsQuery = useQuery({
    queryKey: ['scrap-receipts'],
    queryFn: async () => {
      const { data } = await api.get('/receiving/scrap')
      return data.data as ScrapReceiptRow[]
    },
  })

  const rows = receiptsQuery.data || []

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/receiving/scrap/${id}`)
      return data.data
    },
    onSuccess: () => {
      setDeleteError('')
      qc.invalidateQueries({ queryKey: ['scrap-receipts'] })
    },
    onError: (err: any) => {
      setDeleteError(err.response?.data?.err || err.message || 'Could not delete this buy')
    },
  })

  function confirmDelete(row: ScrapReceiptRow) {
    const label = row.batch?.batchNumber || `REC-${row.id}`
    if (!window.confirm(`Delete scrap buy ${label}? This cannot be undone.`)) return
    deleteMutation.mutate(row.id)
  }

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
          const thumbs = parsePhotoUrls(r.photoUrls).slice(0, 3)
          return (
            <div>
              <Link
                to={`/receiving/${r.id}`}
                className="font-semibold text-sm hover:underline text-[var(--accent-strong)]"
              >
                {batchNum}
              </Link>
              {r.supplier?.name && (
                <p className="text-xs text-[var(--ink-faint)] truncate max-w-[160px]">
                  {r.supplier.name}
                </p>
              )}
              {thumbs.length > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  {thumbs.map((src, i) => (
                    <img
                      key={`${src.slice(0, 20)}-${i}`}
                      src={mediaUrl(src)}
                      alt=""
                      className="size-7 rounded object-cover border border-zinc-200"
                    />
                  ))}
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'condition',
        header: 'Bought as',
        accessorKey: 'inboundForm',
        cell: ({ row }) => {
          const r = row.original
          const form = r.inboundForm || 'RAW'
          const label =
            form === 'RECYCLED' ? 'Recycled' : form === 'CRUSHED' ? 'Crushed scrap' : 'Raw scrap'
          const badgeClass =
            form === 'RECYCLED'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : form === 'CRUSHED'
                ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
          return (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-foreground">{label}</span>
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border tracking-wide uppercase',
                    badgeClass,
                  )}
                >
                  {form}
                </span>
              </div>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                {Number(r.netWeight || 0).toLocaleString()} kg
              </p>
            </div>
          )
        },
      },
      {
        id: 'stage',
        header: 'Current stage',
        accessorFn: (row) => row.batch?.batchType || 'SCRAP',
        cell: ({ row }) => {
          const type = (row.original.batch?.batchType || 'SCRAP').toUpperCase()
          return (
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border tracking-wide',
                stageBadgeClass(type),
              )}
            >
              {STAGE_LABEL[type] || type}
            </span>
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
          const receiptId = row.original.id
          return (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium cursor-pointer"
                onClick={() => navigate(`/receiving/${receiptId}`)}
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
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50"
                disabled={row.original.editable === false || deleteMutation.isPending}
                title={
                  row.original.editable === false
                    ? row.original.lockReason || 'Already moved to a later stage'
                    : 'Delete this buy'
                }
                onClick={() => confirmDelete(row.original)}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span>Delete</span>
              </Button>
            </div>
          )
        },
      },
    ],
    [navigate, deleteMutation.isPending],
  )

  return (
    <PageLayout
      title="Scrap Buying"
      description="Every scrap purchase stays here after crushing, washing, drying, or re-crushing"
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
        {deleteError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {deleteError}
          </p>
        ) : null}
     

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
