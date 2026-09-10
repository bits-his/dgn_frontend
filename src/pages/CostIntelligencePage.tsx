import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  Search,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Fuel,
  Wrench,
  Truck,
  Users,
  Building2,
  RefreshCw,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type CostOverview = {
  dryBatchCount: number
  totalAccumulatedCost: number
  totalUsableKg: number
  avgTrueRecycledCostPerKg: number | null
  costMixPercent: {
    purchase: number
    logistics: number
    labour: number
    processing: number
    utilities: number
    maintenance: number
    overhead: number
    other: number
  }
  accumulatedByClass: Record<string, number>
  currency: string
  costScope: string
  overheadIncluded: boolean
  overheadTotal: number
  overheadPerKg: number | null
  batchesWithOverhead: number
  batchesWithoutOverhead: number
  avgCostPerKgExcludingOverhead: number | null
}

type RecycledRow = {
  batchNumber: string
  batchType: string
  material: string | null
  qtyOut: number
  qtyRemaining: number
  uom: string
  accumulatedTotal: number
  trueRecycledCostPerKg: number | null
  directTotal: number
  inheritedTotal: number
}

const CLASS_CONFIG = [
  { key: 'purchase', label: 'Material Purchase', icon: Package, color: 'bg-amber-500', barColor: 'bg-amber-500' },
  { key: 'logistics', label: 'Transport & Logistics', icon: Truck, color: 'bg-slate-600', barColor: 'bg-slate-600' },
  { key: 'labour', label: 'Factory Labour', icon: Users, color: 'bg-teal-600', barColor: 'bg-teal-600' },
  { key: 'processing', label: 'Processing & Chemicals', icon: Layers, color: 'bg-violet-600', barColor: 'bg-violet-600' },
  { key: 'utilities', label: 'Energy & Diesel Utilities', icon: Fuel, color: 'bg-sky-600', barColor: 'bg-sky-600' },
  { key: 'maintenance', label: 'Plant Maintenance', icon: Wrench, color: 'bg-orange-600', barColor: 'bg-orange-600' },
  { key: 'overhead', label: 'Allocated Factory Overhead', icon: Building2, color: 'bg-rose-600', barColor: 'bg-rose-600' },
] as const

