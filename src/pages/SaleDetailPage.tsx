import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Banknote, RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

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
  customer: { id: number; name: string; phone: string | null } | null
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
  soldBy: string | null
  lines: SaleLine[]
  returns: SaleReturnRow[]
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
  }

  if (sale.isLoading) {
    return <p className="text-sm text-[var(--ink-muted)]">Loading dispatch note…</p>
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

  return (
    <div>
      <PageHeader
        eyebrow="Dispatch note"
        title={s.saleNumber}
        description={`${s.customer?.name ?? 'Unknown customer'} · ${s.saleType.toLowerCase()} · ${s.status.replace('_', ' ').toLowerCase()}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="dgn-btn dgn-btn-ghost" to="/sales">
              <ArrowLeft className="h-4 w-4" /> All sales
            </Link>
            {canSell && s.balanceDue > 0 && (
              <button className="dgn-btn dgn-btn-primary" onClick={() => setPayOpen(true)}>
                <Banknote className="h-4 w-4" /> Record payment
              </button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatPill label="Customer pays" value={money(s.totalAmount)} tone="accent" />
        <StatPill label="Cost of goods" value={money(s.totalCost)} />
        <StatPill
          label="Gross margin"
          value={`${money(s.grossMargin)} · ${s.grossMarginPercent}%`}
          tone={s.grossMargin > 0 ? 'success' : 'danger'}
        />
        <StatPill
          label={s.balanceDue > 0 ? 'Balance owed' : 'Payment'}
          value={s.balanceDue > 0 ? money(s.balanceDue) : s.paymentStatus}
          tone={s.balanceDue > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold">Batches dispatched</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Each line is tied to the exact batch that left the factory, so the margin below is
              measured against what that batch really cost to make.
            </p>
            <div className="mt-4 space-y-3">
              {s.lines.map((line) => {
                const returnable = line.qty - line.qtyReturned
                return (
                  <div
                    key={line.id}
                    className="rounded-2xl border border-[var(--line)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        {line.batchNumber ? (
                          <Link
                            to={`/batches/${line.batchNumber}`}
                            className="font-mono text-sm font-semibold text-[var(--accent-strong)] hover:underline"
                          >
                            {line.batchNumber}
                          </Link>
                        ) : (
                          <span className="font-mono text-sm">—</span>
                        )}
                        <p className="text-xs text-[var(--ink-faint)]">{line.productName}</p>
                      </div>
                      {canSell && returnable > 0.001 && (
                        <button
                          className="dgn-btn dgn-btn-secondary"
                          onClick={() => setReturningLine(line)}
                        >
                          <RotateCcw className="h-4 w-4" /> Take a return
                        </button>
                      )}
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
                      <Fact
                        label="Sold"
                        value={`${fmt(line.qty)} ${line.uom} @ ${money(line.unitPrice)}`}
                      />
                      <Fact label="Line value" value={money(line.lineTotal)} />
                      <Fact
                        label="Cost"
                        value={`${money(line.lineCost)} (${money(line.unitCost)}/unit)`}
                      />
                      <Fact
                        label="Margin"
                        value={`${money(line.lineMargin)} · ${line.lineMarginPercent}%`}
                        tone={line.lineMargin > 0 ? 'good' : 'bad'}
                      />
                    </div>
                    {line.qtyReturned > 0 && (
                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        {fmt(line.qtyReturned)} {line.uom} came back from the customer.
                        {returnable > 0.001
                          ? ` ${fmt(returnable)} ${line.uom} still returnable.`
                          : ' This line is fully returned.'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {s.returns.length > 0 && (
            <Card>
              <h2 className="text-base font-semibold">Returns from this customer</h2>
              <div className="mt-4 space-y-3">
                {s.returns.map((ret) => (
                  <div key={ret.id} className="rounded-2xl border border-[var(--line)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-sm font-semibold">{ret.returnNumber}</p>
                      <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-semibold">
                        {ret.condition}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">
                      {fmt(ret.qty)} {ret.uom} of{' '}
                      {ret.batchNumber && (
                        <Link
                          to={`/batches/${ret.batchNumber}`}
                          className="font-mono text-xs text-[var(--accent-strong)] hover:underline"
                        >
                          {ret.batchNumber}
                        </Link>
                      )}{' '}
                      — {REASON_COPY[ret.reason] ?? ret.reason}. Refunded {money(ret.refundAmount)}.
                    </p>
                    <p className="mt-1 text-xs text-[var(--ink-faint)]">
                      {CONDITION_COPY[ret.condition]}
                    </p>
                    {ret.reworkBatchNumber && (
                      <p className="mt-2 text-xs">
                        Regrind batch created:{' '}
                        <Link
                          to={`/batches/${ret.reworkBatchNumber}`}
                          className="font-mono font-semibold text-[var(--accent-strong)] hover:underline"
                        >
                          {ret.reworkBatchNumber}
                        </Link>
                      </p>
                    )}
                    {ret.notes && (
                      <p className="mt-2 text-xs text-[var(--ink-muted)]">{ret.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold">Money</h2>
            <div className="mt-4 space-y-2 text-sm">
              <Row label="Goods value" value={money(s.subtotal)} />
              <Row label="Discount" value={`− ${money(s.discount)}`} />
              <Row label="Transport charged" value={`+ ${money(s.transportCharge)}`} />
              <div className="border-t border-[var(--line)] pt-2">
                <Row label="Total" value={money(s.totalAmount)} strong />
              </div>
              <Row label="Paid" value={money(s.amountPaid)} />
              <Row
                label="Balance"
                value={money(s.balanceDue)}
                tone={s.balanceDue > 0 ? 'bad' : 'good'}
                strong
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold">Transport</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Fact label="Vehicle" value={s.vehicleNumber || '—'} />
              <Fact
                label="Driver"
                value={
                  s.driverName
                    ? `${s.driverName}${s.driverPhone ? ` · ${s.driverPhone}` : ''}`
                    : '—'
                }
              />
              <Fact label="Destination" value={s.destination || '—'} />
              <Fact
                label="Dispatched"
                value={s.dispatchedAt ? new Date(s.dispatchedAt).toLocaleString() : '—'}
              />
              <Fact label="Recorded by" value={s.soldBy || '—'} />
            </div>
            {s.notes && (
              <p className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm text-[var(--ink-muted)]">
                {s.notes}
              </p>
            )}
          </Card>
        </div>
      </div>

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
        <PaymentDialog
          saleNumber={s.saleNumber}
          balanceDue={s.balanceDue}
          onClose={() => setPayOpen(false)}
          onSaved={() => {
            setPayOpen(false)
            refresh()
          }}
        />
      )}
    </div>
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
        {label}
      </p>
      <p
        className={
          'mt-0.5 font-medium ' +
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
      <span className="text-[var(--ink-muted)]">{label}</span>
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
      <div className="dgn-card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-lg sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="dgn-btn dgn-btn-ghost" onClick={onClose}>
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
      <p className="text-sm text-[var(--ink-muted)]">
        {line.batchNumber} · {fmt(returnable)} {line.uom} still returnable out of{' '}
        {fmt(line.qty)} sold.
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
          <select
            className="dgn-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
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
        className="dgn-btn dgn-btn-primary mt-5 w-full"
        disabled={saving || !(amount > 0) || notes.trim().length < 5}
        onClick={submit}
      >
        {saving ? 'Recording…' : 'Record return'}
      </button>
    </Dialog>
  )
}

function PaymentDialog({
  saleNumber,
  balanceDue,
  onClose,
  onSaved,
}: {
  saleNumber: string
  balanceDue: number
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(String(balanceDue))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      await api.post(`/sales/${saleNumber}/payments`, {
        amount: Number(amount),
        notes,
      })
      onSaved()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not record the payment'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog title="Record payment" onClose={onClose}>
      <p className="text-sm text-[var(--ink-muted)]">
        {money(balanceDue)} is outstanding on {saleNumber}.
      </p>
      <div className="mt-4 grid gap-4">
        <Field label="Amount received (₦)">
          <input
            className="dgn-input"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Note" hint="Cash, transfer reference, who paid">
          <input
            className="dgn-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button
        className="dgn-btn dgn-btn-primary mt-5 w-full"
        disabled={saving || !(Number(amount) > 0)}
        onClick={submit}
      >
        {saving ? 'Saving…' : 'Save payment'}
      </button>
    </Dialog>
  )
}
