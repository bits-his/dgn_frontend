import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { HardHat, Layers, Factory } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Card } from '@/components/ui/card'
import CustomTable1 from '@/components/CustomTable1'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

type WorkRow = {
  id: string
  kind: 'production' | 'process'
  stage: string
  at: string | null
  endedAt: string | null
  status: string | null
  batchNumber: string | null
  machineName: string | null
  productName: string | null
  qtyGood: number | null
  qtyReject: number | null
  qtyInput: number | null
  qtyUsable: number | null
  runtimeMinutes: number | null
  productionRunId: number | null
}

type OperatorWork = {
  employee: {
    id: number
    employeeCode: string
    firstname: string
    lastname: string
    name: string
    isActive: boolean
  }
  totals: {
    jobs: number
    productionJobs: number
    processJobs: number
    qtyGood: number
    qtyReject: number
    kgProcessed: number
    runtimeMinutes: number
  }
  work: WorkRow[]
}

function fmt(n: number | null | undefined, digits = 2) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: digits })
}

function formatMinutes(mins: number) {
  const m = Math.max(0, Math.round(Number(mins || 0)))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}

export function OperatorWorkPage() {
  const { id } = useParams<{ id: string }>()

  const query = useQuery({
    queryKey: ['operator-work', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get(`/labour/employees/${id}/work`)
      return data.data as OperatorWork
    },
  })

  const columns = useMemo<ColumnDef<WorkRow>[]>(
    () => [
      {
        accessorKey: 'at',
        header: 'When',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 tabular-nums whitespace-nowrap">
            {formatDateTime(row.original.at)}
          </span>
        ),
      },
      {
        accessorKey: 'stage',
        header: 'Work',
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
                  row.original.kind === 'production'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-sky-50 text-sky-800 border border-sky-200',
                )}
              >
                {row.original.kind === 'production' ? 'Production' : 'Process'}
              </span>
              <span className="text-xs font-semibold text-zinc-900">{row.original.stage}</span>
            </div>
            {row.original.productName && (
              <p className="text-[11px] text-zinc-500">{row.original.productName}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'batchNumber',
        header: 'Batch',
        cell: ({ row }) => {
          const batch = row.original.batchNumber
          if (!batch) return <span className="text-xs text-zinc-400">—</span>
          return (
            <Link
              to={`/batches/${encodeURIComponent(batch)}`}
              className="text-xs font-semibold text-zinc-800 hover:underline"
            >
              {batch}
            </Link>
          )
        },
      },
      {
        accessorKey: 'machineName',
        header: 'Machine',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-700">{row.original.machineName || '—'}</span>
        ),
      },
      {
        id: 'output',
        header: 'Output',
        cell: ({ row }) => {
          const r = row.original
          if (r.kind === 'production') {
            return (
              <div>
                <p className="text-xs font-semibold tabular-nums text-zinc-900">
                  {fmt(r.qtyGood, 0)} good
                </p>
                {Number(r.qtyReject) > 0 && (
                  <p className="text-[11px] text-rose-600 tabular-nums">{fmt(r.qtyReject, 0)} reject</p>
                )}
              </div>
            )
          }
          return (
            <div>
              <p className="text-xs font-semibold tabular-nums text-zinc-900">
                {fmt(r.qtyUsable)} kg usable
              </p>
              <p className="text-[11px] text-zinc-500 tabular-nums">{fmt(r.qtyInput)} kg in</p>
            </div>
          )
        },
      },
      {
        accessorKey: 'runtimeMinutes',
        header: 'Time',
        cell: ({ row }) =>
          row.original.runtimeMinutes ? (
            <span className="text-xs tabular-nums text-zinc-700">
              {formatMinutes(row.original.runtimeMinutes)}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase',
              row.original.status === 'ACTIVE'
                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                : 'bg-zinc-100 text-zinc-600',
            )}
          >
            {row.original.status || '—'}
          </span>
        ),
      },
      {
        id: 'open',
        header: '',
        cell: ({ row }) =>
          row.original.productionRunId ? (
            <Link
              to={`/production/${row.original.productionRunId}/work`}
              className="text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 hover:underline"
            >
              Open run
            </Link>
          ) : null,
      },
    ],
    [],
  )

  if (query.isLoading) {
    return (
      <PageLayout back backTo="/operators" backLabel="Operators" title="Operator work">
        <Card className="p-6 text-xs text-zinc-500">Loading operator work…</Card>
      </PageLayout>
    )
  }

  if (query.isError || !query.data) {
    return (
      <PageLayout back backTo="/operators" backLabel="Operators" title="Operator work">
        <Card className="p-6 text-xs text-red-700">This operator could not be found.</Card>
      </PageLayout>
    )
  }

  const { employee, totals, work } = query.data

  return (
    <PageLayout
      back
      backTo="/operators"
      backLabel="Operators"
      title={employee.name}
      description={`${employee.employeeCode} · Operator · ${employee.isActive ? 'Active' : 'Inactive'}`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Jobs recorded
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black tabular-nums text-zinc-900">{totals.jobs}</span>
              <span className="text-xs text-zinc-500">total</span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Production
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black tabular-nums text-zinc-900">{fmt(totals.qtyGood, 0)}</span>
              <span className="text-xs text-zinc-500">pcs good</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">{totals.productionJobs} shifts</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Process
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black tabular-nums text-zinc-900">{fmt(totals.kgProcessed)}</span>
              <span className="text-xs text-zinc-500">kg in</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">{totals.processJobs} runs</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Runtime
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black tabular-nums text-zinc-900">
                {formatMinutes(totals.runtimeMinutes)}
              </span>
            </div>
            {totals.qtyReject > 0 && (
              <p className="mt-1 text-[11px] text-rose-600">{fmt(totals.qtyReject)} reject</p>
            )}
          </div>
        </div>

        {work.length === 0 ? (
          <Card className="p-10 text-center space-y-2 border border-dashed">
            <HardHat className="size-8 text-zinc-300 mx-auto" />
            <p className="text-sm font-semibold text-zinc-800">No work recorded yet</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Production clock-ins and crushing / washing / drying / re-crush jobs for this operator will
              show here.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Factory className="size-3.5" /> {totals.productionJobs} production
              </span>
              <span className="inline-flex items-center gap-1">
                <Layers className="size-3.5" /> {totals.processJobs} process
              </span>
            </div>
            <CustomTable1 columns={columns} data={work} card />
          </div>
        )}
      </div>
    </PageLayout>
  )
}
