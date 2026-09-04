import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect } from 'react'
import { api } from '@/lib/api'

type DocLine = {
  id: number
  batchNumber: string | null
  productName: string | null
  qty: number
  qtyReturned: number
  uom: string
  unitPrice: number
  lineTotal: number
}

type DocPayment = {
  id: number | string
  amount: number
  paymentMethod: string | null
  receivedAt: string | null
  reference: string | null
  note: string | null
  recordedAt: string | null
  recordedBy: string | null
}

type DocSale = {
  saleNumber: string
  customer: {
    code?: string | null
    name: string
    phone: string | null
    customerType?: string | null
    address?: string | null
    contactPerson?: string | null
    region?: string | null
    paymentTermsDays?: number | null
  } | null
  saleType: string
  status: string
  businessDate: string | null
  subtotal: number
  discount: number
  transportCharge: number
  totalAmount: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  vehicleNumber: string | null
  driverName: string | null
  driverPhone: string | null
  destination: string | null
  dispatchedAt: string | null
  soldBy: string | null
  lines: DocLine[]
  returns: { returnNumber: string; qty: number; uom: string; refundAmount: number }[]
  payments?: DocPayment[]
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function formatBusinessDate(raw?: string | null) {
  if (!raw) return '—'
  if (raw.length === 6 && /^\d{6}$/.test(raw)) {
    const yy = Number(raw.slice(0, 2))
    const mm = Number(raw.slice(2, 4))
    const dd = Number(raw.slice(4, 6))
    const date = new Date(2000 + yy, mm - 1, dd)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    }
  }
  return raw
}

