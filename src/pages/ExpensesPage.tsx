import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, X, Search, Wallet } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import CustomTable1 from '@/components/CustomTable1'
import { hasPermission } from '@/lib/auth'
import { formatBusinessDate } from '@/lib/dates'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

type Category = {
  id: number
  code: string
  name: string
  costClass: string
}

type ExpenseRow = {
  id: number
  expenseNumber: string
  costCategoryId?: number
  description: string
  categoryName: string | null
  costClass: string
  amount: number
  vendorName: string | null
  paymentMethod: string
  receiptRef: string | null
  allocationScope: string
  batchNumber: string | null
  status: string
  businessDate: string | null
  notes: string | null
  decisionReason: string | null
  createdById?: number | null
  recordedBy: string | null
  approvedBy: string | null
}

type Summary = {
  periodKey: string
  periodLabel: string
  approvedTotal: number
  pendingTotal: number
  pendingCount: number
  rejectedTotal: number
  factoryPoolTotal: number
  batchChargedTotal: number
  periodAllocated: boolean
  allocationNumber: string | null
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

const STATUS_STYLES: Record<string, string> = {
  APPROVED: 'bg-teal-50 text-teal-800 border border-teal-200',
  PENDING: 'bg-amber-50 text-amber-800 border border-amber-200',
  REJECTED: 'bg-red-50 text-red-700 border border-red-200',
}

export function ExpensesPage() {
  const user = useAuthStore((s) => s.user)
  const canCreate =
    hasPermission(user, 'expense.create') || hasPermission(user, 'float.spend')
  const canApprove = hasPermission(user, 'expense.approve')
  const canSeeAll =
    hasPermission(user, 'expense.approve') ||
    hasPermission(user, 'float.view') ||
    hasPermission(user, 'float.give') ||
    hasPermission(user, 'users.manage')
  const queryClient = useQueryClient()
  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState<ExpenseRow | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [rejectingExpense, setRejectingExpense] = useState<ExpenseRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)

  const isWalletExpense = (row: ExpenseRow) => {
    const method = String(row.paymentMethod || '').toUpperCase()
    return method === 'WALLET' || method === 'CASH'
  }

  const canEditRow = (row: ExpenseRow) => {
    const walletOk =
      row.status === 'PENDING' || (isWalletExpense(row) && row.status === 'APPROVED')
    if (!walletOk || row.status === 'REJECTED') return false
    if (canSeeAll) return true
    if (!canCreate) return false
    return Number(row.createdById) === Number(user?.id)
  }

  const wallet = useQuery({
    queryKey: ['processing-wallet-me'],
    queryFn: async () => {
      const { data } = await api.get('/processing-wallets/me')
      return data as {
        hasWallet?: boolean
        data?: { remaining?: number; given?: number; spent?: number }
      }
    },
  })

  const summary = useQuery({
    queryKey: ['expense-summary'],
    queryFn: async () => {
      const { data } = await api.get('/expenses/summary')
      return data.data as Summary
    },
  })

  const expenses = useQuery({
    queryKey: ['expenses', statusFilter === 'ALL' ? '' : statusFilter],
    queryFn: async () => {
      const { data } = await api.get('/expenses', {
        params: statusFilter !== 'ALL' ? { status: statusFilter } : {},
      })
      return data.data as ExpenseRow[]
    },
  })

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['processing-wallet-me'] }),
      queryClient.invalidateQueries({ queryKey: ['processing-wallets'] }),
    ])
  }

  const handleApprove = async (row: ExpenseRow) => {
    try {
      await api.post(`/expenses/${row.expenseNumber}/decision`, { decision: 'APPROVE' })
      await refreshAll()
    } catch {
      // global handler
    }
  }

  const handleConfirmReject = async () => {
    if (!rejectingExpense) return
    setRejectError(null)
    setRejectBusy(true)
    try {
      await api.post(`/expenses/${rejectingExpense.expenseNumber}/decision`, {
        decision: 'REJECT',
        reason: rejectReason,
      })
      setRejectingExpense(null)
      setRejectReason('')
      await refreshAll()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      setRejectError(String((body && body.err) || 'Could not reject expense'))
    } finally {
      setRejectBusy(false)
    }
  }

  const filtered = useMemo(() => {
    const list = expenses.data ?? []
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(
      (e) =>
        e.expenseNumber.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.vendorName && e.vendorName.toLowerCase().includes(q)) ||
        (e.categoryName && e.categoryName.toLowerCase().includes(q)) ||
        (e.batchNumber && e.batchNumber.toLowerCase().includes(q)),
    )
  }, [expenses.data, search])

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      {
        accessorKey: 'description',
        header: 'Expense',
        cell: ({ row }) => (
          <div className="min-w-0 py-0.5">
            <p className="text-xs font-semibold text-zinc-900 truncate">{row.original.description}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {formatBusinessDate(row.original.businessDate)}
              <span className="font-mono"> · {row.original.expenseNumber}</span>
              {row.original.categoryName ? ` · ${row.original.categoryName}` : ''}
              {canSeeAll && row.original.recordedBy
                ? ` · ${row.original.recordedBy}`
                : ''}
            </p>
            {row.original.decisionReason ? (
              <p className="mt-0.5 text-[10px] text-red-600">{row.original.decisionReason}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <div className="text-right">
            <p className="text-xs font-bold tabular-nums text-zinc-900">{money(row.original.amount)}</p>
            <p className="text-[10px] text-zinc-500">{row.original.paymentMethod}</p>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold',
              STATUS_STYLES[row.original.status] ?? 'bg-zinc-100 text-zinc-600',
            )}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const editable = canEditRow(row.original)
          // Wallet expenses auto-approve — only non-wallet pending need a decision
          const approvable =
            canApprove &&
            row.original.status === 'PENDING' &&
            !isWalletExpense(row.original)
          if (!editable && !approvable) return null
          return (
            <div className="flex items-center justify-end gap-1">
              {editable ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px] font-semibold gap-1"
                  onClick={() => setEditing(row.original)}
                >
                  <Pencil className="size-3" />
                  Edit
                </Button>
              ) : null}
              {approvable ? (
                <>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-[11px] font-semibold gap-1"
                    onClick={() => handleApprove(row.original)}
                  >
                    <Check className="size-3" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px] font-semibold text-red-600"
                    onClick={() => setRejectingExpense(row.original)}
                  >
                    <X className="size-3" />
                  </Button>
                </>
              ) : null}
            </div>
          )
        },
      },
    ],
    [canApprove, canSeeAll, canCreate, user?.id],
  )

  const s = summary.data
  const remaining = Number(wallet.data?.data?.remaining || 0)
  const hasWallet = Boolean(wallet.data?.hasWallet)

  return (
    <PageLayout
      title="Factory Expenses"
      description={
        canSeeAll
          ? 'Wallet spends post immediately · non-wallet items still need approval'
          : 'Pay from your wallet — recorded straight into costs'
      }
      actions={
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-semibold" asChild>
            <Link to="/wallet">
              <Wallet className="size-3.5" />
              Wallet
            </Link>
          </Button>
          {canCreate ? (
            <Button
              size="sm"
              className="h-8 px-3 text-xs font-semibold gap-1.5"
              onClick={() => setComposing(true)}
            >
              <Plus className="size-3.5" />
              Log expense
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="rounded-xl border border-zinc-900 bg-zinc-900 text-white px-3 py-2.5 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Wallet left
              </span>
              <Wallet className="size-3.5 text-zinc-400" />
            </div>
            <p className="mt-0.5 text-base font-black tabular-nums">
              {hasWallet ? money(remaining) : '—'}
            </p>
            <p className="text-[10px] text-zinc-400 truncate">
              {hasWallet ? 'Used when you log an expense' : 'Ask finance to fund your wallet'}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Pending approval
            </p>
            <p className="mt-0.5 text-base font-black tabular-nums text-amber-700">
              {money(s?.pendingTotal || 0)}
            </p>
            <p className="text-[10px] text-zinc-400">
              {s?.pendingCount || 0} non-wallet
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Approved · {s?.periodLabel || 'period'}
            </p>
            <p className="mt-0.5 text-base font-black tabular-nums text-teal-700">
              {money(s?.approvedTotal || 0)}
            </p>
            <p className="text-[10px] text-zinc-400">In costs</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 hidden lg:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Overhead pool
            </p>
            <p className="mt-0.5 text-base font-black tabular-nums text-zinc-900">
              {money(s?.factoryPoolTotal || 0)}
            </p>
            <p className="text-[10px] text-zinc-400">Factory-wide</p>
          </div>
        </div>

        {s?.periodAllocated ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-semibold">{s.periodLabel} is closed.</span> Overhead allocated as{' '}
            <Link to="/costs/overhead" className="font-mono font-semibold underline">
              {s.allocationNumber}
            </Link>
            .
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[9.5rem] text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[10rem] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-[11px] text-zinc-500 ml-auto">{filtered.length} records</span>
        </div>

        <CustomTable1 columns={columns} data={filtered} loading={expenses.isLoading} card />

        <Dialog open={composing} onOpenChange={setComposing}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log expense</DialogTitle>
              <DialogDescription>
                Pays from your wallet and posts to cost now — no admin approval.
              </DialogDescription>
            </DialogHeader>
            <ExpenseModalForm
              mode="create"
              walletRemaining={remaining}
              hasWallet={hasWallet}
              onDone={async () => {
                setComposing(false)
                await refreshAll()
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
        >
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit expense</DialogTitle>
              <DialogDescription>
                {editing
                  ? `${editing.expenseNumber} · wallet adjusts if the amount changes.`
                  : 'Update expense'}
              </DialogDescription>
            </DialogHeader>
            {editing ? (
              <ExpenseModalForm
                mode="edit"
                expense={editing}
                walletRemaining={remaining}
                hasWallet={hasWallet}
                onDone={async () => {
                  setEditing(null)
                  await refreshAll()
                }}
              />
            ) : null}
          </DialogContent>
        </Dialog>

        {rejectingExpense ? (
          <Dialog
            open={Boolean(rejectingExpense)}
            onOpenChange={(open) => !open && setRejectingExpense(null)}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Reject expense</DialogTitle>
                <DialogDescription>
                  {rejectingExpense.expenseNumber} · {money(rejectingExpense.amount)}. Wallet spend
                  is refunded if it was paid from wallet.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-1">
                <div>
                  <Label className="text-xs mb-1 block">Reason (min 5 characters)</Label>
                  <Input
                    className="h-8 text-xs"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                {rejectError ? <p className="text-xs text-red-600 font-medium">{rejectError}</p> : null}
                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setRejectingExpense(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
                    disabled={rejectBusy || rejectReason.trim().length < 5}
                    onClick={handleConfirmReject}
                  >
                    {rejectBusy ? 'Rejecting…' : 'Reject & refund'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </PageLayout>
  )
}

function ExpenseModalForm({
  mode,
  expense,
  onDone,
  walletRemaining,
  hasWallet,
}: {
  mode: 'create' | 'edit'
  expense?: ExpenseRow
  onDone: () => void
  walletRemaining: number
  hasWallet: boolean
}) {
  const user = useAuthStore((s) => s.user)
  const isEdit = mode === 'edit'
  const editingOwn =
    !isEdit || Number(expense?.createdById) === Number(user?.id)
  const [costCategoryId, setCostCategoryId] = useState(
    expense?.costCategoryId ? String(expense.costCategoryId) : '',
  )
  const [description, setDescription] = useState(expense?.description || '')
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [vendorName, setVendorName] = useState(expense?.vendorName || '')
  const [allocationScope, setAllocationScope] = useState(
    expense?.allocationScope || 'FACTORY',
  )
  const [batchNumber, setBatchNumber] = useState(expense?.batchNumber || '')
  const [notes, setNotes] = useState(expense?.notes || '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const categories = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data } = await api.get('/expenses/categories')
      return { categories: data.data as Category[] }
    },
  })

  const grouped = useMemo(() => {
    const map = new Map<string, Category[]>()
    for (const cat of categories.data?.categories ?? []) {
      if (!map.has(cat.costClass)) map.set(cat.costClass, [])
      map.get(cat.costClass)!.push(cat)
    }
    return Array.from(map.entries())
  }, [categories.data])

  const amountNum = Number(amount) || 0
  const priorAmount = isEdit ? Number(expense?.amount || 0) : 0
  const extraNeeded = isEdit ? Math.max(0, amountNum - priorAmount) : amountNum
  const overBalance =
    editingOwn && hasWallet && extraNeeded > walletRemaining + 0.001

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isEdit && !hasWallet) {
      setError('No wallet yet. Ask finance to give you money first.')
      return
    }
    if (overBalance) {
      setError(
        isEdit
          ? `Need ${money(extraNeeded)} more; only ${money(walletRemaining)} left in wallet`
          : `Only ${money(walletRemaining)} left in your wallet`,
      )
      return
    }
    setSaving(true)
    try {
      const payload = {
        costCategoryId: Number(costCategoryId),
        description,
        amount: amountNum,
        vendorName: vendorName || undefined,
        allocationScope,
        batchNumber: allocationScope === 'BATCH' ? batchNumber : undefined,
        notes: notes || undefined,
      }
      if (isEdit && expense) {
        await api.patch(`/expenses/${expense.expenseNumber}`, payload)
      } else {
        await api.post('/expenses', {
          ...payload,
          paymentMethod: 'WALLET',
          payFromWallet: true,
        })
      }
      onDone()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(
          String(
            (body && body.err) ||
              (isEdit ? 'Could not update the expense' : 'Could not record the expense'),
          ),
        )
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 mt-1">
      <div
        className={cn(
          'rounded-lg border px-3 py-2 text-xs',
          hasWallet ? 'border-zinc-200 bg-zinc-50' : 'border-amber-200 bg-amber-50 text-amber-900',
        )}
      >
        {editingOwn && hasWallet ? (
          <p>
            Wallet remaining <span className="font-bold tabular-nums">{money(walletRemaining)}</span>
            {isEdit ? (
              <span className="text-zinc-500">
                {' '}
                · already charged {money(priorAmount)}
              </span>
            ) : null}
          </p>
        ) : editingOwn ? (
          <p>Open a wallet first — expenses pay from your processing money.</p>
        ) : (
          <p>
            Editing {expense?.recordedBy || 'member'}’s expense
            {isEdit ? ` · currently ${money(priorAmount)}` : ''}. Wallet adjusts on their account.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">What was spent</Label>
        <Input
          className="h-8 text-xs"
          required
          placeholder="Diesel, grease, packaging…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Category</Label>
        <Select value={costCategoryId} onValueChange={setCostCategoryId}>
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue placeholder="Choose category…" />
          </SelectTrigger>
          <SelectContent>
            {grouped.map(([group, list]) =>
              list.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {group} · {cat.name}
                </SelectItem>
              )),
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Amount (₦)</Label>
        <Input
          type="number"
          inputMode="decimal"
          className={cn('h-8 w-full text-xs font-semibold', overBalance && 'border-red-400')}
          required
          min={0}
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Vendor (optional)</Label>
        <Input
          className="h-8 text-xs"
          placeholder="Supplier name"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn(
            'rounded-lg border px-2.5 py-2 text-left text-xs',
            allocationScope === 'FACTORY'
              ? 'border-zinc-900 bg-zinc-50 font-semibold'
              : 'border-zinc-200',
          )}
          onClick={() => setAllocationScope('FACTORY')}
        >
          Factory overhead
        </button>
        <button
          type="button"
          className={cn(
            'rounded-lg border px-2.5 py-2 text-left text-xs',
            allocationScope === 'BATCH'
              ? 'border-zinc-900 bg-zinc-50 font-semibold'
              : 'border-zinc-200',
          )}
          onClick={() => setAllocationScope('BATCH')}
        >
          Direct to batch
        </button>
      </div>

      {allocationScope === 'BATCH' ? (
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Batch number</Label>
          <Input
            className="h-8 text-xs font-mono"
            required
            placeholder="e.g. PROD-…"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Notes (optional)</Label>
        <Input
          className="h-8 text-xs"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error ? <p className="text-xs text-red-600 font-medium">{error}</p> : null}

      <div className="flex justify-end pt-2 border-t border-zinc-100">
        <Button
          type="submit"
          size="sm"
          className="h-8 text-xs font-semibold"
          disabled={
            saving ||
            !description ||
            !costCategoryId ||
            !(amountNum > 0) ||
            (!isEdit && !hasWallet) ||
            overBalance
          }
        >
          {saving
            ? isEdit
              ? 'Saving…'
              : 'Paying…'
            : isEdit
              ? 'Save changes'
              : `Pay ${amountNum > 0 ? money(amountNum) : ''} · post to cost`}
        </Button>
      </div>
    </form>
  )
}
