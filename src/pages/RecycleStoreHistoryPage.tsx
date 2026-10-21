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
import { cn } from '@/lib/utils'

type HistoryRow = {
  id: number
  businessDate: string | null
  createdAt: string
  direction: string
  event: string
  qtyKg: number
  uom: string
  notes: string | null
  batchNumber: string | null
  batchType: string | null
  color: string | null
  byUser: string | null
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

export function RecycleStoreHistoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const kind = (searchParams.get('kind') || 'all') as 'all' | 'receive' | 'transfer'
  const rangeState: DateRangeState = {
    rangePreset: searchParams.get('rangePreset') || 'this_month',
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
  }
  const apiParams = { ...dateRangeApiParams(rangeState), kind }

  const setRange = (next: DateRangeState) => {
    setSearchParams(applyRangeToParams(searchParams, next), { replace: true })
  }

  const setKind = (next: typeof kind) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'all') params.delete('kind')
    else params.set('kind', next)
    setSearchParams(params, { replace: true })
  }

  const query = useQuery({
    queryKey: ['recycle-store-history', apiParams],
    queryFn: async () => {
      const { data } = await api.get('/production/recycle-store/history', {
        params: apiParams,
      })
      return data as {
        data: HistoryRow[]
        receivedKg: number
        transferredKg: number
        range: { label: string; from: string; to: string }
      }
    },
  })

  const rows = query.data?.data || []
  const receivedKg = Number(query.data?.receivedKg || 0)
  const transferredKg = Number(query.data?.transferredKg || 0)
  const rangeLabelText = dateRangeLabel(rangeState, query.data?.range?.label)

  const columns = useMemo<ColumnDef<HistoryRow>[]>(
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
        id: 'event',
        header: 'Event',
        cell: ({ row }) => {
          const inn = row.original.direction === 'IN'
          return (
            <span
              className={cn(
                'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-bold',
                inn
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-teal-50 text-teal-800',
              )}
            >
              {row.original.event}
            </span>
          )
        },
      },
      {
        id: 'lot',
        header: 'Lot',
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
        id: 'color',
        header: 'Color',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-800">{colorName(row.original.color)}</span>
        ),
      },
      {
        id: 'qty',
        header: 'kg',
        cell: ({ row }) => (
          <span
            className={cn(
              'font-bold tabular-nums text-xs',
              row.original.direction === 'IN' ? 'text-emerald-700' : 'text-teal-700',
            )}
          >
            {row.original.direction === 'IN' ? '+' : '−'}
            {Number(row.original.qtyKg).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}{' '}
            kg
          </span>
        ),
      },
      {
        id: 'by',
        header: 'By',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600">{row.original.byUser || '—'}</span>
        ),
      },
    ],
    [],
  )

  return (
    <PageLayout
      title="Recycle store history"
      description={`Receiving in and transfers out · ${rangeLabelText}`}
      actions={
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DateRangePreset value={rangeState} onChange={setRange} />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold"
            onClick={() => navigate('/production/recycle-store')}
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            Store
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'All'],
              ['receive', 'Receiving'],
              ['transfer', 'Transfers'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                kind === value
                  ? 'bg-teal-600 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <StatPill label="Events" value={String(rows.length)} tone="accent" />
          <StatPill
            label="Received"
            value={`${receivedKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`}
            tone="success"
          />
          <StatPill
            label="Transferred out"
            value={`${transferredKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`}
            tone="default"
          />
        </div>

        <div className="md:hidden space-y-2.5">
          {query.isLoading ? (
            <p className="py-8 text-center text-xs text-zinc-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-500">No movements in this range.</p>
          ) : (
            rows.map((row) => (
              <article
                key={row.id}
                className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-bold',
                      row.direction === 'IN'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-teal-50 text-teal-800',
                    )}
                  >
                    {row.event}
                  </span>
                  <p className="shrink-0 text-[11px] font-semibold tabular-nums text-zinc-500">
                    {formatDateTime(row.createdAt)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  {row.batchNumber ? (
                    <Link
                      to={`/batches/${encodeURIComponent(row.batchNumber)}`}
                      className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                    >
                      {row.batchNumber}
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                  <span
                    className={cn(
                      'font-bold tabular-nums text-xs',
                      row.direction === 'IN' ? 'text-emerald-700' : 'text-teal-700',
                    )}
                  >
                    {row.direction === 'IN' ? '+' : '−'}
                    {Number(row.qtyKg).toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}{' '}
                    kg
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  {colorName(row.color)}
                  {row.byUser ? ` · ${row.byUser}` : ''}
                </p>
              </article>
            ))
          )}
        </div>

        <div className="hidden md:block">
          <CustomTable1 data={rows} columns={columns} loading={query.isLoading} />
        </div>
      </div>
    </PageLayout>
  )
}
