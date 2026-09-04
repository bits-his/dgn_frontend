import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, PageHeader, StatPill } from '@/components/ui'
import { formatDateTime } from '@/lib/dates'

type MachinePerf = {
  machineId: number
  machineName: string
  runs: number
  produced: number
  good: number
  reject: number
  runtimeMinutes: number
  downtimeMinutes: number
  availabilityPercent: number
  performancePercent: number
  qualityPercent: number
  oeePercent: number
}

type ProductionRunRow = {
  id: number
  qtyProduced: number
  qtyGood: number
  qtyReject: number
  oeePercent: number
  rejectPercent: number
  outputPerHour: number
  batch?: { batchNumber: string }
  machine?: { name: string }
  product?: { name: string }
  createdAt: string
}

function oeeTone(oee: number): 'success' | 'accent' | 'danger' {
  if (oee >= 75) return 'success'
  if (oee >= 55) return 'accent'
  return 'danger'
}

function light(oee: number) {
  if (oee >= 75) return { dot: 'bg-teal-600', label: 'Normal' }
  if (oee >= 55) return { dot: 'bg-amber-500', label: 'Attention' }
  return { dot: 'bg-red-600', label: 'Critical' }
}

export function MachinePerformancePage() {
  const perf = useQuery({
    queryKey: ['machine-performance'],
    queryFn: async () => {
      const { data } = await api.get('/production/machine-performance')
      return data.data as MachinePerf[]
    },
  })

  const runs = useQuery({
    queryKey: ['production-runs'],
    queryFn: async () => {
      const { data } = await api.get('/production/runs')
      return data.data as ProductionRunRow[]
    },
  })

  const totalProduced = perf.data?.reduce((s, m) => s + m.produced, 0) ?? 0
  const totalGood = perf.data?.reduce((s, m) => s + m.good, 0) ?? 0
  const totalDowntime = perf.data?.reduce((s, m) => s + m.downtimeMinutes, 0) ?? 0
  const avgOee =
    perf.data?.length
      ? +(perf.data.reduce((s, m) => s + m.oeePercent, 0) / perf.data.length).toFixed(2)
      : 0

  return (
    <div>
      <PageHeader
        eyebrow="Machine intelligence"
        title="Machine performance & OEE"
        description="OEE = Availability × Performance × Quality, calculated from recorded production runs."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatPill label="Avg OEE" value={`${avgOee}%`} tone={oeeTone(avgOee)} />
        <StatPill label="Total produced" value={totalProduced.toLocaleString()} />
        <StatPill label="Good output" value={totalGood.toLocaleString()} tone="success" />
        <StatPill label="Downtime (min)" value={totalDowntime.toLocaleString()} tone="danger" />
      </div>

      <Card className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Machine comparison</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--ink-muted)]">
                <th className="py-3 pr-4 font-semibold">Machine</th>
                <th className="py-3 pr-4 font-semibold">Runs</th>
                <th className="py-3 pr-4 font-semibold">Availability</th>
                <th className="py-3 pr-4 font-semibold">Performance</th>
                <th className="py-3 pr-4 font-semibold">Quality</th>
                <th className="py-3 pr-4 font-semibold">OEE</th>
                <th className="py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {perf.isLoading && (
                <tr>
                  <td colSpan={7} className="py-6 text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {perf.data?.map((m) => {
                const l = light(m.oeePercent)
                return (
                  <tr key={m.machineId} className="border-b border-zinc-100">
                    <td className="py-3 pr-4 font-semibold">{m.machineName}</td>
                    <td className="py-3 pr-4">{m.runs}</td>
                    <td className="py-3 pr-4">{m.availabilityPercent}%</td>
                    <td className="py-3 pr-4">{m.performancePercent}%</td>
                    <td className="py-3 pr-4">{m.qualityPercent}%</td>
                    <td className="py-3 pr-4 font-semibold text-[var(--accent-strong)]">
                      {m.oeePercent}%
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={`size-2.5 rounded-full ${l.dot}`} />
                        {l.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {!perf.isLoading && !perf.data?.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-[var(--ink-muted)]">
                    No production runs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <h2 className="px-4 pt-4 text-lg font-semibold tracking-tight sm:px-6 sm:pt-6">
          Recent production runs
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Batch</th>
                <th className="px-3 py-3 font-semibold">Machine</th>
                <th className="px-3 py-3 font-semibold">Product</th>
                <th className="px-3 py-3 font-semibold text-right">Good</th>
                <th className="px-3 py-3 font-semibold text-right">Waste %</th>
                <th className="px-4 py-3 font-semibold text-right">OEE %</th>
              </tr>
            </thead>
            <tbody>
              {runs.isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {runs.data?.slice(0, 15).map((run) => (
                <tr key={run.id} className="border-b border-[var(--line)] hover:bg-zinc-50/80">
                  <td className="px-4 py-3 text-[var(--ink-muted)] tabular-nums">
                    {formatDateTime(run.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    {run.batch?.batchNumber ? (
                      <Link
                        to={`/batches/${run.batch.batchNumber}`}
                        className="font-semibold text-[var(--accent-strong)] hover:underline"
                      >
                        {run.batch.batchNumber}
                      </Link>
                    ) : (
                      <span className="font-semibold">Run #{run.id}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">{run.machine?.name || '—'}</td>
                  <td className="px-3 py-3">{run.product?.name || '—'}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">
                    {run.qtyGood.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{run.rejectPercent}%</td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--accent-strong)] tabular-nums">
                    {run.oeePercent}%
                  </td>
                </tr>
              ))}
              {!runs.isLoading && !runs.data?.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    No runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
