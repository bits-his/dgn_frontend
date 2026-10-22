import { useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { Field, NairaAmountInput } from '@/components/ui'
import { CheckCircle2, ShieldCheck, Wallet } from 'lucide-react'

export type UnpaidInvoice = {
  saleNumber: string
  businessDate: string | null
  totalAmount?: number
  amountPaid?: number
  balanceDue: number
  paymentStatus?: string
  saleType?: string
  isOpening?: boolean
  ageDays?: number
  overdue?: boolean
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function lagosDateTimeLocal(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function DistributorPaymentForm({
  distributorIdOrCode,
  distributorName,
  totalOutstanding = 0,
  unpaid = [],
  onSaved,
}: {
  distributorIdOrCode: string | number
  distributorName?: string
  totalOutstanding?: number
  unpaid?: UnpaidInvoice[]
  onSaved: () => void
}) {
  const totalDebt = useMemo(() => {
    if (totalOutstanding > 0.001) return totalOutstanding
    return unpaid.reduce((sum, u) => sum + Number(u.balanceDue || 0), 0)
  }, [totalOutstanding, unpaid])

  const [amount, setAmount] = useState(totalDebt > 0.001 ? String(totalDebt) : '')
  const [method, setMethod] = useState<'TRANSFER' | 'CASH' | 'POS'>('TRANSFER')
  const [receivedAt, setReceivedAt] = useState(lagosDateTimeLocal())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const numAmount = Number(amount) || 0
  const needsReference = method === 'TRANSFER' || method === 'POS'

  // Dynamic breakdown calculation
  const breakdown = useMemo(() => {
    if (numAmount <= 0.001) {
      return {
        mode: 'empty',
        toInvoices: 0,
        toAdvance: 0,
        remainingDebt: totalDebt,
      }
    }
    if (totalDebt <= 0.001) {
      return {
        mode: 'pure_advance',
        toInvoices: 0,
        toAdvance: numAmount,
        remainingDebt: 0,
      }
    }
    if (numAmount > totalDebt) {
      return {
        mode: 'split',
        toInvoices: totalDebt,
        toAdvance: Math.round((numAmount - totalDebt) * 100) / 100,
        remainingDebt: 0,
      }
    }
    return {
      mode: 'repayment',
      toInvoices: numAmount,
      toAdvance: 0,
      remainingDebt: Math.max(0, Math.round((totalDebt - numAmount) * 100) / 100),
    }
  }, [numAmount, totalDebt])

  const submit = async () => {
    setError('')
    if (!(numAmount > 0)) {
      setError('Enter a payment amount greater than zero')
      return
    }
    if (needsReference && !reference.trim()) {
      setError(
        method === 'POS'
          ? 'Enter the POS slip or terminal reference'
          : 'Enter the bank transfer reference',
      )
      return
    }

    setSaving(true)
    try {
      await api.post(`/distributors/${distributorIdOrCode}/payments`, {
        amount: numAmount,
        paymentMethod: method,
        receivedAt,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onSaved()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: { err?: string; errors?: Record<string, string> } } })
        .response?.data
      setError(
        (body?.errors && Object.values(body.errors).join(' · ')) ||
          body?.err ||
          'Could not record the payment',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top status info */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 text-xs">
        <div>
          <span className="text-zinc-500">Distributor: </span>
          <strong className="text-zinc-900">{distributorName || 'Distributor'}</strong>
        </div>
        <div>
          <span className="text-zinc-500">Current Debt: </span>
          <span
            className={`font-bold tabular-nums ${
              totalDebt > 0.001 ? 'text-amber-800' : 'text-emerald-700'
            }`}
          >
            {totalDebt > 0.001 ? money(totalDebt) : '₦0 (No debt)'}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount received">
          <div className="space-y-1.5">
            <NairaAmountInput
              value={amount}
              onChange={setAmount}
              placeholder="0"
            />
            {totalDebt > 0.001 && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setAmount(String(totalDebt))}
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  Pay full debt ({money(totalDebt)})
                </button>
              </div>
            )}
          </div>
        </Field>

        <Field label="Payment method">
          <select
            className="dgn-input font-medium"
            value={method}
            onChange={(e) => setMethod(e.target.value as 'TRANSFER' | 'CASH' | 'POS')}
          >
            <option value="TRANSFER">Bank transfer (Default)</option>
            <option value="CASH">Cash</option>
            <option value="POS">POS</option>
          </select>
        </Field>

        <Field label="When received" hint="Africa/Lagos">
          <input
            className="dgn-input text-xs"
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </Field>

        {needsReference ? (
          <Field
            label={method === 'POS' ? 'POS slip / terminal ref' : 'Transfer reference'}
            hint={method === 'POS' ? 'RRN, receipt number' : 'Bank name & session ID'}
          >
            <input
              className="dgn-input text-xs"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={method === 'POS' ? 'POS-8831' : 'GTBank / 9921…'}
              required
            />
          </Field>
        ) : (
          <Field label="Received from" hint="Who brought the cash">
            <input
              className="dgn-input text-xs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Driver, representative…"
            />
          </Field>
        )}

        {needsReference && (
          <div className="sm:col-span-2">
            <Field label="Notes / Memo (optional)">
              <input
                className="dgn-input text-xs"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes…"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Dynamic Breakdown Explanation */}
      {numAmount > 0.001 && (
        <div className="rounded-xl border p-3 text-xs transition-all">
          {breakdown.mode === 'pure_advance' && (
            <div className="flex items-start gap-2 text-sky-900 bg-sky-50/70 border-sky-200 -m-3 p-3 rounded-xl">
              <Wallet className="size-4 shrink-0 text-sky-700 mt-0.5" />
              <div>
                <p className="font-semibold">Advance Deposit</p>
                <p className="mt-0.5 text-[11px] text-sky-800">
                  {distributorName || 'This distributor'} has no outstanding debt. The entire payment of{' '}
                  <strong className="font-bold">{money(numAmount)}</strong> will be credited directly to their{' '}
                  <strong>advance balance</strong> and automatically applied to future sales.
                </p>
              </div>
            </div>
          )}

          {breakdown.mode === 'split' && (
            <div className="flex items-start gap-2 text-emerald-950 bg-emerald-50/80 border-emerald-200 -m-3 p-3 rounded-xl">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-700 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900">Debt Repayment + Advance Deposit</p>
                <p className="mt-0.5 text-[11px] text-emerald-800">
                  <strong className="font-bold">{money(breakdown.toInvoices)}</strong> will fully settle all unpaid invoices, and the surplus{' '}
                  <strong className="font-bold text-sky-800">{money(breakdown.toAdvance)}</strong> will be saved as{' '}
                  <strong>advance deposit</strong> for future orders.
                </p>
              </div>
            </div>
          )}

          {breakdown.mode === 'repayment' && (
            <div className="flex items-start gap-2 text-amber-950 bg-amber-50/80 border-amber-200 -m-3 p-3 rounded-xl">
              <ShieldCheck className="size-4 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Invoice Repayment</p>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  <strong className="font-bold">{money(breakdown.toInvoices)}</strong> will pay down open invoices (oldest first).{' '}
                  {breakdown.remainingDebt > 0.001 ? (
                    <span>
                      Remaining outstanding balance will be{' '}
                      <strong className="font-bold">{money(breakdown.remainingDebt)}</strong>.
                    </span>
                  ) : (
                    <span>All open invoices will be cleared in full!</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs font-medium text-red-700 bg-red-50 p-2 rounded">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          className="dgn-btn dgn-btn-primary"
          disabled={saving || !(numAmount > 0)}
          onClick={submit}
        >
          {saving ? 'Recording payment…' : `Confirm Payment of ${money(numAmount)}`}
        </button>
      </div>
    </div>
  )
}
