import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Printer } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { DistributorPaymentForm } from '@/pages/DistributorPaymentForm'

type SaleLine = {
  id: number
  batchNumber: string | null
  productName: string | null
  qty: number
  qtyReturned: number
  uom: string
  unitPrice: number
  lineTotal: number
  unitCost: number
  lineCost: number
  lineMargin: number
  lineMarginPercent: number
}

type SaleReturnRow = {
  id: number
  returnNumber: string
  batchNumber: string | null
  qty: number
  uom: string
  reason: string
  condition: string
  refundAmount: number
  reworkBatchNumber: string | null
  businessDate: string | null
  notes: string | null
}

type SaleDetail = {
  id: number
  saleNumber: string
  customer: {
    id: number
    code?: string | null
    name: string
    phone: string | null
    customerType?: string | null
    address?: string | null
  } | null
  saleType: string
  status: string
  businessDate: string | null
  subtotal: number
  discount: number
  transportCharge: number
  totalAmount: number
  totalCost: number
  grossMargin: number
  grossMarginPercent: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  vehicleNumber: string | null
  driverName: string | null
  driverPhone: string | null
  destination: string | null
  dispatchedAt: string | null
  notes: string | null
  dispatchNotes?: string | null
  soldBy: string | null
  lines: SaleLine[]
  returns: SaleReturnRow[]
  payments?: {
    id: number | string
    amount: number
    paymentMethod: string | null
    receivedAt: string | null
    reference: string | null
    note: string | null
    recordedAt: string | null
    recordedBy: string | null
  }[]
}

const CONDITION_COPY: Record<string, string> = {
  RESALEABLE: 'Good — goes back into the finished goods store',
  REWORK: 'Damaged but recyclable — becomes a regrind batch for crushing',
  SCRAP: 'Unusable — written off as a loss, nothing returns to stock',
}

const REASON_COPY: Record<string, string> = {
  DAMAGED_IN_TRANSIT: 'Damaged in transit',
  QUALITY_COMPLAINT: 'Quality complaint',
  WRONG_PRODUCT: 'Wrong product supplied',
  OVER_SUPPLY: 'Customer got too many',
  CUSTOMER_CANCELLED: 'Customer cancelled',
  OTHER: 'Other',
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
  return method || '—'
}

