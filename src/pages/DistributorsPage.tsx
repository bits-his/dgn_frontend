import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, StatPill, NairaAmountInput } from '@/components/ui'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { type UnpaidInvoice } from '@/pages/DistributorPaymentForm'

export type DistributorCredit = {
  creditLimit: number
  outstanding: number
  available: number
  utilizationPercent: number
  atLimit: boolean
  unpaidCount?: number
  overdueCount?: number
  overdueAmount?: number
  oldestUnpaidDays?: number
  saleCount?: number
  revenue?: number
  collected?: number
  unpaid?: UnpaidInvoice[]
}

export type DistributorRow = {
  id: number
  code: string
  name: string
  phone: string | null
  address: string | null
  contactPerson: string | null
  region: string | null
  paymentTermsDays: number
  creditLimit: number
  notes: string | null
  distributorKind?: 'INTERNAL' | 'EXTERNAL' | string | null
  minOrderQty?: number | null
  isActive: boolean
  credit: DistributorCredit
}

type FormState = {
  name: string
  contactPerson: string
  phone: string
  region: string
  address: string
  distributorKind: 'INTERNAL' | 'EXTERNAL'
  minOrderQty: string
  creditLimit: string
  paymentTermsDays: string
  notes: string
}

const emptyForm: FormState = {
  name: '',
  contactPerson: '',
  phone: '',
  region: '',
  address: '',
  distributorKind: 'EXTERNAL',
  minOrderQty: '',
  creditLimit: '',
  paymentTermsDays: '14',
  notes: '',
}

export function kindLabel(kind?: string | null) {
  return String(kind || 'EXTERNAL').toUpperCase() === 'INTERNAL' ? 'Internal' : 'External'
}

export function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function CreditBar({ percent, atLimit }: { percent: number; atLimit: boolean }) {
  const width = Math.min(100, Math.max(0, percent))
  const tone =
    atLimit || percent >= 100
      ? 'bg-red-600'
      : percent >= 80
        ? 'bg-amber-500'
        : 'bg-teal-600'
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  )
}