export function CostIntelligencePage() {
  const [search, setSearch] = useState('')
  const [materialFilter, setMaterialFilter] = useState('ALL')

  const overview = useQuery({
    queryKey: ['costs-overview'],
    queryFn: async () => {
      const { data } = await api.get('/costs/overview')
      return data.data as CostOverview
    },
    refetchInterval: 30_000,
  })

  const recycled = useQuery({
    queryKey: ['costs-recycled'],
    queryFn: async () => {
      const { data } = await api.get('/costs/recycled-material')
      return data.data as RecycledRow[]
    },
  })

  const ov = overview.data
  const rawRecycled = recycled.data || []

  // Filter recycled material rows
  const filteredRecycled = useMemo(() => {
    return rawRecycled.filter((r) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchBatch = r.batchNumber.toLowerCase().includes(q)
        const matchMat = (r.material || '').toLowerCase().includes(q)
        if (!matchBatch && !matchMat) return false
      }
      if (materialFilter !== 'ALL' && r.material !== materialFilter) return false
      return true
    })
  }, [rawRecycled, search, materialFilter])

  const materialOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rawRecycled) {
      if (r.material) set.add(r.material)
    }
    return Array.from(set)
  }, [rawRecycled])

  return (
    <PageLayout
      title={
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <span className="truncate">Cost Intelligence & Unit Economics</span>
          {ov && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border shrink-0',
                ov.overheadIncluded
                  ? 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                  : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
              )}
            >
              {ov.overheadIncluded ? (
                <>
                  <ShieldCheck className="size-3.5 text-teal-600 shrink-0" />
                  <span>Fully Loaded Cost</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="size-3.5 text-amber-600 shrink-0" />
                  <span>Direct Costs Only</span>
                </>
              )}
            </span>
          )}
        </div>
      }
      description="Lineage-accumulated true cost per kilogram, expense class decomposition, and factory overhead absorption."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 inline-flex items-center justify-center"
            onClick={() => {
              overview.refetch()
              recycled.refetch()
            }}
            disabled={overview.isFetching || recycled.isFetching}
          >
            <RefreshCw
              className={cn('size-3.5 shrink-0', (overview.isFetching || recycled.isFetching) && 'animate-spin')}
            />
            <span>Refresh</span>
          </Button>
          <Button size="sm" className="h-8 text-xs font-semibold gap-1.5 inline-flex items-center justify-center" asChild>
            <Link to="/costs/overhead" className="inline-flex items-center justify-center gap-1.5">
              <span>Manage Overhead</span>
              <ArrowRight className="size-3.5 shrink-0" />
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Overhead Status Announcement Banner */}
        {ov && (
          <div
            className={cn(
              'rounded-2xl border p-3.5 sm:p-4.5 shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4',
              ov.overheadIncluded
                ? 'border-teal-200 bg-gradient-to-r from-teal-50/80 via-emerald-50/40 to-white dark:from-teal-950/40 dark:via-zinc-900 dark:to-zinc-950 dark:border-teal-800'
                : 'border-amber-200 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white dark:from-amber-950/40 dark:via-zinc-900 dark:to-zinc-950 dark:border-amber-800'
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex size-9 sm:size-10 items-center justify-center rounded-xl shrink-0 shadow-xs',
                  ov.overheadIncluded
                    ? 'bg-teal-600 text-white'
                    : 'bg-amber-500 text-white'
                )}
              >
                {ov.overheadIncluded ? (
                  <Building2 className="size-4.5 sm:size-5 shrink-0" />
                ) : (
                  <ShieldAlert className="size-4.5 sm:size-5 shrink-0" />
                )}
              </div>
              <div className="space-y-1">
                <p
                  className={cn(
                    'text-sm font-bold',
                    ov.overheadIncluded
                      ? 'text-teal-950 dark:text-teal-200'
                      : 'text-amber-950 dark:text-amber-200'
                  )}
                >
                  {ov.overheadIncluded
                    ? 'Factory Overhead is Fully Absorbed'
                    : 'Factory Overhead is Excluded from Current Figures'}
                </p>
                <p
                  className={cn(
                    'text-xs leading-relaxed max-w-2xl',
                    ov.overheadIncluded
                      ? 'text-teal-800/80 dark:text-teal-300/80'
                      : 'text-amber-800/80 dark:text-amber-300/80'
                  )}
                >
                  {ov.overheadIncluded ? (
                    <>
                      Shared plant expenses (rent, diesel, utility power, and indirect factory wages) of{' '}
                      <strong>₦{ov.overheadPerKg?.toLocaleString()}/kg</strong> are absorbed on top of the direct
                      material cost (₦{ov.avgCostPerKgExcludingOverhead?.toLocaleString()}/kg).
                      {ov.batchesWithoutOverhead > 0 &&
                        ` Note: ${ov.batchesWithoutOverhead} newer batch${
                          ov.batchesWithoutOverhead === 1 ? '' : 'es'
                        } remain in an open month and carry direct costs until month close.`}
                    </>
                  ) : (
                    <>
                      Rent, generator diesel, and factory wages have not been allocated into these unit rates.
                      Close the monthly period on the Factory Overhead page to distribute shared costs across production output and reveal the real finished cost per kilogram.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="shrink-0 self-start sm:self-center">
              <Button
                size="sm"
                variant={ov.overheadIncluded ? 'outline' : 'default'}
                className={cn(
                  'h-8 text-xs font-semibold gap-1.5 inline-flex items-center justify-center',
                  !ov.overheadIncluded && 'bg-amber-600 hover:bg-amber-700 text-white'
                )}
                asChild
              >
                <Link to="/costs/overhead" className="inline-flex items-center justify-center gap-1.5">
                  <span>{ov.overheadIncluded ? 'View Allocation Pool' : 'Close Month & Allocate'}</span>
                  <ArrowRight className="size-3.5 shrink-0" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* 4 Hero KPI Cards: Compact 2 per row on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Average True Cost per Kg */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  True Cost / Kg
                </span>
                <div className="size-5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <DollarSign className="size-3" />
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums tracking-tight truncate">
                  {ov?.avgTrueRecycledCostPerKg != null
                    ? `₦${ov.avgTrueRecycledCostPerKg.toLocaleString()}`
                    : '—'}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium truncate">/ kg (DRY)</span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              {ov?.overheadIncluded ? 'Fully loaded absorption' : 'Direct costs only'}
            </p>
          </div>

          {/* Total Capital Invested */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Capital Invested
                </span>
                <div className="size-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                  {ov ? `₦${ov.totalAccumulatedCost.toLocaleString()}` : '—'}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Across active dried lots
            </p>
          </div>

          {/* Usable Output */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Usable Output
                </span>
                <div className="size-5 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 flex items-center justify-center shrink-0">
                  <Package className="size-3" />
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate">
                  {ov ? ov.totalUsableKg.toLocaleString() : '—'}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium truncate">kg produced</span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Clean flakes & regrind
            </p>
          </div>

          {/* Dry Batches */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Completed Lots
                </span>
                <div className="size-5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                  <Layers className="size-3" />
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate">
                  {ov ? ov.dryBatchCount : '—'}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium truncate">lots</span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              {ov?.batchesWithOverhead ?? 0} absorbed · {ov?.batchesWithoutOverhead ?? 0} direct
            </p>
          </div>
        </div>

        {/* Cost Mix Decomposition */}
        {ov && (
          <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>Cost Mix Decomposition</span>
                  <span className="text-xs text-zinc-400 font-normal">
                    · {ov.costScope.replace(/_/g, ' ').toLowerCase()} scope
                  </span>
                </h2>
                <p className="text-xs text-zinc-500">
                  Relative contribution of raw scrap purchase, transport, labour, energy, and shared overhead.
                </p>
              </div>

              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                100% Total Cost Basis
              </span>
            </div>

            {/* Stacked Visual Bar */}
            <div className="h-3 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex shadow-inner">
              {CLASS_CONFIG.map((c) => {
                const pct = ov.costMixPercent[c.key] || 0
                if (pct <= 0) return null
                return (
                  <div
                    key={c.key}
                    className={cn('h-full transition-all', c.barColor)}
                    style={{ width: `${pct}%` }}
                    title={`${c.label}: ${pct}%`}
                  />
                )
              })}
            </div>

            {/* Detailed Row Cards: 2 per row on mobile */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 pt-1">
              {CLASS_CONFIG.map((c) => {
                const pct = ov.costMixPercent[c.key] || 0
                const Icon = c.icon
                return (
                  <div
                    key={c.key}
                    className="rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-2.5 sm:p-3 space-y-1.5 sm:space-y-2"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <div className={cn('size-5 sm:size-6 rounded-md flex items-center justify-center text-white shrink-0', c.color)}>
                          <Icon className="size-3 sm:size-3.5" />
                        </div>
                        <span className="text-[11px] sm:text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                          {c.label}
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm font-black tabular-nums text-zinc-900 dark:text-white shrink-0">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', c.barColor)}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recycled Lots History & Ledger */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Recycled Material Lots & Lineage Ledger
              </h3>
              <p className="text-xs text-zinc-500">
                True cost per kg calculated through lineage propagation across Sorting, Crushing, Washing, and Drying.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-44 sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <Input
                  className="pl-8 h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  placeholder="Search batch # or material…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {materialOptions.length > 0 && (
                <div className="w-36 sm:w-44">
                  <Select
                    value={materialFilter}
                    onValueChange={(val) => setMaterialFilter(val)}
                  >
                    <SelectTrigger className="h-8 text-xs font-medium bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <SelectValue placeholder="All Materials" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Materials</SelectItem>
                      {materialOptions.map((mat) => (
                        <SelectItem key={mat} value={mat}>
                          {mat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-2.5 pr-4">Batch Number</th>
                  <th className="py-2.5 pr-4">Material</th>
                  <th className="py-2.5 pr-4 text-right">Output (Yield)</th>
                  <th className="py-2.5 pr-4 text-right">Direct Costs</th>
                  <th className="py-2.5 pr-4 text-right">Inherited Costs</th>
                  <th className="py-2.5 pr-4 text-right">Total Lot Cost</th>
                  <th className="py-2.5 text-right">True Cost / Kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {recycled.isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400">
                      Loading cost ledger…
                    </td>
                  </tr>
                ) : !filteredRecycled.length ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400">
                      No matching recycled batches found. Complete drying runs to track true cost per kg.
                    </td>
                  </tr>
                ) : (
                  filteredRecycled.map((row) => (
                    <tr key={row.batchNumber} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                      <td className="py-3 pr-4">
                        <Link
                          to={`/batches/${row.batchNumber}`}
                          className="font-mono text-xs font-bold text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
                        >
                          <span>{row.batchNumber}</span>
                          <ExternalLink className="size-3 text-zinc-400" />
                        </Link>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-zinc-800 dark:text-zinc-200">
                        {row.material || 'Regrind'}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                        {row.qtyOut.toLocaleString()} {row.uom}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-500">
                        ₦{row.directTotal.toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-500">
                        ₦{row.inheritedTotal.toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                        ₦{row.accumulatedTotal.toLocaleString()}
                      </td>
                      <td className="py-3 text-right">
                        <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          {row.trueRecycledCostPerKg != null
                            ? `₦${row.trueRecycledCostPerKg.toLocaleString()}/kg`
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
