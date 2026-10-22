import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { BrandMark } from '@/components/BrandMark'
import { shopSalePath } from '@/lib/outlet'
import { formatBusinessDate } from '@/lib/dates'
import { ChangeOutletCustomerDialog } from '@/components/outlet/ChangeOutletCustomerDialog'
import { fmtDozenPcs, isPieceUom } from '@/lib/units'

type ShopDoc = {
  id?: number
  saleNumber: string
  saleType: string
  businessDate: string | null
  totalAmount: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  buyerName: string
  buyerPhone: string | null
  soldBy: string | null
  outlet: {
    code: string
    name: string
    phone: string | null
    address: string | null
    region: string | null
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

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function statusLabel(sale: ShopDoc) {
  if (sale.balanceDue <= 0.001) return 'Paid'
  if (sale.amountPaid > 0.001) return 'Part paid'
  return 'Unpaid'
}

export function ShopSaleInvoicePage() {
  return <ShopSaleDocument kind="invoice" />
}

export function ShopSaleReceiptPage() {
  return <ShopSaleDocument kind="receipt" />
}

function ShopSaleDocument({ kind }: { kind: 'invoice' | 'receipt' }) {
  const { saleNumber } = useParams()
  const [changeCustomerOpen, setChangeCustomerOpen] = useState(false)

  const sale = useQuery({
    queryKey: ['outlet-sale', saleNumber],
    enabled: Boolean(saleNumber),
    queryFn: async () => {
      const { data } = await api.get(`/outlet-sales/by-number/${saleNumber}`)
      return data.data as ShopDoc
    },
  })

  const s = sale.data
  const title = s
    ? kind === 'invoice'
      ? `Invoice ${s.saleNumber}`
      : `Receipt ${s.saleNumber}`
    : kind === 'invoice'
      ? 'Invoice'
      : 'Receipt'

  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])

  if (sale.isLoading) {
    return <p className="p-8 text-sm text-zinc-800">Loading {kind}…</p>
  }

  if (sale.isError || !s) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-700">That shop sale could not be found.</p>
        <Link className="dgn-btn dgn-btn-secondary mt-4" to="/shop/sales">
          Back to shop sales
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[var(--bg)] print:bg-white">
      <div className="dgn-print-hide mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-0">
        <Link className="dgn-btn dgn-btn-ghost" to={shopSalePath(s.saleNumber)}>
          <ArrowLeft className="h-4 w-4" /> Back to sale
        </Link>
        <button type="button" className="dgn-btn dgn-btn-primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      <article className="dgn-doc mx-auto mb-10 max-w-[210mm] bg-white shadow-sm print:mb-0 print:max-w-none print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-zinc-300 pb-5">
          <div className="flex items-center gap-3">
            <BrandMark size={56} />
            <div>
              <p className="text-xl font-semibold tracking-tight">
                {s.outlet?.name || 'Market shop'}
              </p>
              <p className="mt-0.5 text-sm text-zinc-600">
                {s.outlet?.code ? `${s.outlet.code} · ` : ''}
                Shop sale · NGN
              </p>
              {s.outlet?.phone ? (
                <p className="text-sm text-zinc-600">{s.outlet.phone}</p>
              ) : null}
              {s.outlet?.address || s.outlet?.region ? (
                <p className="text-sm text-zinc-600">
                  {[s.outlet.address, s.outlet.region].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {kind === 'invoice' ? 'Invoice' : 'Payment receipt'}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold">{s.saleNumber}</p>
            <p className="mt-1 text-sm text-zinc-700">{formatBusinessDate(s.businessDate)}</p>
            <p className="mt-1 text-sm font-semibold">
              {s.saleType} · {statusLabel(s)}
            </p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Bill to
              </p>
              <button
                type="button"
                className="dgn-print-hide flex items-center gap-1 text-[11px] font-semibold text-teal-800 hover:underline"
                onClick={() => setChangeCustomerOpen(true)}
              >
                <UserCheck className="size-3" />
                Change
              </button>
            </div>
            <p className="mt-1 font-semibold">{s.buyerName || 'Walk-in'}</p>
            {s.buyerPhone ? <p className="text-sm text-zinc-700">{s.buyerPhone}</p> : null}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {kind === 'invoice' ? 'Invoice' : 'Receipt'}
            </p>
            <p className="mt-1 text-sm text-zinc-800">
              Date: {formatBusinessDate(s.businessDate)}
            </p>
            <p className="text-sm text-zinc-800">Recorded by: {s.soldBy || '—'}</p>
          </div>
        </section>

        {kind === 'invoice' ? (
          <section className="mt-8">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-y border-zinc-300 text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Goods</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Price</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.lines.map((line, index) => (
                  <tr key={line.id} className="border-b border-zinc-200">
                    <td className="py-2.5 pr-3 text-zinc-500">{index + 1}</td>
                    <td className="py-2.5 pr-3 text-zinc-900">{line.productName || '—'}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {isPieceUom(line.uom) ? (
                        <div>
                          <span className="font-semibold text-zinc-900">{fmtDozenPcs(line.qty)}</span>
                          <span className="block text-[10px] text-zinc-500">({line.qty} pcs)</span>
                        </div>
                      ) : (
                        `${line.qty} ${line.uom}`
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{money(line.unitPrice)}</td>
                    <td className="py-2.5 text-right font-medium tabular-nums">
                      {money(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="mt-8 rounded-lg border border-zinc-200 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Payment received
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-teal-800">
              {money(s.amountPaid)}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Method: {s.saleType}
              {s.balanceDue > 0.001 ? ` · Balance still due ${money(s.balanceDue)}` : ' · Settled'}
            </p>
          </section>
        )}

        <section className="mt-6 ml-auto w-full max-w-[14rem] space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-zinc-600">Total</span>
            <span className="font-semibold tabular-nums">{money(s.totalAmount)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-zinc-600">Paid</span>
            <span className="font-semibold tabular-nums text-teal-800">{money(s.amountPaid)}</span>
          </div>
          <div className="flex justify-between gap-3 border-t border-zinc-300 pt-1.5">
            <span className="font-semibold">Balance due</span>
            <span
              className={`font-bold tabular-nums ${
                s.balanceDue > 0.001 ? 'text-red-700' : 'text-zinc-900'
              }`}
            >
              {money(s.balanceDue)}
            </span>
          </div>
        </section>
      </article>

      {s.id ? (
        <ChangeOutletCustomerDialog
          open={changeCustomerOpen}
          onClose={() => setChangeCustomerOpen(false)}
          saleId={s.id}
          currentBuyerName={s.buyerName}
          outletId={s.outlet ? (s as any).outletCustomerId : undefined}
          totalAmount={s.totalAmount}
          currentAmountPaid={s.amountPaid}
        />
      ) : null}
    </div>
  )
}