export function unpaidSummary(c: DistributorCredit) {
  const count = c.unpaidCount ?? c.unpaid?.length ?? 0
  if (count > 0) return `${count} unpaid · ${money(c.outstanding)}`
  if (c.outstanding > 0.001) return `Unpaid · ${money(c.outstanding)}`
  return 'No unpaid invoices'
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="dgn-card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-3xl sm:rounded-2xl sm:p-6">
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

export function DistributorsPage() {
  const user = useAuthStore((s) => s.user)
  const canEdit = hasPermission(user, 'sales.create') || hasPermission(user, 'masters.manage')
  const canSell = hasPermission(user, 'sales.create')
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [filter, setFilter] = useState<'all' | 'internal' | 'external' | 'owing' | 'limit'>('all')
  const [addOpen, setAddOpen] = useState(false)

  const distributors = useQuery({
    queryKey: ['distributors'],
    queryFn: async () => {
      const { data } = await api.get('/distributors', { params: { includeInactive: '1' } })
      return data.data as DistributorRow[]
    },
  })

  const filtered = useMemo(() => {
    const rows = distributors.data || []
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (!showInactive && row.isActive === false) return false
      if (filter === 'internal' && String(row.distributorKind || '').toUpperCase() !== 'INTERNAL') {
        return false
      }
      if (filter === 'external' && String(row.distributorKind || '').toUpperCase() === 'INTERNAL') {
        return false
      }
      if (filter === 'owing' && !(row.credit.outstanding > 0.001)) return false
      if (filter === 'limit' && !row.credit.atLimit) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        String(row.phone || '').toLowerCase().includes(q) ||
        String(row.region || '').toLowerCase().includes(q) ||
        String(row.contactPerson || '').toLowerCase().includes(q)
      )
    })
  }, [distributors.data, query, showInactive, filter])

  const totals = useMemo(() => {
    const rows = distributors.data || []
    const active = rows.filter((r) => r.isActive !== false)
    return {
      count: rows.length,
      active: active.length,
      outstanding: active.reduce((sum, r) => sum + (r.credit.outstanding || 0), 0),
      available: active.reduce((sum, r) => sum + (r.credit.available || 0), 0),
      atLimit: active.filter((r) => r.credit.atLimit).length,
      overdue: active.filter((r) => (r.credit.overdueCount || 0) > 0).length,
    }
  }, [distributors.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || null,
        phone: form.phone.trim() || null,
        region: form.region.trim() || null,
        address: form.address.trim() || null,
        distributorKind: form.distributorKind,
        minOrderQty: Number(form.minOrderQty),
        creditLimit: Number(form.creditLimit),
        paymentTermsDays: Number(form.paymentTermsDays || 14),
        notes: form.notes.trim() || null,
      }
      if (!payload.name) throw new Error('Name is required')
      if (!(payload.minOrderQty >= 0) || form.minOrderQty.trim() === '') {
        throw new Error('Set the minimum quantity they can take on a sale.')
      }
      if (!(payload.creditLimit >= 0) || form.creditLimit.trim() === '') {
        throw new Error('Set a credit limit. Use 0 if they must always pay in full.')
      }
      const { data } = await api.post('/distributors', payload)
      return data.data as DistributorRow
    },
    onSuccess: async () => {
      setMessage('Distributor added')
      setError('')
      setForm(emptyForm)
      setAddOpen(false)
      await qc.invalidateQueries({ queryKey: ['distributors'] })
      await qc.invalidateQueries({ queryKey: ['customers'] })
      await qc.invalidateQueries({ queryKey: ['masters', 'customers'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: { data?: { err?: string; errors?: Record<string, string> } }
        message?: string
      }
      const fieldErrors = axiosErr.response?.data?.errors
      setMessage('')
      setError(
        (fieldErrors && Object.values(fieldErrors).join(' · ')) ||
          axiosErr.response?.data?.err ||
          axiosErr.message ||
          'Could not save distributor',
      )
    },
  })

  useEffect(() => {
    if (!message && !error) return
    const t = window.setTimeout(() => {
      setMessage('')
      setError('')
    }, 4000)
    return () => window.clearTimeout(t)
  }, [message, error])

  useEffect(() => {
    if (!addOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAddOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addOpen])

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatPill label="Distributors" value={String(totals.count)} hint={`${totals.active} active`} />
        <StatPill
          label="They owe the factory"
          value={money(totals.outstanding)}
          tone={totals.outstanding > 0 ? 'danger' : 'success'}
        />
        <StatPill label="Credit still open" value={money(totals.available)} tone="accent" />
        <StatPill
          label="Blocked at limit"
          value={String(totals.atLimit)}
          tone={totals.atLimit > 0 ? 'danger' : 'success'}
          hint={totals.overdue ? `${totals.overdue} with overdue invoices` : 'None overdue'}
        />
      </div>

      {canEdit && (
        <div className="mb-4 flex justify-end">
          <button type="button" className="dgn-btn dgn-btn-primary" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add distributor
          </button>
        </div>
      )}

      {(message || error) && (
        <p className={`mb-4 text-sm ${error ? 'text-red-700' : 'text-zinc-800'}`}>{error || message}</p>
      )}

      <Card className="!p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Distributor book</h2>
            <p className="text-sm text-zinc-700">
              {filtered.length} shown
              {distributors.data ? ` · ${distributors.data.length} total` : ''}
            </p>
          </div>
          <div className="w-full sm:w-56">
            <input
              className="dgn-input w-full !rounded-lg !px-3 !py-2 text-sm"
              placeholder="Search name, code, region…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
          </div>
        </div>

        <div className="mt-4 flex w-fit rounded-xl bg-zinc-100 p-1 text-xs font-semibold">
            {(
              [
                ['all', 'All'],
                ['internal', 'Internal'],
                ['external', 'External'],
                ['owing', 'Owing'],
                ['limit', 'At limit'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-lg px-3 py-1.5 ${
                  filter === id ? 'bg-white shadow-sm' : 'text-zinc-700'
                }`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
        </div>

        {distributors.isLoading && (
          <p className="mt-4 py-6 text-center text-sm text-zinc-700">Loading distributors…</p>
        )}
        {!distributors.isLoading && filtered.length === 0 && (
          <p className="mt-4 py-6 text-center text-sm text-zinc-700">
            {distributors.data?.length
              ? 'No distributors match this filter.'
              : 'No distributors yet. Add one to start the book.'}
          </p>
        )}
        {!distributors.isLoading && filtered.length > 0 && (
          <div className="mt-4 -mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-4">Distributor</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4 text-right">Min qty</th>
                  <th className="py-2 pr-4 text-right">Owes</th>
                  <th className="py-2 pr-4 text-right">Limit</th>
                  <th className="py-2 pr-4 text-right">Left</th>
                  <th className="py-2 pr-4">Payment</th>
                  <th className="py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const c = row.credit
                  return (
                    <tr key={row.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="py-3 pr-4">
                        <Link to={`/distributors/${row.code}`} className="hover:underline">
                          <p className="font-semibold tracking-tight">{row.name}</p>
                          <p className="mt-0.5 font-mono text-xs text-zinc-500">{row.code}</p>
                        </Link>
                        {row.isActive === false && (
                          <p className="mt-1 text-xs font-semibold text-zinc-600">Inactive</p>
                        )}
                      </td>
                      <td className="py-3 pr-4">{kindLabel(row.distributorKind)}</td>
                      <td className="py-3 pr-4 text-right">
                        {Number(row.minOrderQty || 0) > 0 ? Number(row.minOrderQty).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right">{money(c.outstanding)}</td>
                      <td className="py-3 pr-4 text-right">{money(c.creditLimit)}</td>
                      <td
                        className={
                          'py-3 pr-4 text-right font-semibold ' +
                          (c.atLimit ? 'text-red-700' : 'text-teal-800')
                        }
                      >
                        {money(c.available)}
                      </td>
                      <td className="py-3 pr-4">
                        {c.creditLimit <= 0 && row.isActive !== false ? (
                          <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-800">
                            Cash only
                          </span>
                        ) : c.atLimit && c.creditLimit > 0 ? (
                          <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                            Credit closed
                          </span>
                        ) : (c.overdueCount || 0) > 0 ? (
                          <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                            {c.overdueCount} overdue
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-700">{unpaidSummary(c)}</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {canSell && row.isActive !== false && (
                          <Link
                            to={`/sales?distributor=${encodeURIComponent(row.code)}`}
                            className="dgn-btn dgn-btn-primary !px-3 !py-1.5 text-sm"
                          >
                            Sell
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {addOpen && (
        <Dialog
          title="Add distributor"
          onClose={() => {
            setAddOpen(false)
            setError('')
          }}
        >
          <p className="mb-4 text-sm text-zinc-700">
            Code is issued automatically. Set the credit limit in naira — that is the most they may
            owe at any time.
          </p>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              saveMutation.mutate()
            }}
          >
            <Field label="Business name">
              <input
                className="dgn-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Northern Plastics Distributors"
              />
            </Field>
            <Field label="Contact person">
              <input
                className="dgn-input"
                value={form.contactPerson}
                onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
              />
            </Field>
            <Field label="Phone">
              <input
                className="dgn-input"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Field>
            <Field label="Region / territory">
              <input
                className="dgn-input"
                value={form.region}
                onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                placeholder="Kano, Kaduna…"
              />
            </Field>
            <Field label="Type">
              <select
                className="dgn-input"
                value={form.distributorKind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    distributorKind: e.target.value === 'INTERNAL' ? 'INTERNAL' : 'EXTERNAL',
                  }))
                }
              >
                <option value="EXTERNAL">External</option>
                <option value="INTERNAL">Internal</option>
              </select>
            </Field>
            <Field
              label="Minimum quantity"
              hint="They cannot take fewer than this many units on a sale"
            >
              <input
                className="dgn-input"
                type="number"
                min={0}
                inputMode="decimal"
                value={form.minOrderQty}
                onChange={(e) => setForm((f) => ({ ...f, minOrderQty: e.target.value }))}
                required
                placeholder="50"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <input
                  className="dgn-input"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Credit limit" hint="0 means they must pay in full on every sale">
              <NairaAmountInput
                value={form.creditLimit}
                onChange={(value) => setForm((f) => ({ ...f, creditLimit: value }))}
                required
                placeholder="2,000,000"
              />
            </Field>
            <Field label="Payment terms (days)">
              <input
                className="dgn-input"
                type="number"
                min={0}
                max={365}
                value={form.paymentTermsDays}
                onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <input
                  className="dgn-input"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </Field>
            </div>
            {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="dgn-btn dgn-btn-primary"
                disabled={saveMutation.isPending || !form.name.trim()}
              >
                {saveMutation.isPending ? 'Saving…' : 'Add distributor'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  )
}
