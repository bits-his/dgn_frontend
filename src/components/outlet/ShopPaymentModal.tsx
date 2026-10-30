import { useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { Field, NairaAmountInput } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ShieldCheck, Wallet, Banknote } from 'lucide-react'

export type UnpaidOutletSale = {
  saleNumber: string
  businessDate: string | null
  totalAmount?: number
  amountPaid?: number
  balanceDue: number
  paymentStatus?: string
  saleType?: string
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

export function ShopPaymentModal({
  open,
  onOpenChange,
  buyerId,
  buyerName,
  isFactoryDistributor = false,
  distributorCode,
  totalDebt = 0,
  advanceBalance = 0,
  unpaid = [],
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  buyerId: number
  buyerName: string
  isFactoryDistributor?: boolean
  distributorCode?: string | null
  totalDebt?: number
  advanceBalance?: number
  unpaid?: UnpaidOutletSale[]
  onSuccess: () => void
}) {
  const debt = useMemo(() => {
    if (totalDebt > 0.001) return totalDebt
    return unpaid.reduce((sum, u) => sum + Number(u.balanceDue || 0), 0)
  }, [totalDebt, unpaid])

  const [amount, setAmount] = useState(debt > 0.001 ? String(debt) : '')
  const [method, setMethod] = useState<'TRANSFER' | 'CASH' | 'POS' | 'ADVANCE'>('CASH')
  const [receivedAt, setReceivedAt] = useState(lagosDateTimeLocal())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const numAmount = Number(amount) || 0
  const needsReference = method === 'TRANSFER' || method === 'POS'

  // Dynamic breakdown calculation matching company distributor modal
  const breakdown = useMemo(() => {
    if (numAmount <= 0.001) {
      return {
        mode: 'empty',
        toSales: 0,
        toAdvance: 0,
        remainingDebt: debt,
      }
    }
    if (debt <= 0.001) {
      return {
        mode: 'pure_advance',
        toSales: 0,
        toAdvance: numAmount,
        remainingDebt: 0,
      }
    }
    if (numAmount > debt) {
      return {
        mode: 'split',
        toSales: debt,
        toAdvance: Math.round((numAmount - debt) * 100) / 100,
        remainingDebt: 0,
      }
    }
    return {
      mode: 'repayment',
      toSales: numAmount,
      toAdvance: 0,
      remainingDebt: Math.max(0, Math.round((debt - numAmount) * 100) / 100),
    }
  }, [numAmount, debt])

  const handleSubmit = async () => {
    setError('')
    if (!(numAmount > 0)) {
      setError('Enter a payment amount greater than zero')
      return
    }
    if (method === 'ADVANCE') {
      if (numAmount > advanceBalance + 0.001) {
        setError(`Payment amount cannot exceed available advance of ${money(advanceBalance)}`)
        return
      }
      if (debt > 0.001 && numAmount > debt + 0.001) {
        setError(`When paying from advance, amount cannot exceed the stall debt of ${money(debt)}`)
        return
      }
    } else if (needsReference && !reference.trim()) {
      setError(
        method === 'POS'
          ? 'Enter the POS slip or terminal reference'
          : 'Enter the bank transfer reference',
      )
      return
    }

    setSaving(true)
    try {
      await api.post(`/outlet-sales/buyers/${buyerId}/payments`, {
        amount: numAmount,
        paymentMethod: method,
        receivedAt,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onOpenChange(false)
      onSuccess()
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-zinc-200 p-0 overflow-hidden">
        <DialogHeader className="border-b border-zinc-100 bg-zinc-50/70 p-4 pb-3">
          <DialogTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Banknote className="size-4 text-teal-700" />
            Record stall payment
          </DialogTitle>
          <p className="text-xs text-zinc-500 mt-0.5">
            Collect money from customer or distributor at this shop stall.
          </p>
        </DialogHeader>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Account Status Badge */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-zinc-500">Customer: </span>
                <strong className="text-zinc-900">{buyerName}</strong>
                {distributorCode ? (
                  <span className="ml-1 text-[11px] font-mono text-zinc-400">
                    ({distributorCode})
                  </span>
                ) : null}
                {isFactoryDistributor ? (
                  <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                    Factory Distributor
                  </span>
                ) : null}
              </div>
              <div className="text-right">
                <span className="text-zinc-500">Owes at stall: </span>
                <span
                  className={`font-bold tabular-nums ${
                    debt > 0.001 ? 'text-amber-800' : 'text-emerald-700'
                  }`}
                >
                  {debt > 0.001 ? money(debt) : '₦0'}
                </span>
              </div>
            </div>

            {advanceBalance > 0.001 ? (
              <div className="flex items-center justify-between border-t border-zinc-200/80 pt-1.5 text-[11px]">
                <span className="text-zinc-500 flex items-center gap-1">
                  <Wallet className="size-3 text-sky-600" />
                  Advance held:
                </span>
                <span className="font-semibold text-sky-700 tabular-nums">
                  {money(advanceBalance)}
                </span>
              </div>
            ) : null}

            {isFactoryDistributor ? (
              <p className="text-[10px] text-zinc-500 leading-tight">
                Settles open sales at this stall. Any advance and debt reduction also post to their main company ledger.
              </p>
            ) : null}
          </div>

          {/* Amount Input */}
          <div>
            <Field label="Amount to collect (₦)">
              <NairaAmountInput
                value={amount}
                onChange={(val) => setAmount(val)}
                placeholder="0"
              />
            </Field>
            {debt > 0.001 ? (
              <div className="mt-1 flex items-center gap-3 text-[11px] flex-wrap">
                <button
                  type="button"
                  onClick={() => setAmount(String(debt))}
                  className="font-medium text-teal-700 hover:text-teal-800 underline"
                >
                  Pay full debt ({money(debt)})
                </button>
                {advanceBalance > 0.001 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMethod('ADVANCE')
                      setAmount(String(Math.min(advanceBalance, debt)))
                    }}
                    className="font-medium text-sky-700 hover:text-sky-800 underline"
                  >
                    Pay from advance ({money(Math.min(advanceBalance, debt))})
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {/* Dynamic Allocation Preview Box */}
          {method === 'ADVANCE' && numAmount > 0.001 ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-xs space-y-1.5 text-sky-950">
              <div className="font-semibold flex items-center gap-1.5 text-sky-900">
                <Wallet className="size-3.5 text-sky-600" />
                Paid from Advance Wallet
              </div>
              <p className="text-[11px] leading-relaxed text-sky-800">
                <strong>{money(numAmount)}</strong> will be deducted from the customer's available advance wallet (available: {money(advanceBalance)}) to settle open sales at this stall.
              </p>
            </div>
          ) : breakdown.mode !== 'empty' && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-xs space-y-1.5 text-teal-950">
              <div className="font-semibold flex items-center gap-1.5 text-teal-900">
                <CheckCircle2 className="size-3.5 text-teal-600" />
                Payment Breakdown
              </div>
              {breakdown.mode === 'pure_advance' && (
                <p className="text-[11px] leading-relaxed text-teal-800">
                  Customer owes nothing at this shop. The entire{' '}
                  <strong>{money(breakdown.toAdvance)}</strong> will be credited to their{' '}
                  <strong>Advance Wallet</strong> for future shop purchases.
                </p>
              )}
              {breakdown.mode === 'repayment' && (
                <p className="text-[11px] leading-relaxed text-teal-800">
                  <strong>{money(breakdown.toSales)}</strong> will clear open sales at this stall (oldest first).{' '}
                  {breakdown.remainingDebt > 0 ? (
                    <>Remaining debt: <strong>{money(breakdown.remainingDebt)}</strong>.</>
                  ) : (
                    'All stall sales fully settled!'
                  )}
                </p>
              )}
              {breakdown.mode === 'split' && (
                <p className="text-[11px] leading-relaxed text-teal-800">
                  <strong>{money(breakdown.toSales)}</strong> clears all open sales at this shop in full.{' '}
                  The excess <strong>{money(breakdown.toAdvance)}</strong> goes directly to their{' '}
                  <strong>Advance Wallet</strong>.
                </p>
              )}
            </div>
          )}

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 mb-1.5 block">
              Payment method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  ['CASH', 'Cash'],
                  ['TRANSFER', 'Transfer'],
                  ['POS', 'POS Terminal'],
                  ...(advanceBalance > 0.001 ? [['ADVANCE', 'Advance Wallet'] as const] : []),
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                    method === m
                      ? 'border-teal-600 bg-teal-50/80 text-teal-900 ring-2 ring-teal-500/20'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              {method === 'ADVANCE'
                ? 'Deducted from customer’s advance balance. Does not count as physical cash with stall staff.'
                : 'Money collected is held by you at the stall until you transfer it to the company.'}
            </p>
          </div>

          {/* Date & Reference */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-zinc-700 mb-1 block">Date & Time</label>
              <input
                type="datetime-local"
                className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-700 mb-1 block">
                {method === 'POS'
                  ? 'POS Ref / Terminal *'
                  : method === 'TRANSFER'
                    ? 'Transfer Reference *'
                    : 'Reference (optional)'}
              </label>
              <input
                type="text"
                className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder={
                  method === 'POS'
                    ? 'e.g. STANBIC-9823'
                    : method === 'TRANSFER'
                      ? 'e.g. GTB-TRF-00129'
                      : 'Receipt / cash ref'
                }
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 mb-1 block">
              Notes (optional)
            </label>
            <input
              type="text"
              className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="e.g. Paid by cashier at stall"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-teal-700 hover:bg-teal-800 text-white font-semibold gap-1.5"
              onClick={handleSubmit}
              disabled={saving || !(numAmount > 0)}
            >
              <ShieldCheck className="size-3.5" />
              {saving ? 'Recording payment…' : `Collect ${numAmount > 0 ? money(numAmount) : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