function formatWhen(raw?: string | null) {
  if (!raw) return '—'
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function methodLabel(method?: string | null) {
  if (method === 'CASH') return 'Cash'
  if (method === 'TRANSFER') return 'Bank transfer'
  if (method === 'POS') return 'POS'
  return method || 'On dispatch'
}

function statusLabel(sale: DocSale) {
  if (sale.balanceDue <= 0.001) return 'Paid'
  if (sale.amountPaid > 0.001) return 'Part paid'
  return 'Unpaid'
}

function paymentsForDocument(sale: DocSale): DocPayment[] {
  const listed = sale.payments || []
  const listedTotal = listed.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const gap = Number((sale.amountPaid - listedTotal).toFixed(2))
  if (gap > 0.001) {
    return [
      {
        id: 'dispatch',
        amount: gap,
        paymentMethod: sale.saleType === 'CASH' ? 'CASH' : null,
        receivedAt: sale.dispatchedAt,
        reference: null,
        note: 'Collected on dispatch',
        recordedAt: sale.dispatchedAt,
        recordedBy: sale.soldBy,
      },
      ...listed,
    ]
  }
  return listed
}

function FactoryMark() {
  return (
    <div>
      <p className="text-xl font-semibold tracking-tight">DGN Factory</p>
      <p className="mt-0.5 text-sm text-zinc-600">Plastics recycling · NGN · Africa/Lagos</p>
    </div>
  )
}

function SaleDocument({ kind }: { kind: 'invoice' | 'receipt' }) {
  const { saleNumber } = useParams()
  const [params] = useSearchParams()
  const paymentId = params.get('p')

  const sale = useQuery({
    queryKey: ['sale', saleNumber],
    queryFn: async () => {
      const { data } = await api.get(`/sales/${saleNumber}`)
      return data.data as DocSale
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
        <p className="text-sm text-red-700">That sale could not be found.</p>
        <Link className="dgn-btn dgn-btn-secondary mt-4" to="/sales">
          Back to sales
        </Link>
      </div>
    )
  }

  const collected = paymentsForDocument(s)
  const focused = paymentId ? collected.find((row) => String(row.id) === paymentId) : null
  const receiptRows = kind === 'receipt' ? (focused ? [focused] : collected) : collected

  return (
    <div className="min-h-svh bg-[var(--bg)] print:bg-white">
      <div className="dgn-print-hide mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-0">
        <Link className="dgn-btn dgn-btn-ghost" to={`/sales/${s.saleNumber}`}>
          <ArrowLeft className="h-4 w-4" /> Back to sale
        </Link>
        <button type="button" className="dgn-btn dgn-btn-primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      <article className="dgn-doc mx-auto mb-10 max-w-[210mm] bg-white px-8 py-8 shadow-sm print:mb-0 print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-zinc-300 pb-5">
          <FactoryMark />
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {kind === 'invoice' ? 'Invoice' : 'Payment receipt'}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold">{s.saleNumber}</p>
            <p className="mt-1 text-sm text-zinc-700">{formatBusinessDate(s.businessDate)}</p>
            <p className="mt-1 text-sm font-semibold">
              {s.saleType === 'CASH' ? 'Cash sale' : 'Credit sale'} · {statusLabel(s)}
            </p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Bill to
            </p>
            <p className="mt-1 font-semibold">{s.customer?.name || '—'}</p>
            {s.customer?.code && (
              <p className="font-mono text-xs text-zinc-600">{s.customer.code}</p>
            )}
            {s.customer?.contactPerson && (
              <p className="mt-1 text-sm text-zinc-700">{s.customer.contactPerson}</p>
            )}
            {s.customer?.phone && <p className="text-sm text-zinc-700">{s.customer.phone}</p>}
            {s.customer?.address && <p className="text-sm text-zinc-700">{s.customer.address}</p>}
            {s.customer?.region && <p className="text-sm text-zinc-700">{s.customer.region}</p>}
            {s.saleType !== 'CASH' && s.customer?.paymentTermsDays ? (
              <p className="mt-2 text-sm text-zinc-700">
                Payment terms: {s.customer.paymentTermsDays} days
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Dispatch
            </p>
            <p className="mt-1 text-sm text-zinc-800">
              Destination: {s.destination || '—'}
            </p>
            <p className="text-sm text-zinc-800">Vehicle: {s.vehicleNumber || '—'}</p>
            <p className="text-sm text-zinc-800">Driver: {s.driverName || '—'}</p>
            {s.driverPhone && <p className="text-sm text-zinc-800">{s.driverPhone}</p>}
            <p className="text-sm text-zinc-800">
              Dispatched: {s.dispatchedAt ? formatWhen(s.dispatchedAt) : '—'}
            </p>
            <p className="text-sm text-zinc-800">Recorded by: {s.soldBy || '—'}</p>
          </div>
        </section>

        {kind === 'invoice' && (
          <section className="mt-8">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-y border-zinc-300 text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Goods</th>
                  <th className="py-2 pr-3">Batch</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Price</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.lines.map((line, index) => (
                  <tr key={line.id} className="border-b border-zinc-200">
                    <td className="py-2.5 pr-3 text-zinc-500">{index + 1}</td>
                    <td className="py-2.5 pr-3">
                      {line.productName || '—'}
                      {line.qtyReturned > 0 && (
                        <span className="block text-xs text-zinc-600">
                          {fmt(line.qtyReturned)} {line.uom} returned
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{line.batchNumber || '—'}</td>
                    <td className="py-2.5 pr-3 text-right">
                      {fmt(line.qty)} {line.uom}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{money(line.unitPrice)}</td>
                    <td className="py-2.5 text-right font-semibold">{money(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {kind === 'receipt' && (
          <section className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {focused ? 'This payment' : 'Payments received'}
            </p>
            {receiptRows.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-700">No payments recorded on this sale yet.</p>
            ) : (
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-zinc-300 text-[11px] uppercase tracking-wide text-zinc-500">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">How</th>
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptRows.map((row) => (
                    <tr key={String(row.id)} className="border-b border-zinc-200">
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {formatWhen(row.receivedAt || row.recordedAt)}
                      </td>
                      <td className="py-2.5 pr-3">{methodLabel(row.paymentMethod)}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs">
                        {row.reference || row.note || '—'}
                      </td>
                      <td className="py-2.5 text-right font-semibold">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <section className="mt-6 ml-auto w-full max-w-xs space-y-1.5 text-sm">
          {kind === 'invoice' && (
            <>
              <DocRow label="Goods value" value={money(s.subtotal)} />
              <DocRow label="Discount" value={`− ${money(s.discount)}`} />
              <DocRow label="Transport" value={`+ ${money(s.transportCharge)}`} />
            </>
          )}
          <DocRow label="Invoice total" value={money(s.totalAmount)} strong />
          <DocRow label="Amount received" value={money(s.amountPaid)} />
          <DocRow
            label="Balance due"
            value={money(s.balanceDue)}
            strong
            tone={s.balanceDue > 0.001 ? 'due' : 'paid'}
          />
        </section>

        {s.returns.length > 0 && kind === 'invoice' && (
          <p className="mt-6 text-xs text-zinc-600">
            Returns recorded on this invoice: {s.returns.length}. Totals above are after refunds.
          </p>
        )}

        <footer className="mt-10 grid gap-10 sm:grid-cols-2">
          <div className="border-t border-zinc-400 pt-2 text-sm text-zinc-700">
            Received by / cashier
          </div>
          <div className="border-t border-zinc-400 pt-2 text-sm text-zinc-700">
            Customer / driver
          </div>
        </footer>
        <p className="mt-8 text-xs text-zinc-500">
          Goods leave the factory against this invoice. Please check quantity and condition on
          collection. Balance on credit sales is due per the terms above.
        </p>
      </article>
    </div>
  )
}

function DocRow({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'due' | 'paid'
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-zinc-600">{label}</span>
      <span
        className={
          (strong ? 'font-semibold ' : '') +
          (tone === 'due' ? 'text-red-700' : tone === 'paid' ? 'text-teal-800' : '')
        }
      >
        {value}
      </span>
    </div>
  )
}

export function SaleInvoicePage() {
  return <SaleDocument kind="invoice" />
}

export function SaleReceiptPage() {
  return <SaleDocument kind="receipt" />
}
