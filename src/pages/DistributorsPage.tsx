import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Users, CreditCard, Banknote, Wallet } from 'lucide-react'
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
import { isOutletScoped, outletHomePath } from '@/lib/outlet'
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
  outletStock?: {
    remainingQty: number
    generated: number
    creditOutstanding: number
    saleCount?: number
  }
  credit: DistributorCredit
}

type FormState = {
  name: string
  contactPerson: string
  phone: string
  region: string
  address: string
  distributorKind: 'INTERNAL' | 'EXTERNAL' | 'SHOP'
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
  const k = String(kind || 'EXTERNAL').toUpperCase()
  if (k === 'INTERNAL') return 'Internal'
  if (k === 'SHOP') return 'Market shop'
  return 'External'
}

export function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function unpaidSummary(c: DistributorCredit) {
  const count = c.unpaidCount ?? c.unpaid?.length ?? 0
  const unpaidAmt =
    c.unpaid?.reduce((s, u) => s + Number(u.balanceDue || 0), 0) ?? c.outstanding
  if (count > 0 && unpaidAmt > 0.001) {
    return `${count} unpaid · ${money(unpaidAmt)}`
  }
  if (c.outstanding > 0.001) return `Owes · ${money(c.outstanding)}`
  if ((c.advanceBalance || 0) > 0.001) return 'Invoices covered by advance'
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
  const [filter, setFilter] = useState<'all' | 'internal' | 'external' | 'shop' | 'owing' | 'limit'>(
    'all',
  )
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
      if (filter === 'shop' && String(row.distributorKind || '').toUpperCase() !== 'SHOP') {
        return false
      }
      if (
        filter === 'external' &&
        String(row.distributorKind || '').toUpperCase() !== 'EXTERNAL'
      ) {
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
    const shops = active.filter((r) => String(r.distributorKind || '').toUpperCase() === 'SHOP')
    return {
      count: rows.length,
      active: active.length,
      shops: shops.length,
      outstanding: active.reduce((sum, r) => sum + (r.credit.outstanding || 0), 0),
      revenue: active.reduce(
        (sum, r) =>
          sum +
          (String(r.distributorKind || '').toUpperCase() === 'SHOP'
            ? Number(r.outletStock?.generated || 0)
            : Number(r.credit.revenue || 0)),
        0,
      ),
      collected: active.reduce((sum, r) => sum + (r.credit.collected || 0), 0),
      advance: active.reduce(
        (sum, r) => sum + Number(r.credit.advanceBalance ?? r.advanceBalance ?? 0),
        0,
      ),
      saleCount: active.reduce(
        (sum, r) =>
          sum +
          Number(
            String(r.distributorKind || '').toUpperCase() === 'SHOP'
              ? r.outletStock?.saleCount || 0
              : r.credit.saleCount || 0,
          ),
        0,
      ),
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
        minOrderQty: form.distributorKind === 'SHOP' ? 0 : Number(form.minOrderQty),
        creditLimit: form.distributorKind === 'SHOP' ? 0 : Number(form.creditLimit),
        paymentTermsDays: form.distributorKind === 'SHOP' ? 0 : Number(form.paymentTermsDays || 14),
        notes: form.notes.trim() || null,
      }
      if (!payload.name) throw new Error('Name is required')
      if (form.distributorKind !== 'SHOP') {
        if (!(payload.minOrderQty >= 0) || form.minOrderQty.trim() === '') {
          throw new Error('Set the minimum quantity they can take on a sale.')
        }
        if (!(payload.creditLimit >= 0) || form.creditLimit.trim() === '') {
          throw new Error('Set a credit limit. Use 0 if they must always pay in full.')
        }
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
        header: 'Account',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div>
              <Link
                to={`/distributors/${r.code}`}
                className="inline-flex items-center gap-1.5 font-semibold text-zinc-900 hover:text-zinc-600 hover:underline"
              >
                <span>{r.name}</span>
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-mono text-[11px] text-zinc-400">{r.code}</span>
                {r.region ? (
                  <span className="text-[11px] text-zinc-500">· {r.region}</span>
                ) : null}
                {r.phone ? (
                  <span className="text-[11px] text-zinc-500">· {r.phone}</span>
                ) : null}
                {r.isActive === false ? (
                  <span className="rounded bg-zinc-100 px-1.5 text-[10px] font-semibold text-zinc-600">
                    Inactive
                  </span>
                ) : null}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'distributorKind',
        header: 'Type',
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
            {kindLabel(row.original.distributorKind)}
          </span>
        ),
      },
      {
        id: 'owes',
        header: 'Owes',
        cell: ({ row }) => {
          const isShop = String(row.original.distributorKind || '').toUpperCase() === 'SHOP'
          const amt = isShop
            ? Number(row.original.outletStock?.creditOutstanding || 0)
            : Number(row.original.credit.outstanding || 0)
          return (
            <span
              className={`text-xs font-semibold tabular-nums ${
                amt > 0.001 ? 'text-amber-700' : 'text-zinc-400'
              }`}
            >
              {amt > 0.001 ? money(amt) : '—'}
            </span>
          )
        },
      },
      {
        id: 'advance',
        header: 'Advance',
        cell: ({ row }) => {
          const adv = Number(
            row.original.credit.advanceBalance ?? row.original.advanceBalance ?? 0,
          )
          return (
            <span
              className={`text-xs font-semibold tabular-nums ${
                adv > 0.001 ? 'text-sky-700' : 'text-zinc-400'
              }`}
            >
              {adv > 0.001 ? money(adv) : '—'}
            </span>
          )
        },
      },
      {
        id: 'sales',
        header: 'Sales',
        cell: ({ row }) => {
          const isShop = String(row.original.distributorKind || '').toUpperCase() === 'SHOP'
          const revenue = isShop
            ? Number(row.original.outletStock?.generated || 0)
            : Number(row.original.credit.revenue || 0)
          const count = isShop
            ? Number(row.original.outletStock?.saleCount || 0)
            : Number(row.original.credit.saleCount || 0)
          if (!(revenue > 0.001) && count === 0) {
            return <span className="text-xs text-zinc-400">—</span>
          }
          return (
            <span className="text-xs tabular-nums text-zinc-800">
              <span className="font-semibold">{money(revenue)}</span>
              <span className="block text-[10px] text-zinc-400">{count} orders</span>
            </span>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const c = row.original.credit
          const isShop = String(row.original.distributorKind || '').toUpperCase() === 'SHOP'
          if (isShop) {
            const shopCredit = Number(row.original.outletStock?.creditOutstanding || 0)
            if (shopCredit > 0.001) {
              return (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  Shop credit
                </span>
              )
            }
            return <span className="text-xs text-zinc-500">Active</span>
          }
          if (c.creditLimit <= 0 && row.original.isActive !== false) {
            return (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                Cash only
              </span>
            )
          }
          if (c.atLimit && c.creditLimit > 0) {
            return (
              <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                Limit full
              </span>
            )
          }
          if ((c.overdueCount || 0) > 0) {
            return (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                {c.overdueCount} overdue
              </span>
            )
          }
          if ((c.advanceBalance || 0) > 0.001) {
            return <span className="text-xs font-medium text-sky-700">In credit</span>
          }
          if (c.outstanding > 0.001) {
            return <span className="text-xs text-amber-700">{unpaidSummary(c)}</span>
          }
          return <span className="text-xs text-zinc-500">Clear</span>
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
                  {String(row.original.distributorKind || '').toUpperCase() === 'SHOP'
                    ? 'Issue'
                    : 'Sell'}
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

  if (isOutletScoped(user)) {
    return <Navigate to={outletHomePath(user)} replace />
  }

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
        {/* Compact sales KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2">
          <div className="rounded-lg border border-zinc-200/90 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Accounts
              </span>
              <Users className="size-3 text-zinc-400" />
            </div>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
              {totals.active}
              <span className="ml-1 text-[10px] font-medium text-zinc-400">
                · {totals.shops} shop{totals.shops === 1 ? '' : 's'}
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200/90 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Sales
              </span>
              <Banknote className="size-3 text-teal-600" />
            </div>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
              {money(totals.revenue)}
            </p>
            <p className="text-[10px] text-zinc-400">{totals.saleCount} orders</p>
          </div>

          <div className="rounded-lg border border-zinc-200/90 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Outstanding
              </span>
              <CreditCard
                className={`size-3 ${totals.outstanding > 0.001 ? 'text-amber-600' : 'text-zinc-400'}`}
              />
            </div>
            <p
              className={`mt-0.5 text-sm font-bold tabular-nums ${
                totals.outstanding > 0.001
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-zinc-900 dark:text-white'
              }`}
            >
              {money(totals.outstanding)}
            </p>
            <p className="text-[10px] text-zinc-400">They still owe</p>
          </div>

          <div className="rounded-lg border border-zinc-200/90 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Advance held
              </span>
              <Wallet className="size-3 text-sky-600" />
            </div>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-sky-700 dark:text-sky-400">
              {money(totals.advance)}
            </p>
            <p className="text-[10px] text-zinc-400">
              Collected {money(totals.collected)}
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
                  setFilter(val as 'all' | 'internal' | 'external' | 'shop' | 'owing' | 'limit')
                }
              >
                <SelectTrigger className="w-full h-8 text-xs font-semibold">
                  <SelectValue placeholder="Filter distributors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All distributors ({distributors.data?.length ?? 0})</SelectItem>
                  <SelectItem value="internal">Internal network</SelectItem>
                  <SelectItem value="shop">Market shops</SelectItem>
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
                      distributorKind: val as 'INTERNAL' | 'EXTERNAL' | 'SHOP',
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXTERNAL">External dealer</SelectItem>
                    <SelectItem value="INTERNAL">Internal distributor</SelectItem>
                    <SelectItem value="SHOP">Market shop</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.distributorKind !== 'SHOP' && (
                <>
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
                </>
              )}

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Address</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Store location or warehouse address"
                />
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
