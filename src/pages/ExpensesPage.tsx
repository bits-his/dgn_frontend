import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Receipt, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
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
  APPROVED: 'bg-teal-50 text-teal-800',
  PENDING: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  REJECTED: 'bg-red-50 text-red-700',
}

export function ExpensesPage() {
  const user = useAuthStore((s) => s.user)
  const canCreate = hasPermission(user, 'expense.create')
  const canApprove = hasPermission(user, 'expense.approve')
  const [composing, setComposing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const summary = useQuery({
    queryKey: ['expense-summary'],
    queryFn: async () => {
      const { data } = await api.get('/expenses/summary')
      return data.data as Summary
    },
  })

  const expenses = useQuery({
    queryKey: ['expenses', statusFilter],
    queryFn: async () => {
      const { data } = await api.get('/expenses', {
        params: statusFilter ? { status: statusFilter } : {},
      })
      return data.data as ExpenseRow[]
    },
  })

  if (composing) {
    return <NewExpenseForm onDone={() => setComposing(false)} />
  }

  const s = summary.data

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Factory expenses"
        actions={
          canCreate ? (
            <button className="dgn-btn dgn-btn-primary" onClick={() => setComposing(true)}>
              <Plus className="h-4 w-4" /> Record expense
            </button>
          ) : null
        }
      />

      {s && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatPill label={`Approved · ${s.periodLabel}`} value={money(s.approvedTotal)} tone="accent" />
            <StatPill
              label={`Waiting for approval (${s.pendingCount})`}
              value={money(s.pendingTotal)}
              tone={s.pendingCount > 0 ? 'danger' : 'success'}
            />
            <StatPill label="In the overhead pool" value={money(s.factoryPoolTotal)} />
            <StatPill label="Charged straight to batches" value={money(s.batchChargedTotal)} />
          </div>

          {s.periodAllocated && (
            <Card className="mb-6 border-amber-200 bg-amber-50/50">
              <p className="text-sm text-amber-900">
                <span className="font-semibold">{s.periodLabel} is closed.</span> Overhead was
                allocated as{' '}
                <Link
                  to="/costs/overhead"
                  className="font-mono font-semibold underline"
                >
                  {s.allocationNumber}
                </Link>
                , so new expenses cannot be added to that month until the allocation is reversed.
              </p>
            </Card>
          )}

          {s.byCategory.length > 0 && (
            <Card className="mb-6">
              <h2 className="text-base font-semibold">Where the money went in {s.periodLabel}</h2>
              <div className="mt-4 space-y-3">
                {s.byCategory.map((row) => {
                  const biggest = s.byCategory[0].amount || 1
                  return (
                    <div key={row.label}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">{row.label}</span>
                        <span>{money(row.amount)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-[var(--accent)]"
                          style={{ width: `${(row.amount / biggest) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h2 className="text-base font-semibold">Expense records</h2>
          <div className="flex flex-wrap gap-2">
            {['', 'PENDING', 'APPROVED', 'REJECTED'].map((value) => (
              <button
                key={value || 'ALL'}
                onClick={() => setStatusFilter(value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  statusFilter === value ? 'bg-[var(--bg-sidebar)] text-white' : 'bg-zinc-100'
                }`}
              >
                {value || 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Expense #</th>
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3 font-semibold">Category</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Scope / batch</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!expenses.isLoading &&
                (expenses.data ?? []).map((row) => (
                  <ExpenseTableRows key={row.id} row={row} canApprove={canApprove} />
                ))}
              {!expenses.isLoading && expenses.data?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    Nothing recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function ExpenseTableRows({ row, canApprove }: { row: ExpenseRow; canApprove: boolean }) {
  const queryClient = useQueryClient()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    setError(null)
    setBusy(true)
    try {
      await api.post(`/expenses/${row.expenseNumber}/decision`, { decision, reason })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
      queryClient.invalidateQueries({ queryKey: ['overhead-preview'] })
      setRejecting(false)
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not save the decision'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <tr className="border-b border-[var(--line)] align-top hover:bg-zinc-50/80">
        <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-muted)] tabular-nums">
          {formatBusinessDate(row.businessDate)}
        </td>
        <td className="px-3 py-3 font-mono text-xs font-semibold">{row.expenseNumber}</td>
        <td className="max-w-xs px-3 py-3">
          <p className="font-medium">{row.description}</p>
          <p className="mt-1 text-xs text-[var(--ink-faint)]">
            {row.paymentMethod.toLowerCase()}
            {row.vendorName ? ` · ${row.vendorName}` : ''}
            {row.receiptRef ? ` · receipt ${row.receiptRef}` : ''}
          </p>
          {row.decisionReason && (
            <p className="mt-2 text-xs text-red-700">{row.decisionReason}</p>
          )}
        </td>
        <td className="px-3 py-3">
          <p>{row.categoryName || '—'}</p>
          <p className="mt-0.5 text-xs capitalize text-[var(--ink-faint)]">
            {row.costClass.toLowerCase()}
          </p>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">
          {money(row.amount)}
        </td>
        <td className="px-3 py-3">
          <span
            className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[row.status] ?? 'bg-zinc-100'}`}
          >
            {row.status}
          </span>
          {row.approvedBy && (
            <p className="mt-1 text-xs text-[var(--ink-faint)]">by {row.approvedBy}</p>
          )}
        </td>
        <td className="px-3 py-3">
          {row.allocationScope === 'BATCH' ? (
            row.batchNumber ? (
              <Link
                to={`/batches/${row.batchNumber}`}
                className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
              >
                {row.batchNumber}
              </Link>
            ) : (
              'Batch'
            )
          ) : (
            <span>Factory overhead</span>
          )}
          {row.recordedBy && (
            <p className="mt-1 text-xs text-[var(--ink-faint)]">by {row.recordedBy}</p>
          )}
        </td>
        <td className="px-4 py-3">
          {canApprove && row.status === 'PENDING' ? (
            <div className="flex justify-end gap-2">
              <button
                className="dgn-btn dgn-btn-primary"
                disabled={busy}
                onClick={() => decide('APPROVE')}
              >
                <Check className="h-4 w-4" /> Approve
              </button>
              <button
                className="dgn-btn dgn-btn-secondary"
                disabled={busy}
                onClick={() => setRejecting((v) => !v)}
              >
                <X className="h-4 w-4" /> Reject
              </button>
            </div>
          ) : (
            <span className="block text-right text-[var(--ink-faint)]">—</span>
          )}
        </td>
      </tr>

      {(rejecting || error) && (
        <tr className="border-b border-[var(--line)] bg-zinc-50">
          <td colSpan={8} className="px-4 py-3">
            {rejecting && (
              <div className="ml-auto max-w-xl">
                <Field label="Why is it rejected?" hint="Required — at least 5 characters">
                  <input
                    className="dgn-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <button
                  className="dgn-btn dgn-btn-secondary mt-3"
                  disabled={busy || reason.trim().length < 5}
                  onClick={() => decide('REJECT')}
                >
                  Confirm rejection
                </button>
              </div>
            )}
            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </td>
        </tr>
      )}
    </>
  )
}

function NewExpenseForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
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
  const [result, setResult] = useState<{ expenseNumber: string; message: string } | null>(null)
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

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      const { data } = await api.post('/expenses', {
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
      setResult({ expenseNumber: data.expenseNumber, message: data.message })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
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

  if (result) {
    return (
      <div>
        <PageHeader eyebrow="Finance" title="Expense recorded" />
        <Card>
          <p className="font-mono text-2xl font-semibold">{result.expenseNumber}</p>
          <p className="mt-3 text-sm text-[var(--ink-muted)]">{result.message}</p>
          <button className="dgn-btn dgn-btn-primary mt-5" onClick={onDone}>
            Back to expenses
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Record an expense"
        actions={
          <button className="dgn-btn dgn-btn-ghost" onClick={onDone}>
            Cancel
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What was it for?">
              <select
                className="dgn-input"
                value={costCategoryId}
                onChange={(e) => setCostCategoryId(e.target.value)}
              >
                <option value="">Select a category</option>
                {grouped.map(([costClass, items]) => (
                  <optgroup key={costClass} label={costClass}>
                    {items.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Amount (₦)">
              <input
                className="dgn-input"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <input
                  className="dgn-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Generator diesel, 500 litres"
                />
              </Field>
            </div>
            <Field label="Paid to">
              <input
                className="dgn-input"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
              />
            </Field>
            <Field label="How was it paid?">
              <select
                className="dgn-input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {(categories.data?.paymentMethods ?? ['CASH']).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Receipt / invoice number">
              <input
                className="dgn-input"
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value)}
              />
            </Field>
            <Field label="Date of the expense" hint="Leave blank for today">
              <input
                className="dgn-input"
                type="date"
                value={incurredAt}
                onChange={(e) => setIncurredAt(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <textarea
                  className="dgn-input"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold">Who carries this cost?</h2>
            <div className="mt-4 space-y-3">
              <ScopeOption
                selected={allocationScope === 'FACTORY'}
                onSelect={() => setAllocationScope('FACTORY')}
                title="The whole factory"
                desc="Shared across every kilogram produced this month. Use this for rent, diesel, electricity, security and general repairs."
              />
              <ScopeOption
                selected={allocationScope === 'BATCH'}
                onSelect={() => setAllocationScope('BATCH')}
                title="One specific batch"
                desc="Charged straight onto that batch's cost. Use this when the spend was caused by one job, like a breakdown during a run."
              />
            </div>

            {allocationScope === 'BATCH' && (
              <div className="mt-4">
                <Field label="Batch number">
                  <input
                    className="dgn-input font-mono"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
                    placeholder="CRH-260903-001"
                  />
                </Field>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}

            <button
              className="dgn-btn dgn-btn-primary mt-5 w-full"
              disabled={saving || !costCategoryId || !description || !(Number(amount) > 0)}
              onClick={submit}
            >
              <Receipt className="h-4 w-4" />
              {saving ? 'Saving…' : 'Submit for approval'}
            </button>
            <p className="mt-2 text-center text-xs text-[var(--ink-faint)]">
              Someone else has to approve it before it affects factory costs.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ScopeOption({
  selected,
  onSelect,
  title,
  desc,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
        selected
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
          : 'border-[var(--line)] hover:border-[var(--accent)]'
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{desc}</p>
    </button>
  )
}
