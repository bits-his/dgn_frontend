import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { NairaAmountInput } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Banknote,
  Send,
  CheckCircle2,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type OutletRemittanceRow = {
  id: number
  amount: number
  bankAccountId: number
  bankAccount?: {
    id: number
    name: string
    bankName?: string
    accountName?: string
    accountNumber?: string
  } | null
  reference: string
  businessDate: string | null
  notes?: string | null
  createdAt?: string
  createdBy?: string | null
}

export type OutletMoneySummary = {
  collected: number
  sent: number
  stillWithMe: number
  remittances: OutletRemittanceRow[]
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function lagosDateLocal() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function ShopMoneyWithMeCard({
  outletId,
  data: dataProp,
  canTransfer = true,
  isCompanyView = false,
  onRefresh,
}: {
  outletId: number
  data?: OutletMoneySummary
  canTransfer?: boolean
  isCompanyView?: boolean
  onRefresh?: () => void
}) {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [reference, setReference] = useState('')
  const [businessDate, setBusinessDate] = useState(lagosDateLocal())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Self-fetch money summary when no data prop is passed (e.g. from Book page)
  const selfQuery = useQuery({
    queryKey: ['outlet-remittances', outletId],
    enabled: !dataProp && outletId > 0,
    queryFn: async () => {
      const { data } = await api.get('/outlet-sales/remittances', {
        params: outletId ? { outletId } : {},
      })
      return data.data as OutletMoneySummary
    },
    refetchInterval: 30_000,
  })

  const data = dataProp ?? selfQuery.data

  // Bank accounts query
  const bankAccountsQuery = useQuery({
    queryKey: ['bank-accounts'],
    enabled: modalOpen,
    queryFn: async () => {
      const { data } = await api.get('/bank-accounts')
      return (data.data || []) as Array<{
        id: number
        name: string
        bankName?: string
        accountName?: string
        accountNumber?: string
        isActive?: boolean
      }>
    },
  })

  const activeAccounts = (bankAccountsQuery.data || []).filter((a) => a.isActive !== false)

  const collected = Number(data?.collected || 0)
  const sent = Number(data?.sent || 0)
  const stillWithMe = Number(data?.stillWithMe || 0)
  const pastRemittances = data?.remittances || []

  const transferMutation = useMutation({
    mutationFn: async () => {
      setError('')
      const numAmount = Number(amount)
      if (!(numAmount > 0)) throw new Error('Enter an amount to transfer')
      if (numAmount > stillWithMe + 0.001) {
        throw new Error(`Amount cannot exceed ${money(stillWithMe)} (Still with you)`)
      }
      if (!bankAccountId) throw new Error('Select the company bank account')

      const { data } = await api.post('/outlet-sales/remittances', {
        outletCustomerId: outletId,
        amount: numAmount,
        bankAccountId: Number(bankAccountId),
        reference: reference.trim() || undefined,
        businessDate,
        notes: notes.trim() || undefined,
      })
      return data
    },
    onSuccess: async (res) => {
      setSuccessMsg(res?.message || 'Transfer recorded successfully')
      setModalOpen(false)
      setAmount('')
      setBankAccountId('')
      setReference('')
      setNotes('')
      await qc.invalidateQueries({ queryKey: ['outlet-overview'] })
      await qc.invalidateQueries({ queryKey: ['outlet-remittances'] })
      if (onRefresh) onRefresh()
    },
    onError: (err: unknown) => {
      const body = (err as { response?: { data?: { err?: string; errors?: Record<string, string> } } })
        .response?.data
      setError(
        (body?.errors && Object.values(body.errors).join(' · ')) ||
          body?.err ||
          (err as Error).message ||
          'Could not record remittance',
      )
    },
  })

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-gradient-to-br from-teal-50/70 via-white to-zinc-50 px-3.5 py-3 sm:px-4">
        <div>
          <div className="flex items-center gap-1.5">
            <Banknote className="size-4 text-teal-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              {isCompanyView ? 'Money with stall' : 'Money with me'}
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {isCompanyView
              ? 'Cash and transfers collected at this shop before sending to company bank.'
              : 'Physical cash & transfers collected here before sending to the company bank.'}
          </p>
        </div>

        {canTransfer && stillWithMe > 0.001 ? (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs"
            onClick={() => {
              setError('')
              setAmount(String(stillWithMe))
              setModalOpen(true)
            }}
          >
            <Send className="size-3.5" />
            Record transfer to company
          </Button>
        ) : null}
      </div>

      {successMsg ? (
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-[11px] text-emerald-600 hover:text-emerald-900 underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Collected at stall
          </p>
          <p className="mt-1 text-base sm:text-lg font-bold tabular-nums text-zinc-900">
            {money(collected)}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400">Total physical money received</p>
        </div>

        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Already sent to company
          </p>
          <p className="mt-1 text-base sm:text-lg font-bold tabular-nums text-teal-800">
            {money(sent)}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400">Transferred to company accounts</p>
        </div>

        <div className="px-4 py-3 bg-zinc-50/40">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            {isCompanyView ? 'Still with stall' : 'Still with me'}
          </p>
          <p
            className={cn(
              'mt-1 text-base sm:text-lg font-black tabular-nums',
              stillWithMe > 0.001 ? 'text-amber-800' : 'text-emerald-700',
            )}
          >
            {money(stillWithMe)}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            {stillWithMe > 0.001 ? 'Collected minus sent' : 'All funds remitted'}
          </p>
        </div>
      </div>

      {/* List of past transfers */}
      <div className="border-t border-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/60 px-3.5 py-2 sm:px-4">
          <span className="text-[11px] font-semibold text-zinc-700 flex items-center gap-1.5">
            <History className="size-3 text-zinc-400" />
            Transfers sent to company ({pastRemittances.length})
          </span>
          <span className="text-[10px] text-zinc-400">Oldest to newest ledger</span>
        </div>

        {!pastRemittances.length ? (
          <p className="px-4 py-4 text-center text-xs text-zinc-400">
            No transfers to company recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 max-h-60 overflow-y-auto">
            {pastRemittances.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs sm:px-4 hover:bg-zinc-50/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 tabular-nums">
                      {money(row.amount)}
                    </span>
                    <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-medium text-teal-800">
                      {row.bankAccount ? row.bankAccount.name : 'Company Bank'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                    {row.reference ? (
                      <span className="font-mono text-zinc-400">Ref: {row.reference}</span>
                    ) : null}
                    {row.bankAccount?.accountNumber ? (
                      <span>· Acct: {row.bankAccount.accountNumber}</span>
                    ) : null}
                    {row.notes ? <span>· {row.notes}</span> : null}
                  </div>
                </div>

                <div className="shrink-0 text-right text-[11px] text-zinc-400">
                  <span className="block font-medium text-zinc-600">
                    {row.businessDate || '—'}
                  </span>
                  {row.createdBy ? (
                    <span className="text-[10px] text-zinc-400">By {row.createdBy}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Transfer to Company Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-zinc-200 p-0 overflow-hidden">
          <DialogHeader className="border-b border-zinc-100 bg-zinc-50/70 p-4 pb-3">
            <DialogTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Send className="size-4 text-teal-700" />
              Record transfer to company
            </DialogTitle>
            <p className="text-xs text-zinc-500 mt-0.5">
              Moves money off your stall book and onto the company bank account.
            </p>
          </DialogHeader>

          <div className="p-4 space-y-3.5">
            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-zinc-700">Amount to send (₦)</label>
                <span className="text-[11px] text-zinc-500">
                  Still with you:{' '}
                  <strong className="text-zinc-900 tabular-nums">{money(stillWithMe)}</strong>
                </span>
              </div>
              <NairaAmountInput
                value={amount}
                onChange={(val) => setAmount(val)}
                placeholder="0"
              />
              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setAmount(String(stillWithMe))}
                  className="text-[11px] font-medium text-teal-700 hover:text-teal-800 underline"
                >
                  Send full balance ({money(stillWithMe)})
                </button>
              </div>
            </div>

            {/* Bank Account Selector */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 mb-1 block">
                Company bank account *
              </label>
              <select
                className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                <option value="">Select bank account…</option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.bankName ? `(${a.bankName})` : ''}{' '}
                    {a.accountNumber ? `— ${a.accountNumber}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Reference */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700 mb-1 block">Date *</label>
                <input
                  type="date"
                  className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 mb-1 block">
                  Transfer reference <span className="font-normal text-zinc-400">(optional)</span>
                </label>
                <input
                  type="text"
                  className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="Optional (e.g. GTB-TRF-49821)"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 mb-1 block">
                Note (optional)
              </label>
              <input
                type="text"
                className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                placeholder="e.g. End of day remittance to main bank"
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
                onClick={() => setModalOpen(false)}
                disabled={transferMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-teal-700 hover:bg-teal-800 text-white font-semibold gap-1.5"
                onClick={() => transferMutation.mutate()}
                disabled={transferMutation.isPending || !(Number(amount) > 0)}
              >
                <CheckCircle2 className="size-3.5" />
                {transferMutation.isPending ? 'Sending…' : 'Record transfer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

