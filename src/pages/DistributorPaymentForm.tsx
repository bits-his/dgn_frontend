import { useState } from 'react'
import { api } from '@/lib/api'
import { Field, NairaAmountInput } from '@/components/ui'

export type UnpaidInvoice = {
  saleNumber: string
  businessDate: string | null
  totalAmount?: number
  amountPaid?: number
  balanceDue: number
  paymentStatus?: string
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
  unpaid,
  onSaved,
}: {
  unpaid: UnpaidInvoice[]
  onSaved: () => void
}) {
  const [saleNumber, setSaleNumber] = useState(unpaid[0]?.saleNumber || '')
  const selected = unpaid.find((row) => row.saleNumber === saleNumber) || unpaid[0]
  const [amount, setAmount] = useState(String(selected?.balanceDue ?? ''))
  const [method, setMethod] = useState('CASH')
  const [receivedAt, setReceivedAt] = useState(lagosDateTimeLocal())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const pickSale = (next: string) => {
    setSaleNumber(next)
    const found = unpaid.find((row) => row.saleNumber === next)
    setAmount(String(found?.balanceDue ?? ''))
    setError('')
  }

  const needsReference = method === 'TRANSFER' || method === 'POS'

  const submit = async () => {
    if (!selected) return
    setError('')
    if (needsReference && !reference.trim()) {
      setError(
        method === 'POS'
          ? 'Enter the POS slip or terminal reference'
          : 'Enter the transfer reference',
      )
      return
    }
    setSaving(true)
    try {
      await api.post(`/sales/${selected.saleNumber}/payments`, {
        amount: Number(amount),
        paymentMethod: method,
        receivedAt,
        reference: reference.trim() || undefined,
        notes,
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

  if (!unpaid.length) {
    return <p className="text-sm text-zinc-800">Nothing outstanding on this distributor.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-800">
        {money(selected.balanceDue)} outstanding on {selected.saleNumber}.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {unpaid.length > 1 && (
          <div className="sm:col-span-2">
            <Field label="Invoice">
              <select
                className="dgn-input"
                value={selected.saleNumber}
                onChange={(e) => pickSale(e.target.value)}
              >
                {unpaid.map((row) => (
                  <option key={row.saleNumber} value={row.saleNumber}>
                    {row.saleNumber} · {money(row.balanceDue)} due
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="How they paid">
          <select className="dgn-input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="TRANSFER">Bank transfer</option>
            <option value="POS">POS</option>
          </select>
        </Field>
        <Field label="When received" hint="Africa/Lagos">
          <input
            className="dgn-input"
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </Field>
        <Field label="Amount received">
          <NairaAmountInput
            value={amount}
            onChange={setAmount}
            placeholder="0"
          />
        </Field>
        {needsReference ? (
          <Field
            label={method === 'POS' ? 'POS slip / terminal ref' : 'Transfer reference'}
            hint={method === 'POS' ? 'RRN, receipt number, or terminal ID' : 'Bank name and reference'}
          >
            <input
              className="dgn-input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={method === 'POS' ? 'POS-8831' : 'GTBank / 9921…'}
            />
          </Field>
        ) : (
          <Field label="Received from" hint="Who brought the cash">
            <input
              className="dgn-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Driver, contact person…"
            />
          </Field>
        )}
        {needsReference && (
          <div className="sm:col-span-2">
            <Field label="Note">
              <input
                className="dgn-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Who paid, extra detail…"
              />
            </Field>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="button"
        className="dgn-btn dgn-btn-primary"
        disabled={saving || !(Number(amount) > 0)}
        onClick={submit}
      >
        {saving ? 'Saving…' : 'Save payment'}
      </button>
    </div>
  )
}
