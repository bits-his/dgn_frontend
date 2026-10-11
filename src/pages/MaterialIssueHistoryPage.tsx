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
import { formatDateTime } from '@/lib/dates'
import { SORT_COLORS } from '@/lib/sortColors'

type IssueLine = { label: string; qtyKg: number }

type IssueRow = {
  id: number
  businessDate: string | null
  createdAt: string
  totalKg: number
  summary: string
  lines: IssueLine[]
  machineId: number | null
  machineName: string | null
  machineCode: string | null
  productName: string | null
  productionBatchNumber: string | null
  productionRunId: number | null
}

function prettyLabel(raw?: string | null) {
  if (!raw) return '—'
  const cleaned = String(raw)
    .replace(/\s*\((Masterbatch|Normal Pigment|Virgin)\)/i, '')
    .trim()
  const hit = SORT_COLORS.find((c) => c.code === cleaned)
  return hit ? hit.name : cleaned || raw
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

function IssuedLines({ row }: { row: IssueRow }) {
  const lines = row.lines || []
  if (!lines.length) {
    return <span className="text-sm text-zinc-500">{row.summary || '—'}</span>
  }
  return (
    <ul className="space-y-1">
      {lines.map((l) => (
        <li key={`${l.label}-${l.qtyKg}`} className="text-sm font-semibold text-zinc-900">
          <span className="font-mono tabular-nums">{Number(l.qtyKg).toLocaleString()} kg</span>{' '}
          {prettyLabel(l.label)}
        </li>
      ))}
    </ul>
  )
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
        accessorKey: 'createdAt',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-zinc-800">
            {formatDateTime(row.original.createdAt)}
          </span>
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
            {row.original.productName ? (
              <p className="text-[11px] text-zinc-500">{row.original.productName}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'run',
        header: 'Production batch',
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
        id: 'issued',
        header: 'Issued',
        cell: ({ row }) => <IssuedLines row={row.original} />,
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
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2.5">
          {query.isLoading ? (
            <p className="py-8 text-center text-xs text-zinc-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-500">No issues in this range.</p>
          ) : (
            rows.map((row) => (
              <article
                key={row.id}
                className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900">
                      {row.machineName || '—'}
                    </p>
                    {row.productName ? (
                      <p className="text-[11px] text-zinc-500">{row.productName}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-[11px] font-semibold tabular-nums text-zinc-500">
                    {formatDateTime(row.createdAt)}
                  </p>
                </div>

                {row.productionBatchNumber ? (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Production batch
                    </p>
                    <Link
                      to={`/batches/${encodeURIComponent(row.productionBatchNumber)}`}
                      className="mt-0.5 inline-block font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                    >
                      {row.productionBatchNumber}
                    </Link>
                  </div>
                ) : null}

                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Issued
                  </p>
                  <IssuedLines row={row} />
                </div>
              </article>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <CustomTable1 data={rows} columns={columns} loading={query.isLoading} />
        </div>
      </div>
    </PageLayout>
  )
}
