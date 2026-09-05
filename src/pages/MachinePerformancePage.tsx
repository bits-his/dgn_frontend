import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, PageHeader, StatPill } from '@/components/ui'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

type NamedStat = { name: string; count: number; minutes: number }

type MachineInsight = {
  machineId: number | string
  machineName: string
  machineCode: string | null
  status: string | null
  ratedOutputPerHour: number | null
  productionRuns: number
  processRuns: number
  runs: number
  produced: number
  good: number
  reject: number
  runtimeMinutes: number
  downtimeMinutes: number
  downtimeEvents: number
  downtimeSharePercent: number
  availabilityPercent: number | null
  performancePercent: number | null
  qualityPercent: number | null
  oeePercent: number | null
  products: Array<{
    productId: number
    name: string
    produced: number
    good: number
    reject: number
    downtimeMinutes: number
    runs: number
  }>
  operators: NamedStat[]
  reasons: NamedStat[]
  stages: NamedStat[]
}

type InsightsPayload = {
  summary: {
    machinesTracked: number
    totalDowntimeMinutes: number
    downtimeEvents: number
    avgOeePercent: number | null
    topDowntimeMachine: { name: string; minutes: number } | null
    topDowntimeOperator: { name: string; minutes: number } | null
    topProduct: { name: string; produced: number } | null
  }
  machines: MachineInsight[]
  operators: Array<{
    operatorName: string
    downtimeMinutes: number
    downtimeEvents: number
    runs: number
    machines: string[]
    products: string[]
  }>
  products: Array<{
    productId: number
    name: string
    produced: number
    good: number
    reject: number
    runs: number
    downtimeMinutes: number
    machines: string[]
    rejectPercent: number
  }>
  reasons: NamedStat[]
  recentDowntime: Array<{
    source: string
    at: string
    machineName: string
    operatorName: string
    minutes: number
    reason: string
    productOrStage: string
    batchNumber: string | null
  }>
}

type FloorTab = 'operators' | 'products' | 'stops'

function oeeTone(oee: number | null): 'success' | 'accent' | 'danger' | 'default' {
  if (oee == null) return 'default'
  if (oee >= 75) return 'success'
  if (oee >= 55) return 'accent'
  return 'danger'
}

function statusLabel(oee: number | null) {
  if (oee == null) return { text: 'No data', className: 'text-[var(--ink-faint)]' }
  if (oee >= 75) return { text: 'Healthy', className: 'text-teal-700' }
  if (oee >= 55) return { text: 'Watch', className: 'text-amber-700' }
  return { text: 'Critical', className: 'text-red-700' }
}

