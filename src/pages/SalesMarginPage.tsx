import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { cn } from '@/lib/utils'

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
    return <p className="text-sm text-zinc-500">Working out the margins…</p>
  }

  const d = overview.data
  if (!d) {
    return <p className="text-sm text-red-700">Margin data could not be loaded.</p>
  }

  const t = d.totals

  return (
    <PageLayout
      title="Sales margin"
      description="Revenue vs cost · by product, customer, and batch"
      back
      backTo="/sales"
      backLabel="Sales"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          <Kpi label="Revenue" value={money(t.revenue)} hint={`${fmt(t.qtyNet)} net units`} />
          <Kpi label="Cost" value={money(t.cost)} hint={`Discounts ${money(t.discounts)}`} />
          <Kpi
            label="Gross margin"
            value={money(t.grossMargin)}
            hint={`${t.grossMarginPercent}%`}
            tone={t.grossMargin >= 0 ? 'ok' : 'bad'}
          />
          <Kpi
            label="Returns"
            value={`${t.returnRatePercent}%`}
            hint={`${fmt(t.qtyReturned)} units`}
            tone={t.returnRatePercent > 5 ? 'bad' : 'neutral'}
          />
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <SliceList title="By product" rows={d.byProduct} />
          <SliceList title="By customer" rows={d.byCustomer} />
        </div>

        <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-100 px-2.5 py-2 dark:border-zinc-800">
            <h2 className="text-xs font-semibold text-zinc-900 dark:text-white">By batch</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-[10px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                  <th className="px-2.5 py-1.5 font-semibold">Batch</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Qty</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Revenue</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Cost</th>
                  <th className="px-2.5 py-1.5 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {d.byBatch.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2.5 py-4 text-center text-zinc-500">
                      No batch margins yet.
                    </td>
                  </tr>
                ) : (
                  d.byBatch.map((row) => (
                    <tr key={row.key}>
                      <td className="px-2.5 py-1.5">
                        <Link
                          to={`/batches/${row.label}`}
                          className="font-mono font-semibold text-[var(--accent-strong)] hover:underline"
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{fmt(row.qty)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{money(row.revenue)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-zinc-500">
                        {money(row.cost)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        <span
                          className={cn(
                            'font-semibold tabular-nums',
                            row.margin >= 0 ? 'text-teal-700' : 'text-red-700',
                          )}
                        >
                          {money(row.margin)}
                        </span>
                        <span className="ml-1 text-[10px] text-zinc-400">{row.marginPercent}%</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageLayout>
  )
}

function Kpi({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'ok' | 'bad'
}) {
  return (
    <div className="rounded-lg border border-zinc-200/90 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-sm font-bold tabular-nums',
          tone === 'ok'
            ? 'text-teal-800 dark:text-teal-400'
            : tone === 'bad'
              ? 'text-red-700 dark:text-red-400'
              : 'text-zinc-900 dark:text-white',
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  )
}

function SliceList({ title, rows }: { title: string; rows: Slice[] }) {
  const best = rows.length ? Math.max(...rows.map((r) => r.revenue)) : 0

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-2.5 py-2 dark:border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-900 dark:text-white">{title}</h2>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto px-2.5 py-2">
        {rows.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-500">Nothing sold yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.key}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-200">
                  {row.label}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-500">
                  {money(row.revenue)} ·{' '}
                  <span
                    className={cn(
                      'font-semibold',
                      row.margin >= 0 ? 'text-teal-700' : 'text-red-700',
                    )}
                  >
                    {row.marginPercent}%
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-teal-600/80"
                  style={{ width: best > 0 ? `${(row.revenue / best) * 100}%` : '0%' }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
