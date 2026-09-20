import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fmtDozenPcs } from '@/lib/units'
import { formatBusinessDate } from '@/lib/dates'

const RANGE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_year', label: 'Year to date' },
]

type ProductionRow = {
  id: string
  productionRunId: number
  batchNumber: string | null
  businessDate: string | null
  productName: string
  operatorName: string
  shiftName: string
  qtyGood: number
  qtyDamage: number
  dozen: number
  pcs: number
}

type DetailPayload = {
  machine: {
    id: number
    name: string
    code: string | null
    machineType: string | null
    status: string | null
    ratedOutputPerHour: number | null
  }
  range: { label: string; preset: string }
  totals: { qtyGood: number; qtyDamage: number; runs: number }
  productions: ProductionRow[]
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

export function MachineProductionPage() {
  const { machineId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const rangePreset = searchParams.get('rangePreset') || 'this_month'

  const setRange = (preset: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('rangePreset', preset)
    setSearchParams(next, { replace: true })
  }

  const detail = useQuery({
    queryKey: ['production-machine-detail', machineId, rangePreset],
    enabled: Boolean(machineId),
    queryFn: async () => {
      const { data } = await api.get(`/production/machines/${machineId}`, {
        params: { rangePreset },
      })
      return data.data as DetailPayload
    },
    refetchInterval: 15_000,
  })

  const productions = useMemo(() => {
    return (detail.data?.productions || []).filter(
      (row) => Number(row.qtyGood || 0) > 0 || Number(row.qtyDamage || 0) > 0,
    )
  }, [detail.data?.productions])

  const columns = useMemo<ColumnDef<ProductionRow>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-600">
            {row.original.businessDate ? formatBusinessDate(row.original.businessDate) : '—'}
          </span>
        ),
      },
      {
        id: 'operator',
        header: 'Operator',
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-semibold text-zinc-900">{row.original.operatorName}</p>
            <p className="text-[10px] text-zinc-500">{row.original.productName}</p>
          </div>
        ),
      },
      {
        id: 'shift',
        header: 'Shift',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-700">{row.original.shiftName}</span>
        ),
      },
      {
        id: 'produced',
        header: 'Produced',
        cell: ({ row }) => (
          <span className="text-xs font-semibold tabular-nums text-emerald-700">
            {fmtDozenPcs(row.original.qtyGood)}
          </span>
        ),
      },
      {
        id: 'damage',
        header: 'Damage',
        cell: ({ row }) => (
          <span className="text-xs font-semibold tabular-nums text-red-700">
            {fmt(row.original.qtyDamage)} pcs
          </span>
        ),
      },
      {
        id: 'batch',
        header: 'Batch',
        cell: ({ row }) =>
          row.original.batchNumber ? (
            <Link
              to={`/batches/${row.original.batchNumber}`}
              className="font-mono text-[11px] font-semibold text-[var(--accent-strong)] hover:underline"
            >
              {row.original.batchNumber}
            </Link>
          ) : (
            '—'
          ),
      },
    ],
    [],
  )

  const d = detail.data
  const machine = d?.machine

  return (
    <PageLayout
      title={machine?.name || 'Machine'}
      description={d?.range.label ? `History · ${d.range.label}` : undefined}
      back
      backTo={`/production?rangePreset=${rangePreset}`}
      backLabel="Back to production"
      headerClassName="[&_h3]:!text-sm sm:[&_h3]:!text-base md:[&_h3]:!text-lg [&_h3]:leading-snug"
      actions={
        <Select value={rangePreset} onValueChange={setRange}>
          <SelectTrigger className="h-8 w-[140px] sm:w-[160px] text-xs bg-white shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="space-y-4">
        {machine ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-2.5 sm:p-3.5 shadow-xs">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <div className="rounded-md sm:rounded-lg bg-zinc-50 border border-zinc-100 px-1.5 py-1.5 sm:px-2.5 sm:py-2 text-center">
                <p className="text-[8px] sm:text-[9px] uppercase font-bold text-zinc-400">Produced</p>
                <p className="text-xs sm:text-sm font-bold tabular-nums text-zinc-900">
                  {fmtDozenPcs(d?.totals.qtyGood || 0)}
                </p>
              </div>
              <div className="rounded-md sm:rounded-lg bg-zinc-50 border border-zinc-100 px-1.5 py-1.5 sm:px-2.5 sm:py-2 text-center">
                <p className="text-[8px] sm:text-[9px] uppercase font-bold text-zinc-400">Damage</p>
                <p className="text-xs sm:text-sm font-bold tabular-nums text-red-700">
                  {fmt(d?.totals.qtyDamage || 0)}
                </p>
              </div>
              <div className="rounded-md sm:rounded-lg bg-zinc-50 border border-zinc-100 px-1.5 py-1.5 sm:px-2.5 sm:py-2 text-center">
                <p className="text-[8px] sm:text-[9px] uppercase font-bold text-zinc-400">Runs</p>
                <p className="text-xs sm:text-sm font-bold tabular-nums text-zinc-900">
                  {productions.length}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Produced · {d?.range.label || 'period'}
          </h3>
          {detail.isLoading ? (
            <p className="text-xs text-zinc-500 py-8 text-center">Loading…</p>
          ) : productions.length === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center rounded-xl border border-zinc-200 bg-white">
              No production recorded for this period.
            </p>
          ) : (
            <>
              <div className="md:hidden space-y-2">
                {productions.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{row.operatorName}</p>
                        <p className="text-[11px] text-zinc-500">
                          {row.shiftName} · {row.productName}
                        </p>
                      </div>
                      <span className="text-[10px] tabular-nums text-zinc-400">
                        {row.businessDate ? formatBusinessDate(row.businessDate) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-700">
                        {fmtDozenPcs(row.qtyGood)}
                      </span>
                      <span className="font-semibold text-red-700">{fmt(row.qtyDamage)} dmg</span>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden md:block">
                <CustomTable1 data={productions} columns={columns} />
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
