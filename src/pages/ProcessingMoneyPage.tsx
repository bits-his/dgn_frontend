import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownLeft, ArrowUpRight, Banknote, Plus, Undo2 } from 'lucide-react'
import { HideMoneyButton } from '@/components/HideMoneyButton'
import { useHideMoney } from '@/hooks/useHideMoney'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SearchableSelect } from '@/components/ui/searchable-select'
import CustomTable1 from '@/components/CustomTable1'
import { hasPermission } from '@/lib/auth'
import { formatBusinessDate } from '@/lib/dates'
import { useAuthStore } from '@/stores/auth-store'

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
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

const TYPE_STYLES: Record<string, string> = {
  GIVE: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  SPEND: 'bg-amber-50 text-amber-800 border border-amber-200',
  RETURN: 'bg-sky-50 text-sky-800 border border-sky-200',
}

export function ProcessingMoneyPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { userId } = useParams<{ userId?: string }>()
  const queryClient = useQueryClient()
  const canGive = hasPermission(user, 'float.give') || user?.roleCode === 'ADMIN'
  const selectedId = userId ? Number(userId) : null
  const { maskMoney } = useHideMoney()

  const listQuery = useQuery({
    queryKey: ['processing-wallets'],
    queryFn: async () => {
      const { data } = await api.get('/processing-wallets')
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
    queryKey: ['processing-wallet', detailUserId],
    enabled: Boolean(detailUserId),
    queryFn: async () => {
      const path = Number(detailUserId) === Number(user?.id) ? '/processing-wallets/me' : `/processing-wallets/${detailUserId}`
      const { data } = await api.get(path)
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
  const [purpose, setPurpose] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const wallets = listQuery.data?.data || []
  const detail = detailQuery.data?.data
  const txns = detailQuery.data?.transactions || []
  const showList = !isOwnScope && !selectedId
  const canSpendHere = Boolean(detailQuery.data?.canSpend || isOwnScope)
  const canGiveHere = Boolean(detailQuery.data?.canGive || canGive)

  const resetForm = () => {
    setAmount('')
    setPurpose('')
    setNotes('')
    setFormError(null)
    setBusy(false)
  }

  const postMoney = async (path: string, body: Record<string, unknown>) => {
    setBusy(true)
    setFormError(null)
    try {
      await api.post(path, body)
      await queryClient.invalidateQueries({ queryKey: ['processing-wallets'] })
      await queryClient.invalidateQueries({ queryKey: ['processing-wallet'] })
      await queryClient.invalidateQueries({ queryKey: ['processing-wallet-me'] })
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

  const columns = useMemo<ColumnDef<WalletSummary>[]>(
    () => [
      {
        accessorKey: 'holderName',
        header: 'Person',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-xs text-zinc-900">{row.original.holderName || 'Staff'}</p>
            <p className="text-[11px] text-zinc-400">{row.original.holderRole || row.original.holderUsername}</p>
          </div>
        ),
      },
      {
        accessorKey: 'given',
        header: 'Given',
        cell: ({ row }) => <span className="tabular-nums text-xs">{maskMoney(money(row.original.given))}</span>,
      },
      {
        accessorKey: 'spent',
        header: 'Spent',
        cell: ({ row }) => <span className="tabular-nums text-xs">{maskMoney(money(row.original.spent))}</span>,
      },
      {
        accessorKey: 'returned',
        header: 'Returned',
        cell: ({ row }) => <span className="tabular-nums text-xs">{maskMoney(money(row.original.returned))}</span>,
      },
      {
        accessorKey: 'remaining',
        header: 'Remaining',
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-xs text-emerald-700">
            {maskMoney(money(row.original.remaining))}
          </span>
        ),
      },
      {
        id: 'open',
        header: '',
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (row.original.holderUserId) navigate(`/processing-money/${row.original.holderUserId}`)
            }}
          >
            Open
          </Button>
        ),
      },
    ],
    [navigate, maskMoney],
  )

  const txnColumns = useMemo<ColumnDef<WalletTxn>[]>(
    () => [
      {
        accessorKey: 'businessDate',
        header: 'Date',
        cell: ({ row }) => (
          <p className="text-xs text-zinc-800">{formatBusinessDate(row.original.businessDate)}</p>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              TYPE_STYLES[row.original.type] || 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {row.original.type}
          </span>
        ),
      },
      {
        accessorKey: 'purpose',
        header: 'What for',
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-medium text-zinc-900">{row.original.purpose || row.original.source}</p>
            {row.original.notes && <p className="text-[11px] text-zinc-400">{row.original.notes}</p>}
            {row.original.batchNumber && (
              <p className="font-mono text-[11px] text-zinc-400">{row.original.batchNumber}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs font-semibold">{maskMoney(money(row.original.amount))}</span>
        ),
      },
      {
        accessorKey: 'balanceAfter',
        header: 'Balance after',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs">{maskMoney(money(row.original.balanceAfter))}</span>
        ),
      },
      {
        accessorKey: 'createdByName',
        header: 'By',
        cell: ({ row }) => <span className="text-xs text-zinc-600">{row.original.createdByName}</span>,
      },
    ],
    [maskMoney],
  )

  const holderOptions = (holdersQuery.data || []).map((h) => ({
    value: String(h.id),
    label: h.name,
    sublabel: h.roleCode || h.username,
  }))

  const targetUserId =
    giveOpen && canGive ? Number(giveHolderId || detailUserId || 0) : Number(detailUserId || 0)

  return (
    <PageLayout
      title={showList ? 'Processing money' : detail?.holderName || 'Processing money'}
      description={
        showList
          ? 'Cash given to processing staff for scrap buying, sorting, washing and other work.'
          : 'Given, spent, and remaining for this person.'
      }
      back={Boolean(selectedId) && !isOwnScope}
      backTo="/processing-money"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <HideMoneyButton />
          {canGive && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                resetForm()
                setGiveHolderId(detailUserId ? String(detailUserId) : '')
                setGiveOpen(true)
              }}
            >
              <Plus className="size-3.5" />
              Give money
            </Button>
          )}
          {!showList && canSpendHere && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                resetForm()
                setSpendOpen(true)
              }}
            >
              Record spend
            </Button>
          )}
          {!showList && (canGiveHere || canSpendHere) && Number(detail?.remaining || 0) > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                resetForm()
                setReturnOpen(true)
              }}
            >
              <Undo2 className="size-3.5" />
              Return cash
            </Button>
          )}
        </div>
      }
    >
      {showList ? (
        <CustomTable1
          data={wallets}
          columns={columns}
          loading={listQuery.isLoading}
          card
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Remaining</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-950">
                {maskMoney(money(detail?.remaining || 0))}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Given</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{maskMoney(money(detail?.given || 0))}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Spent</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{maskMoney(money(detail?.spent || 0))}</p>
            </div>
          </div>
          <CustomTable1 data={txns} columns={txnColumns} loading={detailQuery.isLoading} card />
        </div>
      )}

      <Dialog open={giveOpen} onOpenChange={setGiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give processing money</DialogTitle>
            <DialogDescription>Cash handed to a processing staff member. This is not a factory expense.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <SearchableSelect
              label="Staff member"
              value={giveHolderId}
              onChange={setGiveHolderId}
              options={holderOptions}
              placeholder="Choose who receives the money"
            />
            <div>
              <Label htmlFor="give-amount">Amount (₦)</Label>
              <Input id="give-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="give-notes">Note</Label>
              <Textarea id="give-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <Button
              disabled={busy || !giveHolderId || !(Number(amount) > 0)}
              onClick={() =>
                postMoney(`/processing-wallets/${giveHolderId}/give`, {
                  amount: Number(amount),
                  notes: notes || null,
                })
              }
            >
              <Banknote className="size-3.5" />
              {busy ? 'Saving…' : 'Give money'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={spendOpen} onOpenChange={setSpendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record other spend</DialogTitle>
            <DialogDescription>
              Use this for cash that is not already captured on scrap buying or a process run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="spend-purpose">What was it for</Label>
              <Input id="spend-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Transport, casual labour…" />
            </div>
            <div>
              <Label htmlFor="spend-amount">Amount (₦)</Label>
              <Input id="spend-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="spend-notes">Note</Label>
              <Textarea id="spend-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <Button
              disabled={busy || !(Number(amount) > 0) || !targetUserId}
              onClick={() =>
                postMoney(`/processing-wallets/${targetUserId}/spend`, {
                  amount: Number(amount),
                  purpose: purpose || 'Other spend',
                  notes: notes || null,
                })
              }
            >
              <ArrowUpRight className="size-3.5" />
              {busy ? 'Saving…' : 'Record spend'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return unused cash</DialogTitle>
            <DialogDescription>Hand remaining processing money back. Remaining will go down.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">Remaining now: {money(detail?.remaining || 0)}</p>
            <div>
              <Label htmlFor="return-amount">Amount (₦)</Label>
              <Input id="return-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="return-notes">Note</Label>
              <Textarea id="return-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <Button
              disabled={busy || !(Number(amount) > 0) || !targetUserId}
              onClick={() =>
                postMoney(`/processing-wallets/${targetUserId}/return`, {
                  amount: Number(amount),
                  notes: notes || null,
                })
              }
            >
              <ArrowDownLeft className="size-3.5" />
              {busy ? 'Saving…' : 'Return cash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
