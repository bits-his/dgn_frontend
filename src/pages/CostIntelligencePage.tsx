import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, PageHeader, StatPill } from '@/components/ui'

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

const CLASS_LABELS: Record<string, string> = {
  PURCHASE: 'Material purchase',
  LOGISTICS: 'Transport & handling',
  LABOUR: 'Labour',
  PROCESSING: 'Processing / chemicals',
  UTILITIES: 'Energy & utilities',
  MAINTENANCE: 'Maintenance',
  OVERHEAD: 'Overhead',
  OTHER: 'Other',
}

export function CostIntelligencePage() {
  const overview = useQuery({
    queryKey: ['costs-overview'],
    queryFn: async () => {
      const { data } = await api.get('/costs/overview')
      return data.data as CostOverview
    },
  })

  const recycled = useQuery({
    queryKey: ['costs-recycled'],
    queryFn: async () => {
      const { data } = await api.get('/costs/recycled-material')
      return data.data as RecycledRow[]
    },
  })

  const ov = overview.data

  return (
    <div>
      <PageHeader
        eyebrow="Finance intelligence"
        title="Cost intelligence"
        description="True recycled material cost/kg rolls up purchase, logistics, labour and processing across the full batch lineage."
      />

      {ov && (
        <Card
          className={
            'mb-6 ' +
            (ov.overheadIncluded
              ? 'border-teal-200 bg-teal-50/40'
              : 'border-amber-200 bg-amber-50/50')
          }
        >
          {ov.overheadIncluded ? (
            <p className="text-sm text-teal-900">
              <span className="font-semibold">This is the fully loaded cost.</span> Factory
              overhead of {`₦${ov.overheadPerKg?.toLocaleString()}`}/kg is included, on top of{' '}
              {`₦${ov.avgCostPerKgExcludingOverhead?.toLocaleString()}`}/kg of materials and
              direct costs.
              {ov.batchesWithoutOverhead > 0 &&
                ` ${ov.batchesWithoutOverhead} batch${ov.batchesWithoutOverhead === 1 ? '' : 'es'} sit in a month that has not been closed yet, so they still carry direct costs only.`}
            </p>
          ) : (
            <p className="text-sm text-amber-900">
              <span className="font-semibold">This cost excludes factory overhead.</span> Rent,
              diesel, electricity and wages are not in these figures yet. Close the month on the{' '}
              <Link to="/costs/overhead" className="font-semibold underline">
                factory overhead
              </Link>{' '}
              page to spread them across output and see the real cost per kilogram.
            </p>
          )}
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatPill
          label={ov?.overheadIncluded ? 'Avg loaded cost / kg (DRY)' : 'Avg cost / kg (DRY)'}
          value={
            ov?.avgTrueRecycledCostPerKg != null
              ? `₦${ov.avgTrueRecycledCostPerKg.toLocaleString()}`
              : '—'
          }
          tone="accent"
        />
        <StatPill
          label="Total accumulated (DRY)"
          value={ov ? `₦${ov.totalAccumulatedCost.toLocaleString()}` : '—'}
        />
        <StatPill
          label="Usable dried kg"
          value={ov ? `${ov.totalUsableKg.toLocaleString()} kg` : '—'}
          tone="success"
        />
        <StatPill label="DRY batches" value={ov ? String(ov.dryBatchCount) : '—'} />
      </div>

      {ov && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold tracking-tight">Cost mix (DRY batches)</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Operational management view · {ov.costScope.replace(/_/g, ' ').toLowerCase()} ·
            overhead {ov.overheadIncluded ? 'included' : 'excluded'}
          </p>
          <div className="mt-5 space-y-3">
            <MixBar label="Purchase" pct={ov.costMixPercent.purchase} tone="bg-amber-500" />
            <MixBar label="Logistics" pct={ov.costMixPercent.logistics} tone="bg-slate-600" />
            <MixBar label="Labour" pct={ov.costMixPercent.labour} tone="bg-teal-600" />
            <MixBar
              label="Processing"
              pct={ov.costMixPercent.processing}
              tone="bg-violet-600"
            />
            <MixBar
              label="Utilities"
              pct={ov.costMixPercent.utilities}
              tone="bg-sky-600"
            />
            <MixBar
              label="Maintenance"
              pct={ov.costMixPercent.maintenance}
              tone="bg-orange-600"
            />
            <MixBar
              label="Allocated overhead"
              pct={ov.costMixPercent.overhead}
              tone="bg-rose-600"
            />
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Recycled material batches</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          DRY batches with lineage-based true cost per kg
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--ink-muted)]">
                <th className="py-3 pr-4 font-semibold">Batch</th>
                <th className="py-3 pr-4 font-semibold">Material</th>
                <th className="py-3 pr-4 font-semibold">Output</th>
                <th className="py-3 pr-4 font-semibold">Direct</th>
                <th className="py-3 pr-4 font-semibold">Inherited</th>
                <th className="py-3 pr-4 font-semibold">Total</th>
                <th className="py-3 font-semibold">True ₦/kg</th>
              </tr>
            </thead>
            <tbody>
              {recycled.isLoading && (
                <tr>
                  <td colSpan={7} className="py-6 text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {recycled.data?.map((row) => (
                <tr key={row.batchNumber} className="border-b border-zinc-100">
                  <td className="py-3 pr-4">
                    <Link
                      to={`/batches/${row.batchNumber}`}
                      className="font-semibold text-[var(--accent-strong)] hover:underline"
                    >
                      {row.batchNumber}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{row.material || '—'}</td>
                  <td className="py-3 pr-4">
                    {row.qtyOut} {row.uom}
                  </td>
                  <td className="py-3 pr-4">₦{row.directTotal.toLocaleString()}</td>
                  <td className="py-3 pr-4">₦{row.inheritedTotal.toLocaleString()}</td>
                  <td className="py-3 pr-4 font-medium">
                    ₦{row.accumulatedTotal.toLocaleString()}
                  </td>
                  <td className="py-3 font-semibold text-[var(--accent-strong)]">
                    {row.trueRecycledCostPerKg != null
                      ? `₦${row.trueRecycledCostPerKg.toLocaleString()}`
                      : '—'}
                  </td>
                </tr>
              ))}
              {!recycled.isLoading && !recycled.data?.length && (
                <tr>
                  <td colSpan={7} className="py-6 text-[var(--ink-muted)]">
                    No dried batches yet. Complete receiving → sorting → crushing → washing →
                    drying to see true cost/kg.
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

function MixBar({
  label,
  pct,
  tone,
}: {
  label: string
  pct: number
  tone: string
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

export { CLASS_LABELS }
