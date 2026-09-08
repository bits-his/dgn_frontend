import { useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Eye, Play } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Button } from '@/components/ui/button'
import {
  STAGE_META,
  type InputBatch,
  colorName,
  formatBusinessDate,
  formatCreatedAt,
  qtyLabel,
} from '@/pages/ProcessStagePage'

export function ProcessStageListPage() {
  const { stage = 'sorting' } = useParams()
  const [searchParams] = useSearchParams()
  const meta = STAGE_META[stage] || STAGE_META.sorting
  const isSorting = stage === 'sorting'

  // If a ?batch= query param is provided, forward directly to the form page
  const batchParam = searchParams.get('batch')
  if (batchParam) {
    return <Navigate to={`/process/${stage}/new?batch=${encodeURIComponent(batchParam)}`} replace />
  }

  const inputs = useQuery({
    queryKey: ['process-inputs', stage],
    queryFn: async () => {
      const { data } = await api.get(`/process/${stage}/inputs`)
      return data.data as InputBatch[]
    },
  })

  // Build columns for the queue CustomTable1
  const queueColumns = useMemo((): ColumnDef<InputBatch>[] => [
    {
      accessorKey: 'batchNumber',
      header: 'Batch',
      cell: ({ row }) => (
        <div>
          <Link
            to={`/batches/${row.original.batchNumber}`}
            className="font-semibold tracking-tight text-sm text-[var(--accent-strong)] hover:underline"
          >
            {row.original.batchNumber}
          </Link>
          <p className="mt-0.5 text-xs text-[var(--ink-faint)]">{row.original.batchType}</p>
        </div>
      ),
    },
    ...(!isSorting
      ? [
        {
          accessorKey: 'sortColor',
          header: 'Colour',
          cell: ({ row }: { row: { original: InputBatch } }) => (
            <span className="text-sm text-[var(--ink-muted)]">
              {colorName(row.original.sortColor)}
            </span>
          ),
        },
      ]
      : []),
    {
      accessorFn: (row) => row.material?.name ?? '',
      id: 'material',
      header: 'Material',
      cell: ({ row }) => (
        <div>
          <span className="text-sm font-medium text-foreground block">
            {row.original.material?.name || '—'}
          </span>
          <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 block">
            {qtyLabel(row.original.qtyRemaining, row.original.uom)}
          </span>
        </div>
      ),
    },
    {
      accessorFn: (row) => row.location?.name ?? '',
      id: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <span className="text-sm text-[var(--ink-muted)]">{row.original.location?.name || '—'}</span>
      ),
    },
    {
      accessorKey: 'businessDate',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-[var(--ink-muted)]">
          {formatBusinessDate(row.original.businessDate) || formatCreatedAt(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Action',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs font-medium" asChild>
            <Link
              to={`/batches/${row.original.batchNumber}`}
              className="inline-flex items-center justify-center gap-1.5 leading-none"
            >
              <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <span>View</span>
            </Link>
          </Button>
          <Button size="sm" className="h-8 text-xs font-semibold" asChild>
            <Link
              to={`/process/${stage}/new?batch=${encodeURIComponent(row.original.batchNumber)}`}
              className="inline-flex items-center justify-center gap-1.5 leading-none"
            >
              <Play className="h-3 w-3 shrink-0 fill-current" />
              <span>Process</span>
            </Link>
          </Button>
        </div>
      ),
    },
  ], [isSorting, stage])

  return (
    <PageLayout
      title={meta.title}
      description={meta.queueTitle}
      actions={
        <Button asChild size="sm" className="h-8 text-xs font-semibold">
          <Link
            to={`/process/${stage}/new`}
            className="inline-flex items-center justify-center gap-1.5 leading-none"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>Record {meta.title}</span>
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <CustomTable1
          data={inputs.data || []}
          columns={queueColumns}
          loading={inputs.isLoading}
          card={true}
        />
      </div>
    </PageLayout>
  )
}
