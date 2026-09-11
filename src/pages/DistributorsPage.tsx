import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Users, CreditCard, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { NairaAmountInput } from '@/components/ui'
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
import { useAuthStore } from '@/stores/auth-store'
import { type UnpaidInvoice } from '@/pages/DistributorPaymentForm'

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
  advanceBalance?: number
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
  advanceBalance?: number
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

export function unpaidSummary(c: DistributorCredit) {
  const count = c.unpaidCount ?? c.unpaid?.length ?? 0
  if (count > 0) return `${count} unpaid · ${money(c.outstanding)}`
  if (c.outstanding > 0.001) return `Unpaid · ${money(c.outstanding)}`
  return 'No unpaid invoices'
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
      setMessage('Distributor added successfully')
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

  const columns = useMemo<ColumnDef<DistributorRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Distributor',
        cell: ({ row }) => (
          <div>
            <Link
              to={`/distributors/${row.original.code}`}
              className="font-semibold text-zinc-900 hover:text-zinc-600 hover:underline inline-flex items-center gap-1.5"
            >
              <span>{row.original.name}</span>
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[11px] text-zinc-400">{row.original.code}</span>
              {row.original.region && (
                <span className="text-[11px] text-zinc-500">· {row.original.region}</span>
              )}
              {row.original.isActive === false && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-600">
                  Inactive
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'distributorKind',
        header: 'Type',
        cell: ({ row }) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
            {kindLabel(row.original.distributorKind)}
          </span>
        ),
      },
      {
        accessorKey: 'minOrderQty',
        header: 'Min Qty',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs text-zinc-700">
            {Number(row.original.minOrderQty || 0) > 0
              ? Number(row.original.minOrderQty).toLocaleString()
              : '—'}
          </span>
        ),
      },
      {
        id: 'outstanding',
        header: 'Owes',
        cell: ({ row }) => (
          <span className="font-semibold text-xs tabular-nums text-zinc-900">
            {money(row.original.credit.outstanding)}
          </span>
        ),
      },
      {
        id: 'creditLimit',
        header: 'Limit',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-600">
            {money(row.original.credit.creditLimit)}
          </span>
        ),
      },
      {
        id: 'available',
        header: 'Available',
        cell: ({ row }) => {
          const c = row.original.credit
          return (
            <span
              className={`font-semibold text-xs tabular-nums ${
                c.atLimit ? 'text-red-700' : 'text-teal-700'
              }`}
            >
              {money(c.available)}
            </span>
          )
        },
      },
      {
        id: 'payment',
        header: 'Payment Status',
        cell: ({ row }) => {
          const c = row.original.credit
          if (c.creditLimit <= 0 && row.original.isActive !== false) {
            return (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                Cash only
              </span>
            )
          }
          if (c.atLimit && c.creditLimit > 0) {
            return (
              <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                Credit closed
              </span>
            )
          }
          if ((c.overdueCount || 0) > 0) {
            return (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                {c.overdueCount} overdue
              </span>
            )
          }
          return <span className="text-xs text-zinc-600">{unpaidSummary(c)}</span>
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            {canSell && row.original.isActive !== false && (
              <Button
                asChild
                size="sm"
                className="h-8 px-2.5 text-xs font-semibold whitespace-nowrap"
              >
                <Link to={`/sales/new?distributor=${encodeURIComponent(row.original.code)}`}>
                  Sell
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold"
            >
              <Link to={`/distributors/${row.original.code}`}>View</Link>
            </Button>
          </div>
        ),
      },
    ],
    [canSell]
  )

  return (
    <PageLayout
      title="Distributors"
      description="Commercial network, credit lines, payments, and receivables"
      actions={
        canEdit ? (
          <Button
            size="sm"
            className="h-8 px-3 text-xs font-semibold gap-1.5"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-3.5" />
            Add distributor
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        {/* Metric Cards: Compact 2 per row on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Total Distributors */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Distributors
                </span>
                <div className="size-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Users className="size-3" />
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate">
                  {totals.count}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium truncate">
                  ({totals.active} active)
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Dealer accounts
            </p>
          </div>

          {/* Outstanding Balance */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Total Outstanding
                </span>
                <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${totals.outstanding > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' : 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400'}`}>
                  <CreditCard className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className={`text-base sm:text-lg font-black tabular-nums tracking-tight truncate block ${totals.outstanding > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-900 dark:text-white'}`}>
                  {money(totals.outstanding)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Owed to factory
            </p>
          </div>

          {/* Credit Available */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Credit Headroom
                </span>
                <div className="size-5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-teal-700 dark:text-teal-400 tabular-nums tracking-tight truncate block">
                  {money(totals.available)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Available to spend
            </p>
          </div>

          {/* At Credit Limit / Overdue */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Blocked / Overdue
                </span>
                <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${totals.atLimit > 0 || totals.overdue > 0 ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                  <AlertTriangle className="size-3" />
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-base sm:text-lg font-black tabular-nums tracking-tight truncate ${totals.atLimit > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
                  {totals.atLimit}
                </span>
                <span className="text-[10px] text-zinc-400 font-medium truncate">
                  at limit
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              {totals.overdue > 0 ? `${totals.overdue} with overdue bills` : 'None overdue'}
            </p>
          </div>
        </div>

        {(message || error) && (
          <div
            className={`p-3 rounded-lg text-xs font-medium ${
              error
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            {error || message}
          </div>
        )}

        {/* Filter controls row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            {/* View filter as Select instead of tab buttons */}
            <div className="w-full sm:w-56">
              <Select
                value={filter}
                onValueChange={(val) =>
                  setFilter(val as 'all' | 'internal' | 'external' | 'owing' | 'limit')
                }
              >
                <SelectTrigger className="w-full h-8 text-xs font-semibold">
                  <SelectValue placeholder="Filter distributors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All distributors ({distributors.data?.length ?? 0})</SelectItem>
                  <SelectItem value="internal">Internal network</SelectItem>
                  <SelectItem value="external">External dealers</SelectItem>
                  <SelectItem value="owing">Owing factory</SelectItem>
                  <SelectItem value="limit">At credit limit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
              <Input
                className="pl-8 h-8 text-xs w-full"
                placeholder="Search name, code, region…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-600 self-end sm:self-center">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              <span>Show inactive</span>
            </label>
          </div>
        </div>

        <CustomTable1
          columns={columns}
          data={filtered}
          loading={distributors.isLoading}
          card
        />

        {/* Add Distributor Modal Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add distributor</DialogTitle>
              <DialogDescription>
                Code is issued automatically. Set the credit limit in naira — that is the most they may
                owe at any time.
              </DialogDescription>
            </DialogHeader>

            <form
              className="grid gap-3 sm:grid-cols-2 mt-2"
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
            >
              <div className="space-y-1">
                <Label className="text-xs">Business name</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Northern Plastics Distributors"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Contact person</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.contactPerson}
                  onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                  placeholder="Alhaji Bello"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="0803 000 0000"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Region / territory</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  placeholder="Kano, Kaduna…"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={form.distributorKind}
                  onValueChange={(val) =>
                    setForm((f) => ({
                      ...f,
                      distributorKind: val as 'INTERNAL' | 'EXTERNAL',
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXTERNAL">External</SelectItem>
                    <SelectItem value="INTERNAL">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Minimum quantity</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={form.minOrderQty}
                  onChange={(e) => setForm((f) => ({ ...f, minOrderQty: e.target.value }))}
                  required
                  placeholder="50"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Address</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Store location or warehouse address"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Credit limit (₦)</Label>
                <NairaAmountInput
                  value={form.creditLimit}
                  onChange={(value) => setForm((f) => ({ ...f, creditLimit: value }))}
                  required
                  placeholder="2,000,000"
                />
                <p className="text-[10px] text-zinc-500">0 means pay in full on every sale</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Payment terms (days)</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  min={0}
                  max={365}
                  value={form.paymentTermsDays}
                  onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
                />
                <p className="text-[10px] text-zinc-500">
                  How many days they have to settle credit sales. Unpaid after this is marked overdue (e.g. 7 = one week).
                </p>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Notes</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional operational notes"
                />
              </div>

              {error && (
                <p className="text-xs font-semibold text-red-600 sm:col-span-2">{error}</p>
              )}

              <div className="flex items-center justify-end gap-2 sm:col-span-2 mt-3 pt-3 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs font-semibold"
                  disabled={saveMutation.isPending || !form.name.trim()}
                >
                  {saveMutation.isPending ? 'Saving…' : 'Add distributor'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  )
}