function formatMinutes(min: number) {
  if (!min) return '0 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function SegmentTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ id: T; label: string }>
}) {
  return (
    <div className="inline-flex rounded-xl bg-zinc-100 p-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            value === opt.id
              ? 'bg-white text-[var(--ink)] shadow-sm'
              : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function EmptyLine({ children }: { children: string }) {
  return <p className="py-6 text-sm text-[var(--ink-muted)]">{children}</p>
}

export function MachinePerformancePage() {
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [floorTab, setFloorTab] = useState<FloorTab>('operators')
  const [detailTab, setDetailTab] = useState<'overview' | 'people' | 'stops'>('overview')

  const insightsQ = useQuery({
    queryKey: ['machine-insights'],
    queryFn: async () => {
      const { data } = await api.get('/production/machine-insights')
      return data.data as InsightsPayload
    },
  })

  const data = insightsQ.data
  const machines = data?.machines ?? []
  const summary = data?.summary

  const selected = useMemo(() => {
    if (!machines.length) return null
    const id = selectedId ?? machines[0]?.machineId
    return machines.find((m) => String(m.machineId) === String(id)) || machines[0]
  }, [machines, selectedId])

  const operators = (data?.operators || []).filter((o) => o.runs > 0).slice(0, 10)
  const products = (data?.products || []).slice(0, 10)
  const recent = (data?.recentDowntime || []).slice(0, 12)
  const reasons = (data?.reasons || []).slice(0, 6)

  return (
    <div>
      <PageHeader
        eyebrow="Machine intelligence"
        title="Machines & insights"
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatPill
          label="Avg OEE"
          value={summary?.avgOeePercent != null ? `${summary.avgOeePercent}%` : '—'}
          tone={oeeTone(summary?.avgOeePercent ?? null)}
        />
        <StatPill
          label="Total downtime"
          value={formatMinutes(summary?.totalDowntimeMinutes ?? 0)}
          tone="danger"
          hint={`${summary?.downtimeEvents ?? 0} stops`}
        />
        <StatPill
          label="Most downtime"
          value={summary?.topDowntimeMachine?.name || '—'}
          hint={
            summary?.topDowntimeMachine
              ? formatMinutes(summary.topDowntimeMachine.minutes)
              : undefined
          }
        />
        <StatPill
          label="Operator most stopped"
          value={summary?.topDowntimeOperator?.name || '—'}
          tone="accent"
          hint={
            summary?.topDowntimeOperator
              ? formatMinutes(summary.topDowntimeOperator.minutes)
              : undefined
          }
        />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold tracking-tight">Machines</h2>
          </div>

          {insightsQ.isLoading ? (
            <p className="px-5 py-8 text-sm text-[var(--ink-muted)] sm:px-6">Loading…</p>
          ) : !machines.length ? (
            <p className="px-5 py-8 text-sm text-[var(--ink-muted)] sm:px-6">
              No machine activity yet. Record production or crushing/washing first.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {machines.map((m) => {
                const active = selected && String(selected.machineId) === String(m.machineId)
                const status = statusLabel(m.oeePercent)
                return (
                  <li key={String(m.machineId)}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(m.machineId)
                        setDetailTab('overview')
                      }}
                      className={cn(
                        'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors sm:px-6',
                        active ? 'bg-[var(--accent-soft)]/50' : 'hover:bg-zinc-50',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold tracking-tight">{m.machineName}</p>
                        <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
                          {m.downtimeEvents > 0
                            ? `${formatMinutes(m.downtimeMinutes)} downtime · ${m.downtimeEvents} stop${m.downtimeEvents === 1 ? '' : 's'}`
                            : 'No downtime'}
                          {m.produced > 0 ? ` · ${m.produced.toLocaleString()} produced` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-semibold tabular-nums tracking-tight text-[var(--accent-strong)]">
                          {m.oeePercent != null ? `${m.oeePercent}%` : '—'}
                        </p>
                        <p className={cn('text-xs font-medium', status.className)}>{status.text}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          {selected ? (
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{selected.machineName}</h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                {[
                  selected.machineCode,
                  selected.status,
                  selected.ratedOutputPerHour != null
                    ? `Rated ${selected.ratedOutputPerHour}/h`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Machine detail'}
              </p>

              <div className="mt-4">
                <SegmentTabs
                  value={detailTab}
                  onChange={setDetailTab}
                  options={[
                    { id: 'overview', label: 'Overview' },
                    { id: 'people', label: 'People' },
                    { id: 'stops', label: 'Stops' },
                  ]}
                />
              </div>

              {detailTab === 'overview' && (
                <div className="mt-5 space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-[var(--ink-faint)]">Downtime</p>
                      <p className="mt-0.5 text-lg font-semibold">
                        {formatMinutes(selected.downtimeMinutes)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-faint)]">OEE</p>
                      <p className="mt-0.5 text-lg font-semibold">
                        {selected.oeePercent != null ? `${selected.oeePercent}%` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-faint)]">Availability</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {selected.availabilityPercent != null
                          ? `${selected.availabilityPercent}%`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--ink-faint)]">Quality</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {selected.qualityPercent != null ? `${selected.qualityPercent}%` : '—'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                      Products
                    </p>
                    {selected.products.length ? (
                      <ul className="mt-2 space-y-2">
                        {selected.products.slice(0, 5).map((p) => (
                          <li
                            key={p.productId}
                            className="flex items-baseline justify-between gap-3 text-sm"
                          >
                            <span className="truncate">{p.name}</span>
                            <span className="shrink-0 tabular-nums text-[var(--ink-muted)]">
                              {p.good.toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--ink-muted)]">
                        {selected.stages.length
                          ? `Used in ${selected.stages.map((s) => s.name).join(', ')}`
                          : 'No finished goods yet'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'people' && (
                <div className="mt-5">
                  {selected.operators.length ? (
                    <ul className="space-y-3">
                      {selected.operators.slice(0, 8).map((op) => (
                        <li
                          key={op.name}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{op.name}</p>
                            <p className="text-xs text-[var(--ink-faint)]">
                              {op.count} run{op.count === 1 ? '' : 's'}
                            </p>
                          </div>
                          <p
                            className={cn(
                              'shrink-0 tabular-nums',
                              op.minutes > 0
                                ? 'font-semibold text-red-700'
                                : 'text-[var(--ink-muted)]',
                            )}
                          >
                            {formatMinutes(op.minutes)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyLine>No operators on this machine yet.</EmptyLine>
                  )}
                </div>
              )}

              {detailTab === 'stops' && (
                <div className="mt-5">
                  {selected.reasons.length ? (
                    <ul className="space-y-3">
                      {selected.reasons.map((r) => (
                        <li
                          key={r.name}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{r.name}</p>
                            <p className="text-xs text-[var(--ink-faint)]">
                              {r.count} time{r.count === 1 ? '' : 's'}
                            </p>
                          </div>
                          <p className="shrink-0 font-semibold tabular-nums text-red-700">
                            {formatMinutes(r.minutes)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyLine>No stop reasons logged for this machine.</EmptyLine>
                  )}
                </div>
              )}
            </div>
          ) : (
            <EmptyLine>Select a machine to see details.</EmptyLine>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Floor view</h2>
          <SegmentTabs
            value={floorTab}
            onChange={setFloorTab}
            options={[
              { id: 'operators', label: 'Operators' },
              { id: 'products', label: 'Products' },
              { id: 'stops', label: 'Downtime log' },
            ]}
          />
        </div>

        {floorTab === 'operators' && (
          <div className="mt-5">
            {operators.length ? (
              <ul className="divide-y divide-[var(--line)]">
                {operators.map((op, i) => (
                  <li
                    key={op.operatorName}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {i === 0 && op.downtimeMinutes > 0 ? (
                          <span className="mr-2 text-[10px] font-semibold uppercase tracking-wider text-red-600">
                            Most DT
                          </span>
                        ) : null}
                        {op.operatorName}
                      </p>
                      <p className="truncate text-sm text-[var(--ink-muted)]">
                        {op.machines.slice(0, 2).join(', ') || 'No machine'}
                        {op.downtimeEvents > 0 ? ` · ${op.downtimeEvents} stops` : ''}
                      </p>
                    </div>
                    <p
                      className={cn(
                        'shrink-0 tabular-nums',
                        op.downtimeMinutes > 0
                          ? 'font-semibold text-red-700'
                          : 'text-[var(--ink-muted)]',
                      )}
                    >
                      {formatMinutes(op.downtimeMinutes)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>No operator activity yet.</EmptyLine>
            )}
          </div>
        )}

        {floorTab === 'products' && (
          <div className="mt-5">
            {products.length ? (
              <ul className="divide-y divide-[var(--line)]">
                {products.map((p) => (
                  <li
                    key={p.productId}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{p.name}</p>
                      <p className="truncate text-sm text-[var(--ink-muted)]">
                        {p.machines.slice(0, 2).join(', ') || '—'}
                        {p.rejectPercent > 0 ? ` · ${p.rejectPercent}% reject` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">
                      {p.good.toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>No finished goods produced yet.</EmptyLine>
            )}
          </div>
        )}

        {floorTab === 'stops' && (
          <div className="mt-5 space-y-6">
            {reasons.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                  Common reasons
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {reasons.map((r) => (
                    <li
                      key={r.name}
                      className="rounded-lg bg-zinc-50 px-3 py-1.5 text-sm text-[var(--ink)]"
                    >
                      {r.name}
                      <span className="ml-2 text-[var(--ink-muted)]">
                        {formatMinutes(r.minutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {recent.length ? (
              <ul className="divide-y divide-[var(--line)]">
                {recent.map((row, idx) => (
                  <li
                    key={`${row.at}-${idx}`}
                    className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {row.machineName}
                        <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
                        {row.operatorName}
                      </p>
                      <p className="truncate text-sm text-[var(--ink-muted)]">
                        {row.reason}
                        {row.batchNumber ? (
                          <>
                            {' · '}
                            <Link
                              to={`/batches/${row.batchNumber}`}
                              className="text-[var(--accent-strong)] hover:underline"
                            >
                              {row.productOrStage}
                            </Link>
                          </>
                        ) : (
                          ` · ${row.productOrStage}`
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-sm sm:text-right">
                      <p className="font-semibold tabular-nums text-red-700">
                        {formatMinutes(row.minutes)}
                      </p>
                      <p className="text-xs text-[var(--ink-faint)]">{formatDateTime(row.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>No downtime events yet.</EmptyLine>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
