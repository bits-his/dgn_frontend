import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Card } from '@/components/ui'
import { Button } from '@/components/ui/button'

type ScrapReceiptDetail = {
  id: number
  receivedAt?: string
  inboundForm?: 'RAW' | 'CRUSHED'
  netWeight: number | string
  pricePerKg: number | string
  purchaseCost: number | string
  transportCost?: number | string
  loadingCost?: number | string
  unloadingCost?: number | string
  scaleCost?: number | string
  netBagCost?: number | string
  sortingPricePerKg?: number | string
  sortingCost?: number | string
  otherCost?: number | string
  totalInboundCost?: number | string
  editable?: boolean
  lockReason?: string | null
  supplier?: { id: number; name: string } | null
  material?: { id: number; name: string; code?: string } | null
  batch?: {
    id: number
    batchNumber: string
    businessDate?: string | null
    qtyReject?: number | string
    qtyIn?: number | string
  } | null
}

function money(n: number | string | null | undefined) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `₦${v.toLocaleString()}`
}

function kg(n: number | string | null | undefined) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `${v.toLocaleString()} kg`
}

function formatDate(raw?: string | null) {
  if (!raw) return '—'
  if (/^\d{6}$/.test(raw)) {
    const yy = Number(raw.slice(0, 2))
    const mm = Number(raw.slice(2, 4))
    const dd = Number(raw.slice(4, 6))
    if (yy && mm && dd) {
      return new Date(2000 + yy, mm - 1, dd).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    }
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ScrapReceivingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const detail = useQuery({
    queryKey: ['scrap-receipt', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get(`/receiving/scrap/${id}`)
      return data.data as ScrapReceiptDetail
    },
  })

  if (detail.isLoading) {
    return (
      <PageLayout title="Scrap buying details" back backTo="/receiving">
        <Card className="p-6 text-sm text-[var(--ink-muted)]">Loading receipt…</Card>
      </PageLayout>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <PageLayout title="Scrap buying details" back backTo="/receiving">
        <Card className="p-6 text-sm text-red-700">Scrap receipt not found.</Card>
      </PageLayout>
    )
  }

  const r = detail.data
  const purchaseCost = Number(r.purchaseCost || 0)
  const transport = Number(r.transportCost || 0)
  const loading = Number(r.loadingCost || 0)
  const unloading = Number(r.unloadingCost || 0)
  const scale = Number(r.scaleCost || 0)
  const netBag = Number(r.netBagCost || 0)
  const sorting = Number(r.sortingCost || 0)
  const other = Number(r.otherCost || 0)
  const qtyKg = Number(r.netWeight || r.batch?.qtyIn || 0)
  const waste = Number(r.batch?.qtyReject || 0)
  const total =
    Number(r.totalInboundCost) ||
    purchaseCost + transport + loading + unloading + scale + netBag + sorting + other
  const otherExpenses = +(
    transport +
    loading +
    unloading +
    scale +
    netBag +
    sorting +
    other
  ).toFixed(2)
  // Cost = all-in total; Cost / kg = total ÷ (quantity − waste)
  const usableKg = Math.max(0, qtyKg - waste)
  const costPerKg = usableKg > 0 ? +(total / usableKg).toFixed(2) : 0
  const batchNumber = r.batch?.batchNumber
  const dateLabel = formatDate(r.batch?.businessDate || r.receivedAt)

  const expenseRows = [
    {
      label: 'Scrap buy',
      detail:
        Number(r.pricePerKg) > 0
          ? `@ ${money(r.pricePerKg)}/kg`
          : undefined,
      amount: purchaseCost,
    },
    { label: 'Transport', amount: transport },
    { label: 'Loading', amount: loading },
    { label: 'Unloading', amount: unloading },
    { label: 'Scale fee', amount: scale },
    { label: 'Net bag cost', amount: netBag },
    {
      label: 'Sorting',
      detail:
        Number(r.sortingPricePerKg) > 0
          ? `@ ${money(r.sortingPricePerKg)}/kg`
          : undefined,
      amount: sorting,
    },
    { label: 'Other', amount: other },
  ].filter((row) => row.amount > 0 || row.label === 'Scrap buy')

  return (
    <PageLayout
      title={batchNumber || `Receipt #${r.id}`}
      description="Scrap buying details"
      back
      backTo="/receiving"
      actions={
        r.editable !== false ? (
          <Button
            size="sm"
            className="h-8 text-xs font-semibold cursor-pointer"
            onClick={() => navigate(`/receiving/${r.id}/edit`)}
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" />
            <span>Edit costs</span>
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        <Card className="!p-4">
          <h2 className="text-base font-semibold">Summary</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <Fact label="Date" value={dateLabel} />
            <Fact label="Name of material" value={r.material?.name || '—'} />
            <Fact label="Quantity" value={kg(qtyKg)} />
            <Fact label="Waste" value={kg(waste)} />
            <Fact label="Cost / kg" value={costPerKg > 0 ? `${money(costPerKg)}/kg` : '—'} />
            <Fact label="Other cost" value={money(otherExpenses)} />
            <Fact label="Cost" value={money(total)} strong />
          </div>
        </Card>

        <Card className="!overflow-hidden !p-0">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="text-base font-semibold">Expense details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                  <th className="px-4 py-3 font-semibold">Expense</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.map((row) => (
                  <tr key={row.label} className="border-b border-[var(--line)]">
                    <td className="px-4 py-3">
                      <span className="font-medium text-[var(--ink)]">{row.label}</span>
                      {row.detail && (
                        <p className="text-xs text-[var(--ink-muted)]">{row.detail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {money(row.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-zinc-50">
                  <td className="px-4 py-3 font-semibold">Total</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {money(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}

function Fact({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm ${
          strong ? 'font-semibold text-[var(--ink)]' : 'font-medium text-[var(--ink)]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
