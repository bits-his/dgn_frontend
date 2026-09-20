import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { colorName, formatCreatedAt } from '@/pages/ProcessStagePage'

type SecondGradeRow = {
  id: number
  batchId: number
  batchNumber: string | null
  color: string | null
  materialName: string | null
  qtyKg: number
  pricePerKg: number
  totalValue: number
  washedAt: string | null
  operatorName: string | null
  machineName: string | null
  firstGradeKg: number
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function SecondGradePage() {
  const query = useQuery({
    queryKey: ['second-grade'],
    queryFn: async () => {
      const { data } = await api.get('/process/second-grade')
      return data.data as SecondGradeRow[]
    },
  })

  const rows = query.data || []
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.kg += Number(r.qtyKg || 0)
        acc.value += Number(r.totalValue || 0)
        return acc
      },
      { kg: 0, value: 0 },
    )
  }, [rows])

  const columns = useMemo<ColumnDef<SecondGradeRow>[]>(
    () => [
      {
        accessorKey: 'washedAt',
        header: 'Washed',
        cell: ({ row }) => (
          <span className="text-xs font-semibold tabular-nums">
            {formatCreatedAt(row.original.washedAt || undefined)}
          </span>
        ),
      },
      {
        accessorKey: 'batchNumber',
        header: 'Batch',
        cell: ({ row }) =>
          row.original.batchNumber ? (
            <Link
              to={`/batches/${encodeURIComponent(row.original.batchNumber)}`}
              className="text-sm font-semibold text-[var(--accent-strong)] hover:underline"
            >
              {row.original.batchNumber}
            </Link>
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          ),
      },
      {
        accessorKey: 'color',
        header: 'Colour',
        cell: ({ row }) => (
          <span className="text-xs font-medium">{colorName(row.original.color)}</span>
        ),
      },
      {
        accessorKey: 'qtyKg',
        header: 'Kg',
        cell: ({ row }) => (
          <span className="text-xs font-mono font-semibold tabular-nums">
            {Number(row.original.qtyKg || 0).toLocaleString()} kg
          </span>
        ),
      },
      {
        accessorKey: 'pricePerKg',
        header: '₦ / kg',
        cell: ({ row }) => (
          <span className="text-xs font-mono tabular-nums">{money(row.original.pricePerKg)}</span>
        ),
      },
      {
        accessorKey: 'totalValue',
        header: 'Value',
        cell: ({ row }) => (
          <span className="text-xs font-bold tabular-nums text-amber-800">
            {money(row.original.totalValue)}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <PageLayout
      title="Second grade"
      description="Second-grade material taken out during washing"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total kg</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{totals.kg.toLocaleString()} kg</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800/70">Value out</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-950">{money(totals.value)}</p>
          </div>
        </div>
        <CustomTable1 data={rows} columns={columns} loading={query.isLoading} card />
      </div>
    </PageLayout>
  )
}
