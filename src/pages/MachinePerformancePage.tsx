import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  Cpu,
  Layers,
  Search,
  Users,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Wrench,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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

function oeeBadgeColor(oee: number | null) {
  if (oee == null) return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
  if (oee >= 75) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
  if (oee >= 55) return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
  return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
}

function oeeBarColor(oee: number | null) {
  if (oee == null) return 'bg-zinc-300'
  if (oee >= 75) return 'bg-emerald-500'
  if (oee >= 55) return 'bg-amber-500'
  return 'bg-rose-500'
}

function formatMinutes(min: number) {
  if (!min) return '0 min'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function MachinePerformancePage() {
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [machineSearch, setMachineSearch] = useState('')
  const [oeeFilter, setOeeFilter] = useState<'ALL' | 'HEALTHY' | 'WATCH' | 'CRITICAL'>('ALL')
  const [floorTab, setFloorTab] = useState<FloorTab>('operators')
  const [detailTab, setDetailTab] = useState<'overview' | 'people' | 'stops'>('overview')

  const insightsQ = useQuery({
    queryKey: ['machine-insights'],
    queryFn: async () => {
      const { data } = await api.get('/production/machine-insights')
      return data.data as InsightsPayload
    },
    refetchInterval: 30_000,
  })

  const data = insightsQ.data
  const rawMachines = data?.machines ?? []
  const summary = data?.summary

  // Filter machines based on search & health filter
  const machines = useMemo(() => {
    return rawMachines.filter((m) => {
      if (machineSearch.trim()) {
        const q = machineSearch.toLowerCase()
        const matchName = m.machineName.toLowerCase().includes(q)
        const matchCode = (m.machineCode || '').toLowerCase().includes(q)
        if (!matchName && !matchCode) return false
      }
      if (oeeFilter === 'HEALTHY') return (m.oeePercent || 0) >= 75
      if (oeeFilter === 'WATCH') return (m.oeePercent || 0) >= 55 && (m.oeePercent || 0) < 75
      if (oeeFilter === 'CRITICAL') return (m.oeePercent || 0) < 55
      return true
    })
  }, [rawMachines, machineSearch, oeeFilter])

  const selected = useMemo(() => {
    if (!rawMachines.length) return null
    if (selectedId != null) {
      const found = rawMachines.find((m) => String(m.machineId) === String(selectedId))
      if (found) return found
    }
    return machines[0] || rawMachines[0]
  }, [rawMachines, machines, selectedId])

  const operators = (data?.operators || []).filter((o) => o.runs > 0).slice(0, 12)
  const products = (data?.products || []).slice(0, 12)
  const recent = (data?.recentDowntime || []).slice(0, 15)
  const reasons = (data?.reasons || []).slice(0, 8)

  return (
    <PageLayout
      title={
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <span className="truncate">Machine Performance & Insights</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 shrink-0">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500 shrink-0" />
            <span>Live telemetry</span>
          </span>
        </div>
      }
      description="Overall Equipment Effectiveness (OEE), availability, downtime root causes, and operator efficiency."
      actions={
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs font-semibold gap-1.5 inline-flex items-center justify-center"
          onClick={() => insightsQ.refetch()}
          disabled={insightsQ.isFetching}
        >
          <RefreshCw className={cn('size-3.5 shrink-0', insightsQ.isFetching && 'animate-spin')} />
          <span>Refresh</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* KPI Grid: Compact 2 per row on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Avg OEE Card */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Fleet Avg OEE
                </span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[9px] font-extrabold border shrink-0',
                    oeeBadgeColor(summary?.avgOeePercent ?? null)
                  )}
                >
                  {summary?.avgOeePercent != null
                    ? summary.avgOeePercent >= 75
                      ? 'Healthy'
                      : summary.avgOeePercent >= 55
                      ? 'Watch'
                      : 'Critical'
                    : 'No Data'}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate">
                  {summary?.avgOeePercent != null ? `${summary.avgOeePercent}%` : '—'}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium truncate">
                  ({summary?.machinesTracked || rawMachines.length} units)
                </span>
              </div>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={cn('h-full rounded-full transition-all', oeeBarColor(summary?.avgOeePercent ?? null))}
                style={{ width: `${Math.min(summary?.avgOeePercent || 0, 100)}%` }}
              />
            </div>
          </div>

          {/* Fleet Total Downtime */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Stoppage Time
                </span>
                <div className="size-5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Clock className="size-3" />
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums tracking-tight truncate">
                  {formatMinutes(summary?.totalDowntimeMinutes ?? 0)}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium truncate">
                  ({summary?.downtimeEvents ?? 0} stops)
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Total runtime lost
            </p>
          </div>

          {/* Top Downtime Machine */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Bottleneck Line
                </span>
                <div className="size-5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Wrench className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {summary?.topDowntimeMachine?.name || 'None'}
                </p>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 truncate">
              {summary?.topDowntimeMachine
                ? `${formatMinutes(summary.topDowntimeMachine.minutes)} logged`
                : 'Zero stoppage'}
            </p>
          </div>

          {/* Operator Most Stopped */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Stop Frequency Lead
                </span>
                <div className="size-5 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 flex items-center justify-center shrink-0">
                  <Users className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {summary?.topDowntimeOperator?.name || 'None'}
                </p>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-400 truncate">
              {summary?.topDowntimeOperator
                ? `${formatMinutes(summary.topDowntimeOperator.minutes)} stoppage`
                : 'Normal flow'}
            </p>
          </div>
        </div>

        {/* 2-Column Machine Telemetry Panel */}
        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] items-start">
          {/* Left Column: Fleet List */}
          <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="size-4 text-zinc-600 dark:text-zinc-400" />
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Machines & Fleet</h2>
                </div>
                <span className="text-xs font-semibold text-zinc-500">
                  {machines.length} machine{machines.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Search & Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                  <Input
                    placeholder="Search machine name or code…"
                    className="h-8 pl-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    value={machineSearch}
                    onChange={(e) => setMachineSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1">
                  {(['ALL', 'HEALTHY', 'WATCH', 'CRITICAL'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setOeeFilter(filter)}
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
                        oeeFilter === filter
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* List */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-[560px] overflow-y-auto">
              {insightsQ.isLoading ? (
                <p className="p-6 text-center text-xs text-zinc-500">Loading fleet telemetry…</p>
              ) : !machines.length ? (
                <div className="p-8 text-center text-xs text-zinc-500 space-y-1">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">No matching machines</p>
                  <p>Try adjusting your search or health filter.</p>
                </div>
              ) : (
                machines.map((m) => {
                  const isSelected = selected && String(selected.machineId) === String(m.machineId)
                  return (
                    <button
                      key={String(m.machineId)}
                      type="button"
                      onClick={() => {
                        setSelectedId(m.machineId)
                        setDetailTab('overview')
                      }}
                      className={cn(
                        'w-full text-left p-3.5 transition-all flex items-center justify-between gap-3 group',
                        isSelected
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-l-4 border-l-emerald-600'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                            {m.machineName}
                          </p>
                          {m.machineCode && (
                            <span className="font-mono text-[10px] text-zinc-400 font-semibold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                              {m.machineCode}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                          <span>{m.runs} runs</span>
                          <span>·</span>
                          <span>{m.produced > 0 ? `${m.produced.toLocaleString()} pcs` : 'No output'}</span>
                          {m.downtimeMinutes > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-rose-600 font-medium">
                                {formatMinutes(m.downtimeMinutes)} DT
                              </span>
                            </>
                          )}
                        </div>

                        {/* Mini progress bar */}
                        <div className="w-36 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', oeeBarColor(m.oeePercent))}
                            style={{ width: `${Math.min(m.oeePercent || 0, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={cn(
                            'inline-block px-2 py-0.5 rounded-md text-xs font-black tabular-nums border',
                            oeeBadgeColor(m.oeePercent)
                          )}
                        >
                          {m.oeePercent != null ? `${m.oeePercent}%` : '—'}
                        </span>
                        <ChevronRight className="size-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform mt-1 ml-auto" />
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Selected Machine View */}
          {selected ? (
            <div className="space-y-4">
              {/* Header card for selected machine */}
              <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                        {selected.machineName}
                      </h2>
                      {selected.machineCode && (
                        <span className="font-mono text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                          {selected.machineCode}
                        </span>
                      )}
                      <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                        {selected.status || 'ACTIVE'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {selected.ratedOutputPerHour
                        ? `Rated output capacity: ${selected.ratedOutputPerHour} units/hour`
                        : 'Standard floor machine specification'}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                      Overall OEE
                    </span>
                    <span
                      className={cn(
                        'text-2xl font-black tabular-nums inline-block px-2.5 py-0.5 rounded-xl border mt-0.5',
                        oeeBadgeColor(selected.oeePercent)
                      )}
                    >
                      {selected.oeePercent != null ? `${selected.oeePercent}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* 3 OEE Pillars: Availability × Performance × Quality */}
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {/* Availability */}
                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        1. Availability
                      </span>
                      <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">
                        {selected.availabilityPercent != null ? `${selected.availabilityPercent}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.min(selected.availabilityPercent || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400">
                      Operating time vs scheduled runtime ({formatMinutes(selected.runtimeMinutes)})
                    </p>
                  </div>

                  {/* Performance */}
                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        2. Performance
                      </span>
                      <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">
                        {selected.performancePercent != null ? `${selected.performancePercent}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${Math.min(selected.performancePercent || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400">
                      Actual run speed vs rated nameplate speed
                    </p>
                  </div>

                  {/* Quality */}
                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        3. Quality Yield
                      </span>
                      <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">
                        {selected.qualityPercent != null ? `${selected.qualityPercent}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(selected.qualityPercent || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400">
                      Good pieces vs total output ({selected.good.toLocaleString()} / {selected.produced.toLocaleString()})
                    </p>
                  </div>
                </div>

                {/* Sub-tabs for detailed drill-down */}
                <div className="mt-5 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 'overview', label: 'Products & Output', icon: Layers },
                      { id: 'people', label: 'Assigned Operators', icon: Users },
                      { id: 'stops', label: 'Root Causes & Stops', icon: Clock },
                    ].map((tab) => {
                      const Icon = tab.icon
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDetailTab(tab.id as 'overview' | 'people' | 'stops')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                            detailTab === tab.id
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          )}
                        >
                          <Icon className="size-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Tab 1: Products Produced */}
                  {detailTab === 'overview' && (
                    <div className="mt-4 space-y-3">
                      {selected.products.length ? (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
                          {selected.products.map((p) => (
                            <div
                              key={p.productId}
                              className="p-3 bg-white dark:bg-zinc-950 flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-bold text-zinc-900 dark:text-zinc-100">{p.name}</p>
                                <p className="text-[11px] text-zinc-400">
                                  {p.runs} production run{p.runs === 1 ? '' : 's'}
                                  {p.downtimeMinutes > 0 && ` · ${formatMinutes(p.downtimeMinutes)} DT`}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                                  {p.good.toLocaleString()} pcs
                                </span>
                                {p.reject > 0 && (
                                  <span className="text-[11px] text-red-600 font-semibold ml-1.5">
                                    ({p.reject.toLocaleString()} reject)
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="p-6 text-center text-xs text-zinc-400">
                          {selected.stages.length
                            ? `Used in recycling stages: ${selected.stages.map((s) => s.name).join(', ')}`
                            : 'No product output recorded for this machine yet.'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Operators on machine */}
                  {detailTab === 'people' && (
                    <div className="mt-4 space-y-2">
                      {selected.operators.length ? (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
                          {selected.operators.map((op) => (
                            <div
                              key={op.name}
                              className="p-3 bg-white dark:bg-zinc-950 flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-bold text-zinc-900 dark:text-zinc-100">{op.name}</p>
                                <p className="text-[11px] text-zinc-400">
                                  {op.count} shift run{op.count === 1 ? '' : 's'} executed
                                </p>
                              </div>
                              <span
                                className={cn(
                                  'font-bold tabular-nums',
                                  op.minutes > 0 ? 'text-rose-600' : 'text-zinc-500'
                                )}
                              >
                                {op.minutes > 0 ? `${formatMinutes(op.minutes)} downtime` : '0 downtime'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="p-6 text-center text-xs text-zinc-400">
                          No operators logged for this machine yet.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Stoppage Root Causes */}
                  {detailTab === 'stops' && (
                    <div className="mt-4 space-y-2">
                      {selected.reasons.length ? (
                        <div className="space-y-2">
                          {selected.reasons.map((r) => {
                            const totalDt = selected.downtimeMinutes || 1
                            const share = Math.round((r.minutes / totalDt) * 100)
                            return (
                              <div
                                key={r.name}
                                className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 space-y-1.5"
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                    {r.name}
                                  </span>
                                  <div className="text-right">
                                    <span className="font-black text-rose-600 tabular-nums">
                                      {formatMinutes(r.minutes)}
                                    </span>
                                    <span className="text-zinc-400 text-[11px] ml-1.5 font-medium">
                                      ({r.count}x · {share}%)
                                    </span>
                                  </div>
                                </div>
                                <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-rose-500"
                                    style={{ width: `${Math.min(share, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="p-6 text-center text-xs text-zinc-400">
                          No stoppage causes recorded for this machine.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Floor-Wide Intelligence Section */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Plant-Wide Floor Intelligence
              </h3>
              <p className="text-xs text-zinc-500">
                Cross-machine aggregation across operators, product lines, and live stoppage events.
              </p>
            </div>

            <div className="flex items-center rounded-lg bg-zinc-100 dark:bg-zinc-900 p-0.5 text-xs font-semibold">
              {[
                { id: 'operators', label: 'Operator Rankings' },
                { id: 'products', label: 'Product Yields' },
                { id: 'stops', label: 'Downtime Log' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFloorTab(tab.id as FloorTab)}
                  className={cn(
                    'px-3 py-1 rounded-md transition-all',
                    floorTab === tab.id
                      ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-950 dark:text-white font-bold'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-view 1: Operators */}
          {floorTab === 'operators' && (
            <div className="overflow-x-auto">
              {operators.length ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-2.5 pr-4">Operator</th>
                      <th className="py-2.5 pr-4">Total Runs</th>
                      <th className="py-2.5 pr-4">Machines Operated</th>
                      <th className="py-2.5 pr-4">Stop Events</th>
                      <th className="py-2.5 text-right">Lost Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {operators.map((op, i) => (
                      <tr key={op.operatorName} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                        <td className="py-3 pr-4 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {i === 0 && op.downtimeMinutes > 0 && (
                            <span className="rounded bg-rose-100 text-rose-800 text-[10px] font-extrabold px-1.5 py-0.2">
                              Highest DT
                            </span>
                          )}
                          <span>{op.operatorName}</span>
                        </td>
                        <td className="py-3 pr-4 font-medium tabular-nums">{op.runs}</td>
                        <td className="py-3 pr-4 text-zinc-500">
                          {op.machines.slice(0, 3).join(', ') || '—'}
                        </td>
                        <td className="py-3 pr-4 font-medium tabular-nums">
                          {op.downtimeEvents} stops
                        </td>
                        <td className="py-3 text-right font-black tabular-nums text-rose-600">
                          {formatMinutes(op.downtimeMinutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-8 text-center text-xs text-zinc-400">No operator shift activity logged yet.</p>
              )}
            </div>
          )}

          {/* Sub-view 2: Products */}
          {floorTab === 'products' && (
            <div className="overflow-x-auto">
              {products.length ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-2.5 pr-4">Product Name</th>
                      <th className="py-2.5 pr-4">Good Output</th>
                      <th className="py-2.5 pr-4">Waste / Reject</th>
                      <th className="py-2.5 pr-4">Defect Rate</th>
                      <th className="py-2.5 text-right">Downtime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {products.map((p) => (
                      <tr key={p.productId} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                        <td className="py-3 pr-4 font-bold text-zinc-900 dark:text-zinc-100">
                          {p.name}
                        </td>
                        <td className="py-3 pr-4 font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                          {p.good.toLocaleString()} pcs
                        </td>
                        <td className="py-3 pr-4 text-zinc-500 tabular-nums">
                          {p.reject > 0 ? `${p.reject.toLocaleString()} pcs` : '0'}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[11px] font-bold tabular-nums',
                              p.rejectPercent > 5
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-zinc-100 text-zinc-700'
                            )}
                          >
                            {p.rejectPercent}%
                          </span>
                        </td>
                        <td className="py-3 text-right font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
                          {formatMinutes(p.downtimeMinutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-8 text-center text-xs text-zinc-400">No products produced yet.</p>
              )}
            </div>
          )}

          {/* Sub-view 3: Live Downtime Log */}
          {floorTab === 'stops' && (
            <div className="space-y-4">
              {reasons.length > 0 && (
                <div className="rounded-xl bg-zinc-50/70 dark:bg-zinc-900/50 p-3 border border-zinc-200/60 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                    Common Stoppage Reasons Across Fleet
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {reasons.map((r) => (
                      <div
                        key={r.name}
                        className="flex items-center gap-2 rounded-lg bg-white dark:bg-zinc-950 px-2.5 py-1 text-xs border border-zinc-200/80 dark:border-zinc-800 shadow-2xs"
                      >
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{r.name}</span>
                        <span className="font-bold text-rose-600 tabular-nums">
                          {formatMinutes(r.minutes)}
                        </span>
                        <span className="text-[10px] text-zinc-400">({r.count}x)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                {recent.length ? (
                  <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-2.5 pr-4">Machine & Batch</th>
                      <th className="py-2.5 pr-4">Operator</th>
                      <th className="py-2.5 pr-4">Stoppage Reason</th>
                      <th className="py-2.5 pr-4">Duration</th>
                      <th className="py-2.5 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {recent.map((row, idx) => (
                      <tr key={`${row.at}-${idx}`} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                        <td className="py-3 pr-4">
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">{row.machineName}</p>
                          {row.batchNumber ? (
                            <Link
                              to={`/batches/${row.batchNumber}`}
                              className="font-mono text-[11px] text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
                            >
                              <span>#{row.batchNumber}</span>
                              <ExternalLink className="size-2.5 text-zinc-400" />
                            </Link>
                          ) : (
                            <span className="text-[11px] text-zinc-400">{row.productOrStage}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-medium text-zinc-800 dark:text-zinc-200">
                          {row.operatorName}
                        </td>
                        <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-300 font-medium">
                          {row.reason}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-black text-rose-600 tabular-nums bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                            {formatMinutes(row.minutes)}
                          </span>
                        </td>
                        <td className="py-3 text-right text-zinc-400 text-[11px] tabular-nums">
                          {formatDateTime(row.at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-8 text-center text-xs text-zinc-400">No downtime events recorded.</p>
              )}
            </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
