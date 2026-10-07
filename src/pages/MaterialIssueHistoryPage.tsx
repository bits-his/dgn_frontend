import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Button } from '@/components/ui/button'
import { DateRangePreset } from '@/components/DateRangePreset'
import { StatPill } from '@/components/ui'
import {
  dateRangeApiParams,
  dateRangeLabel,
  type DateRangeState,
} from '@/lib/dateRange'
import { formatBusinessDate, formatDateTime } from '@/lib/dates'
import { SORT_COLORS } from '@/lib/sortColors'

type IssueRow = {
  id: number
  businessDate: string | null
  createdAt: string
  qtyKg: number
  uom: string
  notes: string | null
  sourceBatchNumber: string | null
  sortColor: string | null
  materialName: string | null
  machineId: number | null
  machineName: string | null
  machineCode: string | null
  productName: string | null
  productionBatchNumber: string | null
  productionRunId: number | null
  issuedBy: string | null
}

function colorName(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

function applyRangeToParams(current: URLSearchParams, next: DateRangeState) {
  const params = new URLSearchParams(current)
  params.set('rangePreset', next.rangePreset)
  if (next.rangePreset === 'custom' && next.from && next.to) {
    params.set('from', next.from)
    params.set('to', next.to)
  } else {
    params.delete('from')
    params.delete('to')
  }
  return params
}

export function MaterialIssueHistoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const rangeState: DateRangeState = {
    rangePreset: searchParams.get('rangePreset') || 'this_month',
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
  }
  const apiParams = dateRangeApiParams(rangeState)

  const setRange = (next: DateRangeState) => {
    setSearchParams(applyRangeToParams(searchParams, next), { replace: true })
  }

  const query = useQuery({
    queryKey: ['store-issue-history', apiParams],
    queryFn: async () => {
      const { data } = await api.get('/production/store/issues', { params: apiParams })
      return data as {
        data: IssueRow[]
        totalKg: number
        range: { label: string; from: string; to: string }
      }
    },
  })

  const rows = query.data?.data || []
  const totalKg = Number(query.data?.totalKg || 0)
  const rangeLabelText = dateRangeLabel(rangeState, query.data?.range?.label)

  const columns = useMemo<ColumnDef<IssueRow>[]>(
    () => [
      {
        id: 'when',
        header: 'When',
        accessorKey: 'businessDate',
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-bold tabular-nums text-zinc-900">
              {formatBusinessDate(row.original.businessDate)}
            </p>
            <p className="text-[11px] text-zinc-500">{formatDateTime(row.original.createdAt)}</p>
          </div>
        ),
      },
      {
        id: 'machine',
        header: 'Machine',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {row.original.machineName || '—'}
            </p>
            {row.original.machineCode ? (
              <p className="text-[11px] text-zinc-500">{row.original.machineCode}</p>
            ) : null}
            {row.original.productName ? (
              <p className="text-[11px] text-zinc-500">{row.original.productName}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'material',
        header: 'From store',
        cell: ({ row }) => (
          <div>
            {row.original.sourceBatchNumber ? (
              <Link
                to={`/batches/${encodeURIComponent(row.original.sourceBatchNumber)}`}
                className="font-mono text-sm font-semibold text-[var(--accent-strong)] hover:underline"
              >
                {row.original.sourceBatchNumber}
              </Link>
            ) : (
              <span className="text-sm text-zinc-400">—</span>
            )}
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {colorName(row.original.sortColor)}
              {row.original.materialName ? ` · ${row.original.materialName}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'qty',
        header: 'Issued',
        cell: ({ row }) => (
          <span className="text-sm font-bold tabular-nums text-zinc-900">
            {Number(row.original.qtyKg || 0).toLocaleString()} {row.original.uom || 'kg'}
          </span>
        ),
      },
      {
        id: 'run',
        header: 'Run',
        cell: ({ row }) =>
          row.original.productionBatchNumber ? (
            <Link
              to={`/batches/${encodeURIComponent(row.original.productionBatchNumber)}`}
              className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
            >
              {row.original.productionBatchNumber}
            </Link>
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          ),
      },
      {
        id: 'by',
        header: 'By',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600">{row.original.issuedBy || '—'}</span>
        ),
      },
    ],
    [],
  )

  return (
    <PageLayout
      title="Issue history"
      description={`Material sent from the store to machines · ${rangeLabelText}`}
      actions={
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DateRangePreset value={rangeState} onChange={setRange} />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold"
            onClick={() => navigate('/production/store')}
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            Store
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <StatPill label="Issues" value={String(rows.length)} tone="accent" />
          <StatPill
            label="Total kg"
            value={`${totalKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`}
            tone="success"
          />
          <StatPill label="Period" value={rangeLabelText} />
        </div>

        <CustomTable1 data={rows} columns={columns} loading={query.isLoading} card />
      </div>
    </PageLayout>
  )
}
