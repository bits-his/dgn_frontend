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
import { dozenPriceFromUnit, isPieceUom, perDozenOf, qtyDozenLabel } from '@/lib/units'

type SaleLine = {
  id: number
  batchNumber: string | null
  productName: string | null
  qty: number
  qtyReturned: number
  uom: string
  unitPrice: number
  unitsPerDozen?: number | null
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
  const saleType = String(s.saleType || '').toUpperCase()
  const isTransfer = saleType === 'SHOP_TRANSFER' || saleType === 'TRANSFER'
  const unpaid = !isTransfer && s.balanceDue > 0.001
  const payments = s.payments || []
  const customerIsDistributor =
    s.customer?.customerType === 'DISTRIBUTOR' && Boolean(s.customer.code)
  const typeLabel = isTransfer
    ? 'Shop transfer'
    : saleType === 'CASH'
      ? 'Cash sale'
      : saleType === 'CREDIT'
        ? 'Credit sale'
        : saleType === 'OPENING_BALANCE'
          ? 'Opening balance'
          : s.saleType

  return (
    <PageLayout
      title={s.saleNumber}
      description={`${s.customer?.name || 'Customer'} · ${typeLabel}`}
      back={true}
      backTo="/sales"
      backLabel="Back"
      actions={
        !isTransfer ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
              asChild
            >
              <Link
                to={`/sales/${s.saleNumber}/invoice`}
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Printer className="size-3.5 shrink-0" />
                <span>Invoice</span>
              </Link>
            </Button>
            {s.amountPaid > 0.001 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
                asChild
              >
                <Link
                  to={`/sales/${s.saleNumber}/receipt`}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Printer className="size-3.5 shrink-0" />
                  <span>Receipt</span>
                </Link>
              </Button>
            )}
          </div>
        ) : null
      }
    >
      <div className="space-y-2.5">
        <Card className="!p-3 sm:!p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium text-zinc-500">{typeLabel}</p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                {s.customer?.name || '—'}
              </p>
              {s.customer?.code ? (
                <Link
                  to={`/distributors/${s.customer.code}`}
                  className="mt-0.5 inline-block text-[11px] font-semibold text-[var(--accent-strong)] hover:underline"
                >
                  {isTransfer ? 'View shop' : customerIsDistributor ? 'Open ledger' : s.customer.code}
                </Link>
              ) : null}
            </div>
            <div className="text-right text-xs text-zinc-600">
              <p>{formatBusinessDate(s.businessDate)}</p>
              <p className="mt-0.5">{s.soldBy || '—'}</p>
            </div>
          </div>
          {isTransfer ? (
            <p className="mt-2.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] text-violet-800">
              Factory → shop stock issue — not a sale, no invoice or payment.
            </p>
          ) : (
            <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-2.5 sm:grid-cols-4">
              <Fact label="Total" value={money(s.totalAmount)} />
              <Fact label="Paid" value={money(s.amountPaid)} tone="good" />
              <Fact
                label="Balance"
                value={money(s.balanceDue)}
                tone={unpaid ? 'bad' : 'good'}
              />
              <Fact label="Margin" value={`${s.grossMarginPercent}%`} />
            </div>
          )}
          {s.dispatchNotes ? (
            <p className="mt-2 text-[11px] text-zinc-600">{s.dispatchNotes}</p>
          ) : null}
        </Card>

        {!isTransfer ? (
          <Card className="!p-3 sm:!p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Payments</h2>
                <p className="text-[11px] text-zinc-600">
                  {unpaid
                    ? `${money(s.balanceDue)} owed · ${money(s.amountPaid)} collected`
                    : `${money(s.amountPaid)} collected`}
                </p>
              </div>
              {canSell && unpaid ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2.5 text-[11px] font-semibold gap-1"
                  onClick={() => setPayOpen(true)}
                >
                  <CreditCard className="size-3.5" />
                  Record payment
                </Button>
              ) : null}
            </div>
            {payments.length > 0 ? (
              <div className="mt-2 divide-y divide-zinc-100">
                {payments.map((row) => (
                  <div
                    key={String(row.id)}
                    className="flex items-center justify-between gap-2 py-1.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900">
                        {methodLabel(row.paymentMethod)} · {money(row.amount)}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {formatWhen(row.receivedAt || row.recordedAt)}
                        {row.reference ? ` · ${row.reference}` : ''}
                      </p>
                    </div>
                    <Link
                      to={`/sales/${s.saleNumber}/receipt?p=${encodeURIComponent(String(row.id))}`}
                      className="shrink-0 text-[11px] font-semibold text-[var(--accent-strong)]"
                    >
                      Receipt
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-zinc-500">No payments yet.</p>
            )}
          </Card>
        ) : null}

        <Card className="!p-3 sm:!p-3.5">
          <h2 className="text-sm font-semibold">
            {isTransfer
              ? 'Stock issued'
              : saleType === 'OPENING_BALANCE'
                ? 'Opening balance'
                : 'Goods'}
          </h2>
          <p className="text-[11px] text-zinc-500">
            {s.lines.length > 0
              ? `${s.lines.length} line${s.lines.length === 1 ? '' : 's'}`
              : saleType === 'OPENING_BALANCE'
                ? 'Money balance only — no product lines'
                : 'No lines'}
          </p>
          <div className="mt-2 divide-y divide-zinc-100">
            {s.lines.length === 0 && Number(s.totalAmount) > 0.001 ? (
              <div className="flex items-start justify-between gap-2 py-1.5 text-xs">
                <p className="min-w-0 font-medium text-zinc-900">
                  {saleType === 'OPENING_BALANCE'
                    ? 'Opening receivable'
                    : 'Invoice balance'}
                </p>
                <p className="shrink-0 font-semibold tabular-nums">
                  {money(s.totalAmount)}
                </p>
              </div>
            ) : null}
            {s.lines.map((line) => {
              const returnable = line.qty - line.qtyReturned
              return (
                <div
                  key={line.id}
                  className="flex items-start justify-between gap-2 py-1.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">
                      {line.productName || '—'}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {line.batchNumber ? `${line.batchNumber} · ` : ''}
                      {qtyDozenLabel(line.qty, line.uom, line.unitsPerDozen)}
                      {!isTransfer
                        ? ` · ${
                            isPieceUom(line.uom)
                              ? `${money(
                                  dozenPriceFromUnit(
                                    line.unitPrice,
                                    perDozenOf(line.unitsPerDozen),
                                  ),
                                )}/dz`
                              : money(line.unitPrice)
                          }`
                        : ''}
                      {line.qtyReturned > 0
                        ? ` · ${qtyDozenLabel(line.qtyReturned, line.uom, line.unitsPerDozen)} returned`
                        : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {!isTransfer ? (
                      <p className="font-semibold tabular-nums">{money(line.lineTotal)}</p>
                    ) : null}
                    {canSell && !isTransfer && returnable > 0.001 ? (
                      <button
                        type="button"
                        className="mt-0.5 text-[11px] font-semibold text-[var(--accent-strong)]"
                        onClick={() => setReturningLine(line)}
                      >
                        Return
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {!isTransfer && s.returns.length > 0 ? (
          <Card className="!p-3 sm:!p-3.5">
            <h2 className="text-sm font-semibold">Returns</h2>
            <div className="mt-2 divide-y divide-zinc-100">
              {s.returns.map((ret) => (
                <div
                  key={ret.id}
                  className="flex items-start justify-between gap-2 py-1.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">
                      {REASON_COPY[ret.reason] ?? ret.reason}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {qtyDozenLabel(ret.qty, ret.uom)} · {ret.condition.toLowerCase()}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">
                    {money(ret.refundAmount)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

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
            distributorIdOrCode={s.customer?.code || s.customer?.id || ''}
            distributorName={s.customer?.name}
            totalOutstanding={s.balanceDue}
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
      <p className="text-[10px] font-medium text-zinc-500">{label}</p>
      <p
        className={
          'mt-0.5 text-sm font-semibold tabular-nums text-zinc-900 ' +
          (tone === 'good' ? 'text-teal-700' : tone === 'bad' ? 'text-red-700' : '')
        }
      >
        {value}
      </p>
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
        {line.batchNumber} · {qtyDozenLabel(returnable, line.uom, line.unitsPerDozen)} still returnable out of {qtyDozenLabel(line.qty, line.uom, line.unitsPerDozen)} sold.
      </p>

      <div className="mt-4 grid gap-4">
        <Field label={`Quantity coming back (${qtyDozenLabel(returnable, line.uom, line.unitsPerDozen)} max)`}>
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
