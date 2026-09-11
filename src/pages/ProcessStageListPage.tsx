import { useMemo } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  const navigate = useNavigate()
  const { stage = 'sorting' } = useParams()
  const [searchParams] = useSearchParams()
  const meta = STAGE_META[stage] || STAGE_META.sorting
  const isSorting = stage === 'sorting'
  const isCrushing = stage === 'crushing'
  const showColor = !isSorting && !isCrushing

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
    ...(showColor
      ? [
          {
            accessorKey: 'sortColor',
            header: 'Colour',
            cell: ({ row }: { row: { original: InputBatch } }) => {
              const colorItems = row.original.colorItems
              if (colorItems && colorItems.length > 0) {
                const fullTooltip = colorItems
                  .map((c) => `${colorName(c.color)}: ${c.qtyCrushed}kg`)
                  .join(' · ')

                return (
                  <div
                    className="flex items-center gap-1 sm:gap-1.5 flex-nowrap"
                    title={fullTooltip}
                  >
                    {/* First colour badge always shown */}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200/80 shrink-0">
                      {colorName(colorItems[0].color)}: {colorItems[0].qtyCrushed}kg
                    </span>

                    {/* Second colour badge shown on sm+ screens */}
                    {colorItems.length > 1 && (
                      <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200/80 shrink-0">
                        {colorName(colorItems[1].color)}: {colorItems[1].qtyCrushed}kg
                      </span>
                    )}

                    {/* On mobile (<sm), if >1 items, show +X more */}
                    {colorItems.length > 1 && (
                      <span className="sm:hidden inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0 cursor-default">
                        +{colorItems.length - 1}
                      </span>
                    )}

                    {/* On desktop (sm+), if >2 items, show +X more */}
                    {colorItems.length > 2 && (
                      <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0 cursor-default">
                        +{colorItems.length - 2} more
                      </span>
                    )}
                  </div>
                )
              }
              return (
                <span className="text-xs sm:text-sm text-[var(--ink-muted)]">
                  {colorName(row.original.sortColor)}
                </span>
              )
            },
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
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 sm:h-8 px-2 sm:px-2.5 text-xs font-medium cursor-pointer"
            onClick={() => navigate(`/batches/${row.original.batchNumber}`)}
            title="View batch details"
          >
            <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span className="hidden sm:inline">View</span>
          </Button>
          <Button
            size="sm"
            className="h-7 sm:h-8 px-2 sm:px-3 text-xs font-semibold cursor-pointer"
            onClick={() =>
              navigate(`/process/${stage}/new?batch=${encodeURIComponent(row.original.batchNumber)}`)
            }
          >
            <Play className="h-3 w-3 shrink-0 fill-current" />
            <span>Process</span>
          </Button>
        </div>
      ),
    },
  ], [showColor, stage, navigate])

  return (
    <PageLayout
      title={meta.title}
      description={meta.queueTitle}
      actions={
        <Button
          size="sm"
          className="h-8 text-xs font-semibold cursor-pointer"
          onClick={() => navigate(`/process/${stage}/new`)}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span>Record {meta.title}</span>
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
