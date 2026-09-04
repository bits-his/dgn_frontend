import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, PageHeader, StatPill } from '@/components/ui'

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

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Recent production runs</h2>
        <div className="mt-4 space-y-2">
          {runs.data?.slice(0, 15).map((run) => (
            <div
              key={run.id}
              className="flex flex-col gap-2 border-b border-zinc-100 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
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
                <p className="text-sm text-[var(--ink-muted)]">
                  {run.machine?.name || '—'} · {run.product?.name || '—'}
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <span>
                  Good <strong>{run.qtyGood}</strong>
                </span>
                <span>
                  Reject <strong>{run.rejectPercent}%</strong>
                </span>
                <span>
                  OEE <strong>{run.oeePercent}%</strong>
                </span>
              </div>
            </div>
          ))}
          {!runs.isLoading && !runs.data?.length && (
            <p className="text-[var(--ink-muted)]">No runs yet.</p>
          )}
        </div>
      </Card>
    </div>
  )
}
