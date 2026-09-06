import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, X, Search, CheckCircle2, Clock, Building2, Layers } from 'lucide-react'
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

type Category = {
  id: number
  code: string
  name: string
  costClass: string
}

type ExpenseRow = {
  id: number
  expenseNumber: string
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
  byClass: Record<string, number>
  byCategory: { label: string; amount: number }[]
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
  const canCreate = hasPermission(user, 'expense.create')
  const canApprove = hasPermission(user, 'expense.approve')
  const queryClient = useQueryClient()
  const [composing, setComposing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [rejectingExpense, setRejectingExpense] = useState<ExpenseRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)

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

  const handleApprove = async (id: number) => {
    try {
      await api.post(`/expenses/${id}/approve`)
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
    } catch {
      // handled by global handler
    }
  }

  const handleConfirmReject = async () => {
    if (!rejectingExpense) return
    setRejectError(null)
    setRejectBusy(true)
    try {
      await api.post(`/expenses/${rejectingExpense.id}/reject`, { reason: rejectReason })
      setRejectingExpense(null)
      setRejectReason('')
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
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
        (e.batchNumber && e.batchNumber.toLowerCase().includes(q))
    )
  }, [expenses.data, search])

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      {
        accessorKey: 'businessDate',
        header: 'Date & Ref',
        cell: ({ row }) => (
          <div>
            <p className="text-xs text-zinc-900 font-medium">
              {formatBusinessDate(row.original.businessDate)}
            </p>
            <p className="font-mono text-[11px] text-zinc-400 mt-0.5">{row.original.expenseNumber}</p>
          </div>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-xs text-zinc-900">{row.original.description}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
              {row.original.vendorName && <span>{row.original.vendorName}</span>}
              <span>· {row.original.paymentMethod}</span>
              {row.original.receiptRef && <span>· receipt #{row.original.receiptRef}</span>}
            </div>
            {row.original.decisionReason && (
              <p className="mt-1 text-[11px] text-red-600">Reason: {row.original.decisionReason}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'categoryName',
        header: 'Category',
        cell: ({ row }) => (
          <div>
            <p className="text-xs text-zinc-800">{row.original.categoryName || '—'}</p>
            <p className="text-[11px] capitalize text-zinc-400">{row.original.costClass.toLowerCase()}</p>
          </div>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="font-semibold text-xs tabular-nums text-zinc-900">
            {money(row.original.amount)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                STATUS_STYLES[row.original.status] ?? 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {row.original.status}
            </span>
            {row.original.approvedBy && (
              <p className="text-[10px] text-zinc-400 mt-0.5">by {row.original.approvedBy}</p>
            )}
          </div>
        ),
      },
      {
        id: 'scope',
        header: 'Scope / Batch',
        cell: ({ row }) => (
          <div>
            {row.original.allocationScope === 'BATCH' ? (
              row.original.batchNumber ? (
                <Link
                  to={`/batches/${row.original.batchNumber}`}
                  className="font-mono text-xs font-semibold text-zinc-900 hover:underline"
                >
                  {row.original.batchNumber}
                </Link>
              ) : (
                <span className="text-xs text-zinc-700">Batch</span>
              )
            ) : (
              <span className="text-xs text-zinc-600">Factory overhead</span>
            )}
            {row.original.recordedBy && (
              <p className="text-[10px] text-zinc-400 mt-0.5">by {row.original.recordedBy}</p>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          if (canApprove && row.original.status === 'PENDING') {
            return (
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs font-semibold gap-1"
                  onClick={() => handleApprove(row.original.id)}
                >
                  <Check className="size-3" /> Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-semibold gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setRejectingExpense(row.original)}
                >
                  <X className="size-3" /> Reject
                </Button>
              </div>
            )
          }
          return null
        },
      },
    ],
    [canApprove]
  )

  const s = summary.data

  return (
    <PageLayout
      title="Factory Expenses"
      description="Operating expenses, direct batch costs, and overhead allocation pool"
      actions={
        canCreate ? (
          <Button
            size="sm"
            className="h-8 px-3 text-xs font-semibold gap-1.5"
            onClick={() => setComposing(true)}
          >
            <Plus className="size-3.5" /> Record expense
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        {s && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            {/* Approved in Period */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Approved · {s.periodLabel}
                  </span>
                  <div className="size-5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-teal-700 dark:text-teal-400 tabular-nums tracking-tight truncate block">
                    {money(s.approvedTotal)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Disbursements finalized
              </p>
            </div>

            {/* Waiting Approval */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Pending Approval
                  </span>
                  <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${s.pendingCount > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                    <Clock className="size-3" />
                  </div>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className={`text-base sm:text-lg font-black tabular-nums tracking-tight truncate ${s.pendingCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-900 dark:text-white'}`}>
                    {money(s.pendingTotal)}
                  </span>
                  {s.pendingCount > 0 && (
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium truncate">
                      ({s.pendingCount} req)
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                {s.pendingCount > 0 ? `${s.pendingCount} voucher${s.pendingCount === 1 ? '' : 's'} waiting signoff` : 'All caught up'}
              </p>
            </div>

            {/* Overhead Pool */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Overhead Pool
                  </span>
                  <div className="size-5 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 flex items-center justify-center shrink-0">
                    <Building2 className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                    {money(s.factoryPoolTotal)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Plant-wide shared spend
              </p>
            </div>

            {/* Direct Batch Cost */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Direct Batch Cost
                  </span>
                  <div className="size-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Layers className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                    {money(s.batchChargedTotal)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Charged straight to lots
              </p>
            </div>
          </div>
        )}

        {s?.periodAllocated && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <span className="font-semibold">{s.periodLabel} is closed.</span> Overhead was allocated as{' '}
            <Link to="/costs/overhead" className="font-mono font-semibold underline">
              {s.allocationNumber}
            </Link>
            . New expenses cannot be posted to that month until the allocation is reversed.
          </div>
        )}

        {/* Filter & search controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs font-semibold">
                  <SelectValue placeholder="All expenses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All expenses</SelectItem>
                  <SelectItem value="PENDING">Pending approval</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
              <Input
                className="pl-8 h-8 text-xs w-full"
                placeholder="Search description, vendor, ref…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="text-xs text-zinc-500 self-end sm:self-center">
            {filtered.length} expense record{filtered.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* CustomTable1 with card removed around it */}
        <CustomTable1
          columns={columns}
          data={filtered}
          loading={expenses.isLoading}
        />

        {/* Record Expense Modal Dialog */}
        <Dialog open={composing} onOpenChange={setComposing}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Factory Expense</DialogTitle>
              <DialogDescription>
                Log a disbursement, assign its cost category, and decide if charged to a batch or the overhead pool.
              </DialogDescription>
            </DialogHeader>

            <NewExpenseModalForm
              onDone={() => {
                setComposing(false)
                queryClient.invalidateQueries({ queryKey: ['expenses'] })
                queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Reject Confirmation Dialog */}
        {rejectingExpense && (
          <Dialog open={Boolean(rejectingExpense)} onOpenChange={(open) => !open && setRejectingExpense(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Reject Expense</DialogTitle>
                <DialogDescription>
                  Explain why {rejectingExpense.expenseNumber} ({money(rejectingExpense.amount)}) is being rejected.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <div>
                  <Label className="text-xs mb-1 block">Rejection reason (min 5 characters)</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="e.g. Incorrect receipt, unauthorized item"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>

                {rejectError && <p className="text-xs text-red-600 font-medium">{rejectError}</p>}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setRejectingExpense(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
                    disabled={rejectBusy || rejectReason.trim().length < 5}
                    onClick={handleConfirmReject}
                  >
                    {rejectBusy ? 'Rejecting…' : 'Confirm rejection'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </PageLayout>
  )
}

function NewExpenseModalForm({ onDone }: { onDone: () => void }) {
  const [costCategoryId, setCostCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [receiptRef, setReceiptRef] = useState('')
  const [allocationScope, setAllocationScope] = useState('FACTORY')
  const [batchNumber, setBatchNumber] = useState('')
  const [incurredAt, setIncurredAt] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const categories = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data } = await api.get('/expenses/categories')
      return {
        categories: data.data as Category[],
        paymentMethods: data.paymentMethods as string[],
      }
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.post('/expenses', {
        costCategoryId: Number(costCategoryId),
        description,
        amount: Number(amount),
        vendorName,
        paymentMethod,
        receiptRef,
        allocationScope,
        batchNumber: allocationScope === 'BATCH' ? batchNumber : undefined,
        incurredAt: incurredAt || undefined,
        notes,
      })
      onDone()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not record the expense'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 mt-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs mb-1 block">Description</Label>
          <Input
            className="h-8 text-xs"
            required
            placeholder="Diesel delivery, machine grease, packaging sacks…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs mb-1 block">Cost category</Label>
          <Select value={costCategoryId} onValueChange={setCostCategoryId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Choose category" />
            </SelectTrigger>
            <SelectContent>
              {grouped.map(([group, list]) =>
                list.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {group} · {cat.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs mb-1 block">Amount (₦)</Label>
          <Input
            type="number"
            inputMode="decimal"
            className="h-8 text-xs font-semibold"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs mb-1 block">Vendor / supplier</Label>
          <Input
            className="h-8 text-xs"
            placeholder="TotalEnergies, Oando, Hardware store"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs mb-1 block">Payment method</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(categories.data?.paymentMethods ?? ['CASH', 'TRANSFER', 'POS', 'CHEQUE']).map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs mb-1 block">Receipt / invoice #</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Optional receipt reference"
            value={receiptRef}
            onChange={(e) => setReceiptRef(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs mb-1 block">Date incurred</Label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={incurredAt}
            onChange={(e) => setIncurredAt(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <Label className="text-xs mb-1 block">Charge to</Label>
          <div className="grid grid-cols-2 gap-2">
            <label
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs ${
                allocationScope === 'FACTORY'
                  ? 'border-zinc-900 bg-zinc-50 font-semibold'
                  : 'border-zinc-200'
              }`}
            >
              <input
                type="radio"
                name="scope"
                checked={allocationScope === 'FACTORY'}
                onChange={() => setAllocationScope('FACTORY')}
              />
              <span>Factory overhead pool</span>
            </label>
            <label
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs ${
                allocationScope === 'BATCH'
                  ? 'border-zinc-900 bg-zinc-50 font-semibold'
                  : 'border-zinc-200'
              }`}
            >
              <input
                type="radio"
                name="scope"
                checked={allocationScope === 'BATCH'}
                onChange={() => setAllocationScope('BATCH')}
              />
              <span>Direct to specific batch</span>
            </label>
          </div>
        </div>

        {allocationScope === 'BATCH' && (
          <div className="sm:col-span-2">
            <Label className="text-xs mb-1 block">Batch number</Label>
            <Input
              className="h-8 text-xs font-mono"
              required
              placeholder="e.g. CRU-2026-001"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <Label className="text-xs mb-1 block">Notes</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Optional notes or justification"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
        <Button
          type="submit"
          size="sm"
          className="h-8 text-xs font-semibold"
          disabled={saving || !description || !costCategoryId || !(Number(amount) > 0)}
        >
          {saving ? 'Saving…' : 'Record expense'}
        </Button>
      </div>
    </form>
  )
}
