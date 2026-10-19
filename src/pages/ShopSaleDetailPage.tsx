import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { BookPanel, DataRow } from '@/components/outlet/OutletBookUi'
import { useAuthStore } from '@/stores/auth-store'
import {
  isOutletScoped,
  outletHomePath,
  shopBuyerPath,
  shopSaleInvoicePath,
  shopSaleReceiptPath,
  shopSalesListPath,
} from '@/lib/outlet'
import { formatBusinessDate } from '@/lib/dates'
import { money } from '@/pages/DistributorsPage'
import { cn } from '@/lib/utils'

type ShopSaleDetail = {
  id: number
  saleNumber: string
  saleType: string
  businessDate: string | null
  totalAmount: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  notes: string | null
  outletBuyerId: number | null
  buyerName: string
  buyerPhone: string | null
  soldBy: string | null
  outlet: {
    id: number
    code: string
    name: string
  } | null
  lines: {
    id: number
    productName: string | null
    qty: number
    uom: string
    unitPrice: number
    lineTotal: number
  }[]
}

export function ShopSaleDetailPage() {
  const { saleNumber } = useParams()
  const user = useAuthStore((s) => s.user)
  const scoped = isOutletScoped(user)

  const sale = useQuery({
    queryKey: ['outlet-sale', saleNumber],
    enabled: Boolean(saleNumber),
    queryFn: async () => {
      const { data } = await api.get(`/outlet-sales/by-number/${saleNumber}`)
      return data.data as ShopSaleDetail
    },
  })

  const s = sale.data
  const backTo = scoped
    ? shopSalesListPath()
    : s?.outlet
      ? shopSalesListPath(s.outlet.id, s.outlet.code)
      : outletHomePath(user)

  return (
    <PageLayout
      title={s?.saleNumber || 'Shop sale'}
      description={
        s
          ? `${s.outlet?.name || 'Shop'} · ${formatBusinessDate(s.businessDate) || '—'}`
          : 'Loading…'
      }
      back
      backTo={backTo}
      backLabel="All sales"
      actions={
        s ? (
          <div className="flex items-center gap-1.5">
            <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs font-semibold">
              <Link to={shopSaleInvoicePath(s.saleNumber)}>
                <FileText className="size-3.5" />
                Invoice
              </Link>
            </Button>
            {s.amountPaid > 0.001 ? (
              <Button asChild size="sm" className="h-8 gap-1 text-xs font-semibold">
                <Link to={shopSaleReceiptPath(s.saleNumber)}>
                  <Printer className="size-3.5" />
                  Receipt
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {sale.isLoading ? (
        <p className="text-xs text-zinc-500">Loading sale…</p>
      ) : sale.isError || !s ? (
        <p className="text-xs text-red-700">That shop sale could not be found.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Total
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{money(s.totalAmount)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Paid
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-teal-800">
                {money(s.amountPaid)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Balance
              </p>
              <p
                className={cn(
                  'mt-0.5 text-sm font-bold tabular-nums',
                  s.balanceDue > 0.001 ? 'text-amber-800' : 'text-zinc-900',
                )}
              >
                {money(s.balanceDue)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </p>
              <p className="mt-0.5 text-sm font-bold">{s.paymentStatus}</p>
              <p className="text-[10px] text-zinc-400">{s.saleType.toLowerCase()}</p>
            </div>
          </div>

          <BookPanel title="Customer">
            {s.outletBuyerId ? (
              <Link
                to={shopBuyerPath(
                  s.outletBuyerId,
                  scoped ? null : s.outlet?.id,
                  s.outlet?.code,
                )}
                className="text-sm font-semibold text-teal-800 hover:underline"
              >
                {s.buyerName}
              </Link>
            ) : (
              <p className="text-sm font-semibold text-zinc-900">{s.buyerName}</p>
            )}
            {s.buyerPhone ? <p className="text-[11px] text-zinc-500">{s.buyerPhone}</p> : null}
            {s.soldBy ? (
              <p className="mt-1 text-[11px] text-zinc-500">Sold by {s.soldBy}</p>
            ) : null}
          </BookPanel>

          <BookPanel title="Lines">
            {s.lines.map((line) => (
              <DataRow
                key={line.id}
                title={line.productName || 'Item'}
                meta={`${line.qty} ${line.uom} · ${money(line.unitPrice)} each`}
                value={money(line.lineTotal)}
              />
            ))}
          </BookPanel>
        </div>
      )}
    </PageLayout>
  )
}
