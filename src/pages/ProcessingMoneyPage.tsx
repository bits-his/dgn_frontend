import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  Plus,
  Undo2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { hasPermission } from '@/lib/auth'
import { formatBusinessDate, formatDate } from '@/lib/dates'
import { useAuthStore } from '@/stores/auth-store'
import { Field, NairaAmountInput } from '@/components/ui'
import { cn } from '@/lib/utils'

type WalletSummary = {
  id: number | null
  holderUserId: number | null
  holderName: string | null
  holderUsername?: string | null
  holderEmail?: string | null
  holderRole?: string | null
  given: number
  spent: number
  returned: number
  remaining: number
  status: string
}

type WalletTxn = {
  id: number
  type: 'GIVE' | 'SPEND' | 'RETURN' | string
  amount: number
  source: string
  purpose: string | null
  notes: string | null
  businessDate: string | null
  balanceAfter: number
  batchNumber: string | null
  createdByName: string
  createdAt: string
}

type HolderOption = {
  id: number
  name: string
  username?: string
  roleCode?: string
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function moneyPlain(n: number) {
  return Number(n || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function todayInputDate() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isoDate(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function defaultMonthRange() {
  const to = new Date()
  const from = new Date()
  from.setMonth(from.getMonth() - 1)
  return { from: isoDate(from), to: isoDate(to) }
}

function rangeLabel(from: string, to: string) {
  const a = formatDate(from)
  const b = formatDate(to)
  if (a === '—' && b === '—') return 'Selected dates'
  if (a === b) return a
  return `${a} – ${b}`
}

function initials(name?: string | null) {
  const parts = String(name || 'Staff')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'S'
}

function txnDateLabel(txn: WalletTxn) {
  const raw = txn.businessDate
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatDate(raw)
  if (formatBusinessDate(raw) !== '—') return formatBusinessDate(raw)
  return formatDate(txn.createdAt)
}

function txnMeta(txn: WalletTxn) {
  if (txn.type === 'GIVE') {
    return {
      title: 'Money in',
      sign: '+',
      amountClass: 'text-emerald-600',
      iconWrap: 'bg-emerald-50 text-emerald-700',
      Icon: ArrowDownLeft,
    }
  }
  if (txn.type === 'RETURN') {
    return {
      title: 'Returned',
      sign: '−',
      amountClass: 'text-sky-700',
      iconWrap: 'bg-sky-50 text-sky-700',
      Icon: Undo2,
    }
  }
  return {
    title: txn.purpose || txn.source || 'Spent',
    sign: '−',
    amountClass: 'text-red-600',
    iconWrap: 'bg-red-50 text-red-700',
    Icon: ArrowUpRight,
  }
}

function DateRangeFields({
  dateFrom,
  dateTo,
  onFromChange,
  onToChange,
}: {
  dateFrom: string
  dateTo: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-end">
      <label className="block min-w-0 sm:w-[10.75rem]">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">From</span>
        <Input type="date" className="w-full" value={dateFrom} onChange={(e) => onFromChange(e.target.value)} />
      </label>
      <label className="block min-w-0 sm:w-[10.75rem]">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">To</span>
        <Input type="date" className="w-full" value={dateTo} onChange={(e) => onToChange(e.target.value)} />
      </label>
    </div>
  )
}

function DateAmountFields({
  dateId,
  txnDate,
  amount,
  onDateChange,
  onAmountChange,
}: {
  dateId: string
  txnDate: string
  amount: string
  onDateChange: (value: string) => void
  onAmountChange: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Date">
        <Input id={dateId} type="date" value={txnDate} onChange={(e) => onDateChange(e.target.value)} />
      </Field>
      <Field label="Amount">
        <NairaAmountInput value={amount} onChange={onAmountChange} placeholder="0" />
      </Field>
    </div>
  )
}

function WalletBalanceCard({
  label,
  remaining,
  given,
  spent,
  returned,
  holderName,
  hint = 'This person can still spend',
  periodText,
}: {
  label: string
  remaining: number
  given: number
  spent: number
  returned: number
  holderName?: string | null
  hint?: string
  periodText?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-zinc-900 px-5 py-5 text-white shadow-lg">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{label}</p>
        {holderName ? (
          <p className="mt-1 truncate text-sm font-medium text-zinc-200">{holderName}</p>
        ) : null}
        <p className="mt-4 flex items-baseline gap-1.5 tracking-tight">
          <span className="text-lg font-medium text-zinc-400">₦</span>
          <span className="text-3xl font-bold tabular-nums sm:text-4xl">{moneyPlain(remaining)}</span>
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">{hint} · all time</p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Given</p>
          <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-100 sm:text-sm">{money(given)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Spent</p>
          <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-100 sm:text-sm">{money(spent)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Returned</p>
          <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-100 sm:text-sm">{money(returned)}</p>
        </div>
      </div>
      {periodText ? <p className="mt-3 text-[11px] text-zinc-500">Given and spent for {periodText}</p> : null}
    </div>
  )
}

export function ProcessingMoneyPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { userId } = useParams<{ userId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canGive = hasPermission(user, 'float.give') || user?.roleCode === 'ADMIN'
  const selectedId = userId ? Number(userId) : null
  const defaults = useMemo(() => defaultMonthRange(), [])
  const dateFrom = searchParams.get('from') || defaults.from
  const dateTo = searchParams.get('to') || defaults.to
  const periodText = rangeLabel(dateFrom, dateTo)
  const rangeQuery = `from=${dateFrom}&to=${dateTo}`

  const setRange = (next: { from?: string; to?: string }) => {
    let from = next.from ?? dateFrom
    let to = next.to ?? dateTo
    if (!from || !to) return
    if (from > to) {
      const swap = from
      from = to
      to = swap
    }
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        params.set('from', from)
        params.set('to', to)
        return params
      },
      { replace: true },
    )
  }

  const listQuery = useQuery({
    queryKey: ['processing-wallets', dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get('/processing-wallets', { params: { from: dateFrom, to: dateTo } })
      return data as {
        data: WalletSummary[]
        scope: 'all' | 'own'
        canGive: boolean
        canSpend: boolean
      }
    },
  })

  const isOwnScope = listQuery.data?.scope === 'own'
  const detailUserId = selectedId || (isOwnScope ? user?.id : null)

  const detailQuery = useQuery({
    queryKey: ['processing-wallet', detailUserId, dateFrom, dateTo],
    enabled: Boolean(detailUserId),
    queryFn: async () => {
      const path = Number(detailUserId) === Number(user?.id) ? '/processing-wallets/me' : `/processing-wallets/${detailUserId}`
      const { data } = await api.get(path, { params: { from: dateFrom, to: dateTo } })
      return data as {
        data: WalletSummary
        transactions: WalletTxn[]
        canGive: boolean
        canSpend: boolean
        hasWallet: boolean
      }
    },
  })

  const holdersQuery = useQuery({
    queryKey: ['processing-wallet-holders'],
    enabled: canGive,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data } = await api.get('/processing-wallets/holders')
      return (data.data || []) as HolderOption[]
    },
  })

  const [giveOpen, setGiveOpen] = useState(false)
  const [spendOpen, setSpendOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [giveHolderId, setGiveHolderId] = useState('')
  const [amount, setAmount] = useState('')
  const [txnDate, setTxnDate] = useState(todayInputDate)
  const [purpose, setPurpose] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [staffFilter, setStaffFilter] = useState('')

  const wallets = listQuery.data?.data || []
  const detail = detailQuery.data?.data
  const txns = detailQuery.data?.transactions || []
  const showList = !isOwnScope && !selectedId
  const canSpendHere = Boolean(detailQuery.data?.canSpend || isOwnScope)
  const canGiveHere = Boolean(detailQuery.data?.canGive || canGive)

  const filteredWallets = useMemo(() => {
    const q = staffFilter.trim().toLowerCase()
    const rows = [...wallets].sort((a, b) => Number(b.remaining || 0) - Number(a.remaining || 0))
    if (!q) return rows
    return rows.filter((row) => {
      const hay = [row.holderName, row.holderRole, row.holderUsername].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [wallets, staffFilter])

  const resetForm = () => {
    setAmount('')
    setPurpose('')
    setNotes('')
    setTxnDate(todayInputDate())
    setFormError(null)
    setBusy(false)
  }

  const openGive = () => {
    resetForm()
    setGiveHolderId(detailUserId ? String(detailUserId) : '')
    setGiveOpen(true)
    void holdersQuery.refetch()
  }

  const postMoney = async (path: string, body: Record<string, unknown>) => {
    setBusy(true)
    setFormError(null)
    try {
      await api.post(path, body)
      await queryClient.invalidateQueries({ queryKey: ['processing-wallets'] })
      await queryClient.invalidateQueries({ queryKey: ['processing-wallet'] })
      await queryClient.invalidateQueries({ queryKey: ['processing-wallet-me'] })
      await queryClient.invalidateQueries({ queryKey: ['processing-wallet-holders'] })
      setGiveOpen(false)
      setSpendOpen(false)
      setReturnOpen(false)
      resetForm()
    } catch (err: unknown) {
      const bodyRes = (err as { response?: { data?: { message?: string; err?: string } } }).response?.data
      setFormError(String(bodyRes?.message || bodyRes?.err || 'Could not save'))
    } finally {
      setBusy(false)
    }
  }

  const holderOptions = (holdersQuery.data || []).map((h) => ({
    value: String(h.id),
    label: h.name,
    sublabel: h.roleCode || h.username,
  }))

  const targetUserId =
    giveOpen && canGive ? Number(giveHolderId || detailUserId || 0) : Number(detailUserId || 0)

  const formFields = (
    dialog: 'give' | 'spend' | 'return',
  ) => (
    <div className="space-y-3">
      <DateAmountFields
        dateId={`${dialog}-date`}
        txnDate={txnDate}
        amount={amount}
        onDateChange={setTxnDate}
        onAmountChange={setAmount}
      />
      {dialog === 'give' && (
        <div>
          <span className="dgn-label">Staff member</span>
          <SearchableSelect
            value={giveHolderId}
            onChange={setGiveHolderId}
            options={holderOptions}
            placeholder="Choose who receives the money"
            searchPlaceholder="Search staff"
            emptyMessage="No staff found"
            portal
          />
        </div>
      )}
      {dialog === 'spend' && (
        <Field label="What was it for">
          <Input
            id="spend-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Transport, casual labour…"
          />
        </Field>
      )}
      <Field label="Note">
        <Textarea id={`${dialog}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
    </div>
  )

  return (
    <PageLayout
      bare
      title={showList ? 'Wallets' : detail?.holderName || 'Wallet'}
      description={null}
      back={Boolean(selectedId) && !isOwnScope}
      backTo={`/wallet?${rangeQuery}`}
      actions={
        showList && canGive ? (
          <Button type="button" size="sm" onClick={openGive}>
            <Plus className="size-3.5" />
            Give money
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <DateRangeFields
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFromChange={(from) => setRange({ from })}
          onToChange={(to) => setRange({ to })}
        />
        {showList && (
          <Input
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            placeholder="Search people"
            className="w-full sm:max-w-[220px]"
          />
        )}
      </div>

      {showList ? (
        <div className="w-full space-y-4 pb-6">
          {listQuery.isLoading ? (
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-xs text-zinc-400">
              Loading wallets…
            </div>
          ) : filteredWallets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-xs text-zinc-400">
              No wallets yet. Give money to a person to open theirs.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredWallets.map((row, idx) => (
                <button
                  key={row.holderUserId || idx}
                  type="button"
                  onClick={() => {
                    if (row.holderUserId) navigate(`/wallet/${row.holderUserId}?${rangeQuery}`)
                  }}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-xs transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white">
                      {initials(row.holderName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900">{row.holderName || 'Staff'}</p>
                      <p className="truncate text-[11px] text-zinc-400">
                        {row.holderRole || row.holderUsername || 'Staff'}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-zinc-300" />
                  </div>
                  <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Available · all time
                  </p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
                    {money(row.remaining)}
                  </p>
                  <p className="mt-3 text-[11px] text-zinc-500">
                    Given <span className="tabular-nums font-medium text-zinc-700">{money(row.given)}</span>
                    {' · '}
                    Spent <span className="tabular-nums font-medium text-zinc-700">{money(row.spent)}</span>
                    {` for ${periodText}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full space-y-4 pb-6 lg:grid lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
          <div className="space-y-3 lg:sticky lg:top-3">
            <WalletBalanceCard
              label="Available"
              holderName={detail?.holderName}
              hint={isOwnScope ? 'You can still spend' : 'This person can still spend'}
              periodText={periodText}
              remaining={detail?.remaining || 0}
              given={detail?.given || 0}
              spent={detail?.spent || 0}
              returned={detail?.returned || 0}
            />

            {(canGiveHere || canSpendHere) && (
              <div className="flex gap-2">
                {canGiveHere && (
                  <button
                    type="button"
                    onClick={openGive}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-2 py-3 shadow-xs lg:flex-row lg:justify-center lg:gap-2 lg:py-2.5"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 lg:size-8">
                      <Plus className="size-4" />
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-800 lg:text-xs">Give</span>
                  </button>
                )}
                {canSpendHere && (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm()
                      setSpendOpen(true)
                    }}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-2 py-3 shadow-xs lg:flex-row lg:justify-center lg:gap-2 lg:py-2.5"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-700 lg:size-8">
                      <ArrowUpRight className="size-4" />
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-800 lg:text-xs">Spend</span>
                  </button>
                )}
                {(canGiveHere || canSpendHere) && Number(detail?.remaining || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm()
                      setReturnOpen(true)
                    }}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-2 py-3 shadow-xs lg:flex-row lg:justify-center lg:gap-2 lg:py-2.5"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-sky-50 text-sky-700 lg:size-8">
                      <Undo2 className="size-4" />
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-800 lg:text-xs">Return</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900 lg:text-base">Activity</h2>
            {detailQuery.isLoading ? (
              <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-8 text-center text-xs text-zinc-400">
                Loading activity…
              </div>
            ) : txns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-4 py-8 text-center text-xs text-zinc-400">
                No money in or out in this date range.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="hidden grid-cols-[minmax(7rem,0.7fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 lg:grid">
                  <span>Date</span>
                  <span>What happened</span>
                  <span>By</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Balance after</span>
                </div>
                {txns.map((txn, idx) => {
                  const meta = txnMeta(txn)
                  const Icon = meta.Icon
                  return (
                    <div
                      key={txn.id}
                      className={cn(
                        'flex items-start gap-3 px-3.5 py-3 lg:grid lg:grid-cols-[minmax(7rem,0.7fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] lg:items-center lg:gap-3 lg:px-4 lg:py-3.5',
                        idx > 0 && 'border-t border-zinc-100',
                      )}
                    >
                      <p className="hidden text-sm text-zinc-600 lg:block">{txnDateLabel(txn)}</p>
                      <span className="flex min-w-0 items-start gap-3">
                        <span
                          className={cn(
                            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full lg:mt-0 lg:size-8',
                            meta.iconWrap,
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-zinc-900">{meta.title}</span>
                          <span className="block truncate text-[11px] text-zinc-400 lg:hidden">
                            {txnDateLabel(txn)}
                            {txn.createdByName ? ` · ${txn.createdByName}` : ''}
                            {txn.batchNumber ? ` · ${txn.batchNumber}` : ''}
                            {txn.notes ? ` · ${txn.notes}` : ''}
                          </span>
                          {(txn.notes || txn.batchNumber) && (
                            <span className="mt-0.5 hidden truncate text-[11px] text-zinc-400 lg:block">
                              {[txn.batchNumber, txn.notes].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="hidden truncate text-sm text-zinc-600 lg:block">{txn.createdByName}</span>
                      <div className="ml-auto text-right lg:ml-0">
                        <p className={cn('text-sm font-bold tabular-nums', meta.amountClass)}>
                          {meta.sign}
                          {money(txn.amount)}
                        </p>
                        <p className="text-[10px] tabular-nums text-zinc-400 lg:hidden">
                          Bal {money(txn.balanceAfter)}
                        </p>
                      </div>
                      <p className="hidden text-right text-sm tabular-nums text-zinc-600 lg:block">
                        {money(txn.balanceAfter)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={giveOpen} onOpenChange={setGiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Give money</DialogTitle>
            <DialogDescription>Cash handed to a staff member. This is not a factory expense.</DialogDescription>
          </DialogHeader>
          {formFields('give')}
          <Button
            className="mt-4 w-full"
            disabled={busy || !giveHolderId || !(Number(amount) > 0)}
            onClick={() =>
              postMoney(`/processing-wallets/${giveHolderId}/give`, {
                amount: Number(amount),
                notes: notes || null,
                businessDate: txnDate,
              })
            }
          >
            <Banknote className="size-3.5" />
            {busy ? 'Saving…' : 'Give money'}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={spendOpen} onOpenChange={setSpendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record spend</DialogTitle>
            <DialogDescription>
              Use this for cash that is not already captured on scrap buying or a process run.
            </DialogDescription>
          </DialogHeader>
          {formFields('spend')}
          <Button
            className="mt-4 w-full"
            disabled={busy || !(Number(amount) > 0) || !targetUserId}
            onClick={() =>
              postMoney(`/processing-wallets/${targetUserId}/spend`, {
                amount: Number(amount),
                purpose: purpose || 'Other spend',
                notes: notes || null,
                businessDate: txnDate,
              })
            }
          >
            <ArrowUpRight className="size-3.5" />
            {busy ? 'Saving…' : 'Record spend'}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return unused cash</DialogTitle>
            <DialogDescription>
              Remaining now: {money(detail?.remaining || 0)}. This goes back from the wallet.
            </DialogDescription>
          </DialogHeader>
          {formFields('return')}
          <Button
            className="mt-4 w-full"
            disabled={busy || !(Number(amount) > 0) || !targetUserId}
            onClick={() =>
              postMoney(`/processing-wallets/${targetUserId}/return`, {
                amount: Number(amount),
                notes: notes || null,
                businessDate: txnDate,
              })
            }
          >
            <ArrowDownLeft className="size-3.5" />
            {busy ? 'Saving…' : 'Return cash'}
          </Button>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
