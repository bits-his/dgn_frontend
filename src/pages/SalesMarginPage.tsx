import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, PageHeader, StatPill } from '@/components/ui'

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
    <div>
      <PageHeader
        eyebrow="Management analytics"
        title="Sales margin"
        description="Revenue against the real cost of the batches that were sold, net of anything customers sent back. This is where you see which products and customers actually make the factory money."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatPill label="Net revenue" value={money(t.revenue)} tone="accent" />
        <StatPill label="Cost of goods sold" value={money(t.cost)} />
        <StatPill
          label="Gross margin"
          value={`${money(t.grossMargin)} · ${t.grossMarginPercent}%`}
          tone={t.grossMargin > 0 ? 'success' : 'danger'}
        />
        <StatPill
          label="Return rate"
          value={`${t.returnRatePercent}%`}
          tone={t.returnRatePercent > 5 ? 'danger' : 'success'}
        />
      </div>

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="dgn-label">Discounts given</p>
            <p className="mt-1 text-lg font-semibold">{money(t.discounts)}</p>
            <p className="text-xs text-[var(--ink-faint)]">
              Margin after discounts {money(t.netMargin)}
            </p>
          </div>
          <div>
            <p className="dgn-label">Units sold</p>
            <p className="mt-1 text-lg font-semibold">{fmt(t.qtySold)}</p>
            <p className="text-xs text-[var(--ink-faint)]">{fmt(t.qtyNet)} net of returns</p>
          </div>
          <div>
            <p className="dgn-label">Units returned</p>
            <p className="mt-1 text-lg font-semibold">{fmt(t.qtyReturned)}</p>
          </div>
          <div>
            <p className="dgn-label">Outstanding receivables</p>
            <p
              className={
                'mt-1 text-lg font-semibold ' +
                (t.receivablesTotal > 0 ? 'text-red-700' : 'text-teal-700')
              }
            >
              {money(t.receivablesTotal)}
            </p>
          </div>
        </div>
      </Card>

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
