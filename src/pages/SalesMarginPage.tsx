import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  ShoppingBag,
  Percent,
  RotateCcw,
  TrendingDown,
  Package,
  AlertCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'

type Slice = {
  key: string
  label: string
  qty: number
  revenue: number
  cost: number
  margin: number
  marginPercent: number
  sales: number
}

type Overview = {
  totals: {
    revenue: number
    cost: number
    grossMargin: number
    grossMarginPercent: number
    discounts: number
    netMargin: number
    qtySold: number
    qtyNet: number
    qtyReturned: number
    returnRatePercent: number
    receivablesTotal: number
  }
  byProduct: Slice[]
  byCustomer: Slice[]
  byBatch: Slice[]
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function SalesMarginPage() {
  const overview = useQuery({
    queryKey: ['sales-overview'],
    queryFn: async () => {
      const { data } = await api.get('/sales/overview')
      return data.data as Overview
    },
  })

  if (overview.isLoading) {
    return <p className="text-sm text-[var(--ink-muted)]">Working out the margins…</p>
  }

  const d = overview.data
  if (!d) {
    return (
      <Card>
        <p className="text-sm text-red-700">Margin data could not be loaded.</p>
      </Card>
    )
  }

  const t = d.totals

  return (
    <PageLayout
      title="Sales margin"
      description="Management analytics · Gross margins, discounts, returns, and profitability"
      back={true}
      backTo="/sales"
      backLabel="Back to sales"
    >
      <div className="space-y-4">
        {/* Primary Profitability Cards: Compact 2 per row on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Net Revenue */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Net Revenue
                </span>
                <div className="size-5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <DollarSign className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                  {money(t.revenue)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Total invoiced sales
            </p>
          </div>

          {/* Cost of Goods Sold */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Cost of Goods Sold
                </span>
                <div className="size-5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                  <ShoppingBag className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                  {money(t.cost)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Material & lot expenses
            </p>
          </div>

          {/* Gross Margin */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Gross Margin
                </span>
                <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${t.grossMargin >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'}`}>
                  <Percent className="size-3" />
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate">
                  {money(t.grossMargin)}
                </span>
                <span className={`text-[9px] font-extrabold rounded px-1 py-0.2 ${t.grossMargin >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'}`}>
                  {t.grossMarginPercent}%
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Gross profit & yield
            </p>
          </div>

          {/* Return Rate */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Return Rate
                </span>
                <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${t.returnRatePercent > 5 ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400'}`}>
                  <RotateCcw className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className={`text-base sm:text-lg font-black tabular-nums tracking-tight truncate block ${t.returnRatePercent > 5 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
                  {t.returnRatePercent}%
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              {fmt(t.qtyReturned)} units returned
            </p>
          </div>
        </div>

        {/* Secondary Operational Metrics: Compact 2 per row on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Discounts Given */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Discounts Given
                </span>
                <div className="size-5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                  <TrendingDown className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                  {money(t.discounts)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Net margin {money(t.netMargin)}
            </p>
          </div>

          {/* Units Sold */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Volume Sold
                </span>
                <div className="size-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Package className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                  {fmt(t.qtySold)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              {fmt(t.qtyNet)} net of returns
            </p>
          </div>

          {/* Units Returned */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Volume Returned
                </span>
                <div className="size-5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <RotateCcw className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                  {fmt(t.qtyReturned)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Customer returns & RMAs
            </p>
          </div>

          {/* Receivables */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Receivables Due
                </span>
                <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${t.receivablesTotal > 0 ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400'}`}>
                  <AlertCircle className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className={`text-base sm:text-lg font-black tabular-nums tracking-tight truncate block ${t.receivablesTotal > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
                  {money(t.receivablesTotal)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Unpaid credit balances
            </p>
          </div>
        </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SliceTable title="By product" caption="Which products earn the most" rows={d.byProduct} />
        <SliceTable
          title="By customer"
          caption="Who buys, and at what margin"
          rows={d.byCustomer}
        />
      </div>

      <Card className="mt-6">
        <h2 className="text-base font-semibold">By batch</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          The margin each individual batch earned. A batch with a weak margin either cost too much
          to make or was sold too cheaply — open it to see which.
        </p>
        <div className="mt-4 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--ink-faint)]">
                <th className="py-2 pr-4">Batch</th>
                <th className="py-2 pr-4 text-right">Units</th>
                <th className="py-2 pr-4 text-right">Revenue</th>
                <th className="py-2 pr-4 text-right">Cost</th>
                <th className="py-2 pr-4 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {d.byBatch.map((row) => (
                <tr key={row.key} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-3 pr-4">
                    <Link
                      to={`/batches/${row.label}`}
                      className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                    >
                      {row.label}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-right">{fmt(row.qty)}</td>
                  <td className="py-3 pr-4 text-right">{money(row.revenue)}</td>
                  <td className="py-3 pr-4 text-right">{money(row.cost)}</td>
                  <td className="py-3 pr-4 text-right">
                    <span
                      className={
                        row.margin > 0
                          ? 'font-semibold text-teal-700'
                          : 'font-semibold text-red-700'
                      }
                    >
                      {money(row.margin)}
                    </span>
                    <p className="text-xs text-[var(--ink-faint)]">{row.marginPercent}%</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      </div>
    </PageLayout>
  )
}

function SliceTable({
  title,
  caption,
  rows,
}: {
  title: string
  caption: string
  rows: Slice[]
}) {
  const best = rows.length ? Math.max(...rows.map((r) => r.revenue)) : 0

  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">{caption}</p>
      {rows.length === 0 && (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">Nothing sold yet.</p>
      )}
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="text-[var(--ink-muted)]">
                {money(row.revenue)} ·{' '}
                <span
                  className={
                    row.margin > 0 ? 'font-semibold text-teal-700' : 'font-semibold text-red-700'
                  }
                >
                  {row.marginPercent}%
                </span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: best > 0 ? `${(row.revenue / best) * 100}%` : '0%' }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--ink-faint)]">
              {fmt(row.qty)} units · cost {money(row.cost)} · margin {money(row.margin)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
