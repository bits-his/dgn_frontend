import { Link, useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Cpu, Eye, Lock, Play } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fmtDozenPcs } from '@/lib/units'

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

type MachineRow = {
  machineId: number
  machineName: string
  machineCode: string | null
  machineType: string | null
  qtyGood: number
  qtyDamage: number
  dozen: number
  pcs: number
  runs: number
  activeRuns: number
  activeProductName?: string | null
  activeMaterialKg?: number
  activeQtyGood?: number
  topProducts: Array<{ name: string; qty: number }>
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

export function ProductionPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rangePreset = searchParams.get('rangePreset') || 'this_month'
  const [activeOpen, setActiveOpen] = useState(false)

  const setRangePreset = (preset: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('rangePreset', preset)
    setSearchParams(next, { replace: true })
  }

  const overview = useQuery({
    queryKey: ['production-machines-overview', rangePreset],
    queryFn: async () => {
      const { data } = await api.get('/production/machines-overview', {
        params: { rangePreset },
      })
      return data as {
        data: MachineRow[]
        range: { label: string; from: string; to: string }
      }
    },
    refetchInterval: 20_000,
  })

  const rows = overview.data?.data || []
  const rangeLabel =
    overview.data?.range?.label || RANGE_OPTIONS.find((o) => o.id === rangePreset)?.label

  const active = useMemo(() => rows.filter((r) => r.activeRuns > 0), [rows])

  return (
    <PageLayout
      title="Production"
      description="Machines and what they produced for the selected period."
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className={`h-8 px-2.5 text-xs gap-1.5 ${
              active.length > 0
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
            onClick={() => setActiveOpen(true)}
          >
            <Play className="size-3.5" />
            Active
            {active.length > 0 ? (
              <span className="rounded-full bg-white/25 px-1.5 py-0 text-[10px] font-bold tabular-nums">
                {active.length}
              </span>
            ) : null}
          </Button>
          <Select value={rangePreset} onValueChange={setRangePreset}>
            <SelectTrigger className="h-8 w-[140px] sm:w-[160px] text-xs bg-white">
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
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">
          Showing production for <span className="font-semibold text-zinc-800">{rangeLabel}</span>
        </p>

        {overview.isLoading ? (
          <p className="text-xs text-zinc-500 py-10 text-center">Loading machines…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-zinc-500 py-10 text-center">No active machines found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <article
                key={row.machineId}
                className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                      <Cpu className="size-4" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 truncate">{row.machineName}</h3>
                  </div>
                  {row.activeRuns > 0 ? (
                    <span className="shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                      {row.activeRuns} active
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Produced
                    </p>
                    <p className="text-sm font-bold tabular-nums text-emerald-900">
                      {fmtDozenPcs(row.qtyGood)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-red-50/50 border border-red-100 px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                      Damage
                    </p>
                    <p className="text-sm font-bold tabular-nums text-red-800">
                      {fmt(row.qtyDamage)} pcs
                    </p>
                  </div>
                </div>

                {row.topProducts.length > 0 ? (
                  <div className="space-y-1">
                    {row.topProducts.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="truncate text-zinc-500">{p.name}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-zinc-800">
                          {fmtDozenPcs(p.qty)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400">No production in this period</p>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-zinc-100 gap-2">
                  <span className="text-[10px] text-zinc-400">
                    {row.runs} run{row.runs === 1 ? '' : 's'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs gap-1.5">
                      <Link to={`/production/machines/${row.machineId}?rangePreset=${rangePreset}`}>
                        <Eye className="size-3.5" />
                        View
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="h-8 px-2.5 text-xs gap-1.5">
                      <Link to={`/production/machines/${row.machineId}/work`}>
                        <Lock className="size-3.5" />
                        Work &amp; Log
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Dialog open={activeOpen} onOpenChange={setActiveOpen}>
        <DialogContent className="max-h-[92vh] w-[min(90vw,28rem)] max-w-[min(90vw,28rem)] overflow-y-auto p-4 sm:p-5 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:pt-[max(1.25rem,env(safe-area-inset-top))] max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <DialogHeader className="mb-0 pb-3 border-b border-zinc-100">
            <DialogTitle className="text-base font-bold tracking-tight">
              Active machines
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {active.length > 0
                ? `${active.length} with open runs — tap to record`
                : 'No open runs right now'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-1">
            {active.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-10">
                Issue material from Material Store to start a run.
              </p>
            ) : (
              active.map((row) => (
                <Link
                  key={row.machineId}
                  to={`/production/machines/${row.machineId}/work`}
                  onClick={() => setActiveOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 hover:bg-amber-50 transition-colors"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                    <Cpu className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-900 truncate">{row.machineName}</p>
                    <p className="text-[11px] text-zinc-600 truncate">
                      {row.activeProductName || 'Open run'}
                      {' · '}
                      {fmt(row.activeMaterialKg || 0)} kg
                      {' · '}
                      {fmtDozenPcs(row.activeQtyGood || 0)} so far
                    </p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1.5">
                    <Play className="size-3 fill-current" />
                    Record
                  </span>
                </Link>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