export function SaleDetailPage() {
  const { saleNumber } = useParams()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canSell = hasPermission(user, 'sales.create')
  const [returningLine, setReturningLine] = useState<SaleLine | null>(null)
  const [payOpen, setPayOpen] = useState(false)

  const sale = useQuery({
    queryKey: ['sale', saleNumber],
    queryFn: async () => {
      const { data } = await api.get(`/sales/${saleNumber}`)
      return data.data as SaleDetail
    },
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['sale', saleNumber] })
    queryClient.invalidateQueries({ queryKey: ['sales'] })
    queryClient.invalidateQueries({ queryKey: ['sales-overview'] })
    queryClient.invalidateQueries({ queryKey: ['sellable-batches'] })
    queryClient.invalidateQueries({ queryKey: ['distributors'] })
    queryClient.invalidateQueries({ queryKey: ['distributor'] })
  }

  if (sale.isLoading) {
    return <p className="text-sm text-zinc-800">Loading sale…</p>
  }

  if (sale.isError || !sale.data) {
    return (
      <Card>
        <p className="text-sm text-red-700">That sale could not be found.</p>
        <Link className="dgn-btn dgn-btn-secondary mt-4" to="/sales">
          Back to sales
        </Link>
      </Card>
    )
  }

  const s = sale.data
  const unpaid = s.balanceDue > 0.001
  const payments = s.payments || []
  const customerIsDistributor = s.customer?.customerType === 'DISTRIBUTOR' && Boolean(s.customer.code)

  return (
    <PageLayout
      title={`Sale: ${s.saleNumber}`}
      description={`${customerIsDistributor ? s.customer?.name : s.customer?.name || 'Customer'} · ${s.saleType.toLowerCase()} · ${s.status.replace('_', ' ').toLowerCase()}`}
      back={true}
      backTo="/sales"
      backLabel="All sales"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center" asChild>
            <Link to={`/sales/${s.saleNumber}/invoice`} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Printer className="size-3.5 shrink-0" />
              <span>Invoice</span>
            </Link>
          </Button>
          {s.amountPaid > 0.001 && (
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center" asChild>
              <Link to={`/sales/${s.saleNumber}/receipt`} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <Printer className="size-3.5 shrink-0" />
                <span>Receipt</span>
              </Link>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <Card className="!p-5">
          <h2 className="text-base font-semibold mb-3">Order summary</h2>
          <div className="space-y-2 text-sm">
          <Row label="Goods value" value={money(s.subtotal)} />
          <Row label="Discount" value={`− ${money(s.discount)}`} />
          <div className="border-t border-[var(--line)] pt-2">
            <Row label="Total" value={money(s.totalAmount)} strong />
          </div>
          <Row label="Paid" value={money(s.amountPaid)} />
          <Row label="Balance" value={money(s.balanceDue)} tone={unpaid ? 'bad' : 'good'} strong />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Fact label="Business date" value={formatBusinessDate(s.businessDate)} />
          <Fact label="Recorded by" value={s.soldBy || '—'} />
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-base font-semibold">Customer</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Fact label="Name" value={s.customer?.name || '—'} />
          <Fact label="Type" value={s.customer?.customerType?.toLowerCase() || '—'} />
          <Fact label="Phone" value={s.customer?.phone || '—'} />
          <Fact label="Address" value={s.customer?.address || '—'} />
          {customerIsDistributor && (
            <div className="sm:col-span-2">
              <Link
                to={`/distributors/${s.customer!.code}`}
                className="text-sm font-semibold text-[var(--accent-strong)] hover:underline"
              >
                Open distributor ledger
              </Link>
            </div>
          )}
        </dl>
        {s.dispatchNotes && (
          <div className="mt-4">
            <Fact label="Notes" value={s.dispatchNotes} />
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Payments</h2>
            <p className="text-sm text-zinc-700">
              {unpaid
                ? `${money(s.balanceDue)} still owed · ${money(s.amountPaid)} collected of ${money(s.totalAmount)}`
                : `${money(s.amountPaid)} collected`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canSell && unpaid && (
              <Button
                type="button"
                size="sm"
                className="h-8 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
                onClick={() => setPayOpen(true)}
              >
                <CreditCard className="size-3.5 shrink-0" />
                <span>Record payment</span>
              </Button>
            )}
          </div>
        </div>
        {payments.length > 0 ? (
          <div className="mt-4 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">How</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 pr-4">Reference</th>
                  <th className="py-2 pr-4">Note</th>
                  <th className="py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((row) => (
                  <tr key={String(row.id)} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {formatWhen(row.receivedAt || row.recordedAt)}
                    </td>
                    <td className="py-3 pr-4">{methodLabel(row.paymentMethod)}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{money(row.amount)}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{row.reference || '—'}</td>
                    <td className="py-3 pr-4 text-zinc-700">{row.note || '—'}</td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/sales/${s.saleNumber}/receipt?p=${encodeURIComponent(String(row.id))}`}
                        className="text-sm font-semibold text-[var(--accent-strong)]"
                      >
                        Receipt
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-700">No payments recorded yet.</p>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="text-base font-semibold">Goods</h2>
        <p className="text-sm text-zinc-700">
          {s.lines.length} line{s.lines.length === 1 ? '' : 's'}
        </p>
        <div className="mt-4 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Batch</th>
                <th className="py-2 pr-4 text-right">Qty</th>
                <th className="py-2 pr-4 text-right">Price</th>
                <th className="py-2 pr-4 text-right">Value</th>
                <th className="py-2 pr-4 text-right">Cost</th>
                <th className="py-2 pr-4 text-right">Margin</th>
                <th className="py-2 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {s.lines.map((line) => {
                const returnable = line.qty - line.qtyReturned
                return (
                  <tr key={line.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{line.productName || '—'}</p>
                      {line.qtyReturned > 0 && (
                        <p className="text-xs text-amber-800">
                          {fmt(line.qtyReturned)} {line.uom} returned
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {line.batchNumber ? (
                        <Link
                          to={`/batches/${line.batchNumber}`}
                          className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                        >
                          {line.batchNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {fmt(line.qty)} {line.uom}
                    </td>
                    <td className="py-3 pr-4 text-right">{money(line.unitPrice)}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{money(line.lineTotal)}</td>
                    <td className="py-3 pr-4 text-right">{money(line.lineCost)}</td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={
                          line.lineMargin > 0 ? 'font-semibold text-teal-700' : 'font-semibold text-red-700'
                        }
                      >
                        {money(line.lineMargin)}
                      </span>
                      <p className="text-xs text-zinc-500">{line.lineMarginPercent}%</p>
                    </td>
                    <td className="py-3 text-right">
                      {canSell && returnable > 0.001 && (
                        <button
                          type="button"
                          className="text-sm font-semibold text-[var(--accent-strong)]"
                          onClick={() => setReturningLine(line)}
                        >
                          Return
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {s.returns.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold">Returns</h2>
          <div className="mt-4 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-4">Return</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2 pr-4 text-right">Qty</th>
                  <th className="py-2 text-right">Refund</th>
                </tr>
              </thead>
              <tbody>
                {s.returns.map((ret) => (
                  <tr key={ret.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-mono text-xs font-semibold">{ret.returnNumber}</p>
                      <p className="text-xs text-zinc-500">{ret.condition.toLowerCase()}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {ret.batchNumber ? (
                        <Link
                          to={`/batches/${ret.batchNumber}`}
                          className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                        >
                          {ret.batchNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {REASON_COPY[ret.reason] ?? ret.reason}
                      {ret.notes && <p className="text-xs text-zinc-500">{ret.notes}</p>}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {fmt(ret.qty)} {ret.uom}
                    </td>
                    <td className="py-3 text-right font-semibold">{money(ret.refundAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {returningLine && (
        <ReturnDialog
          line={returningLine}
          onClose={() => setReturningLine(null)}
          onSaved={() => {
            setReturningLine(null)
            refresh()
          }}
        />
      )}

      {payOpen && (
        <Dialog title="Record payment" onClose={() => setPayOpen(false)}>
          <DistributorPaymentForm
            unpaid={[
              {
                saleNumber: s.saleNumber,
                businessDate: s.businessDate,
                totalAmount: s.totalAmount,
                amountPaid: s.amountPaid,
                balanceDue: s.balanceDue,
                paymentStatus: s.paymentStatus,
              },
            ]}
            onSaved={() => {
              setPayOpen(false)
              refresh()
            }}
          />
        </Dialog>
      )}
      </div>
    </PageLayout>
  )
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p
        className={
          'mt-1 text-sm font-semibold text-zinc-900 ' +
          (tone === 'good' ? 'text-teal-700' : tone === 'bad' ? 'text-red-700' : '')
        }
      >
        {value}
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-zinc-700">{label}</span>
      <span
        className={
          (strong ? 'font-semibold ' : '') +
          (tone === 'good' ? 'text-teal-700' : tone === 'bad' ? 'text-red-700' : '')
        }
      >
        {value}
      </span>
    </div>
  )
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="dgn-card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="dgn-btn dgn-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

function ReturnDialog({
  line,
  onClose,
  onSaved,
}: {
  line: SaleLine
  onClose: () => void
  onSaved: () => void
}) {
  const returnable = line.qty - line.qtyReturned
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('QUALITY_COMPLAINT')
  const [condition, setCondition] = useState('RESALEABLE')
  const [refundAmount, setRefundAmount] = useState('')
  const [reworkWeightKg, setReworkWeightKg] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const amount = Number(qty) || 0
  const defaultRefund = amount * line.unitPrice

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      await api.post('/sales/returns', {
        saleLineId: line.id,
        qty: amount,
        reason,
        condition,
        refundAmount: refundAmount === '' ? undefined : Number(refundAmount),
        reworkWeightKg: reworkWeightKg === '' ? undefined : Number(reworkWeightKg),
        notes,
      })
      onSaved()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not record the return'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog title="Take goods back" onClose={onClose}>
      <p className="text-sm text-zinc-800">
        {line.batchNumber} · {fmt(returnable)} {line.uom} still returnable out of {fmt(line.qty)} sold.
      </p>

      <div className="mt-4 grid gap-4">
        <Field label={`Quantity coming back (${line.uom})`}>
          <input
            className="dgn-input"
            type="number"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>

        <Field label="Why is it coming back?">
          <select className="dgn-input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {Object.entries(REASON_COPY).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="What condition is it in?" hint={CONDITION_COPY[condition]}>
          <select
            className="dgn-input"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          >
            <option value="RESALEABLE">Good — can be sold again</option>
            <option value="REWORK">Damaged — recycle it</option>
            <option value="SCRAP">Unusable — write it off</option>
          </select>
        </Field>

        {condition === 'REWORK' && (
          <Field
            label="Weight for regrind (kg)"
            hint="Leave blank to work it out from the product's standard weight"
          >
            <input
              className="dgn-input"
              type="number"
              inputMode="decimal"
              value={reworkWeightKg}
              onChange={(e) => setReworkWeightKg(e.target.value)}
            />
          </Field>
        )}

        <Field
          label="Refund / credit (₦)"
          hint={`Leave blank to credit the full ${money(defaultRefund)} originally charged`}
        >
          <input
            className="dgn-input"
            type="number"
            inputMode="decimal"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder={String(defaultRefund || '')}
          />
        </Field>

        <Field label="What happened?" hint="Required — at least 5 characters">
          <textarea
            className="dgn-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        type="button"
        className="dgn-btn dgn-btn-primary mt-5 w-full"
        disabled={saving || !(amount > 0) || notes.trim().length < 5}
        onClick={submit}
      >
        {saving ? 'Recording…' : 'Record return'}
      </button>
    </Dialog>
  )
}
