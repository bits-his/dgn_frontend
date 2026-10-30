import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  ShoppingBag,
  CreditCard,
  Pencil,
  Wallet,
  Building2,
  ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BookPanel, CompactStat, DataRow } from '@/components/outlet/OutletBookUi'
import { ShopPaymentModal } from '@/components/outlet/ShopPaymentModal'
import { useAuthStore } from '@/stores/auth-store'
import { isOutletScoped, outletQuery, shopCustomersPath, shopSalePath } from '@/lib/outlet'
import { money } from '@/pages/DistributorsPage'
import { hasPermission } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { formatBusinessDate } from '@/lib/dates'

type StatementRow = {
  id: string
  entryType?: string
  type?: string
  businessDate: string | null
  createdAt?: string | Date | null
  saleNumber: string | null
  saleId?: number | null
  rawId?: number | null
  title: string
  meta: string | null
  debit: number
  credit: number
  balanceAfter: number
}

type BuyerDetail = {
  id: number
  name: string
  phone: string | null
  notes: string | null
  isActive?: boolean
  outletCustomerId: number
  linkedCustomerId?: number | null
  distributorCode?: string | null
  isFactoryDistributor?: boolean
  linkedCustomer?: {
    id: number
    code: string
    name: string
    phone?: string | null
    distributorKind?: string | null
    advanceBalance?: number
    creditLimit?: number
    paymentTermsDays?: number
  } | null
  saleCount: number
  totalSpent: number
  balanceDue: number
  advanceBalance?: number
  lastPurchase: string | null
  statement?: StatementRow[]
  openSales?: {
    saleNumber: string
    businessDate: string | null
    totalAmount: number
    amountPaid: number
    balanceDue: number
    paymentStatus: string
    saleType: string
  }[]
  sales: {
    id: number
    saleNumber: string
    saleType: string
    businessDate: string | null
    totalAmount: number
    amountPaid: number
    balanceDue: number
    paymentStatus: string
    lines: {
      id: number
      productName: string | null
      qty: number
      uom: string
      lineTotal: number
    }[]
  }[]
  payments?: {
    id: number
    amount: number
    paymentMethod: string
    reference: string | null
    businessDate: string | null
    notes: string | null
    saleNumber: string | null
    createdAt?: string
    createdBy?: string | null
  }[]
}

export function ShopBuyerDetailPage() {
  const { buyerId } = useParams()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const scoped = isOutletScoped(user)
  const outletIdParam = Number(searchParams.get('outletId') || 0) || null
  const shopCode = searchParams.get('shopCode') || user?.outlet?.code || null
  const outletId = scoped ? Number(user?.outletCustomerId) : outletIdParam
  const canEdit = hasPermission(user, 'outlet.sell') || hasPermission(user, 'sales.create')

  const [tab, setTab] = useState<'statement' | 'sales' | 'payments' | 'factory'>('statement')
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '', notes: '' })
  const [editError, setEditError] = useState('')

  const detail = useQuery({
    queryKey: ['outlet-buyer', buyerId, outletId],
    enabled: Boolean(buyerId && outletId),
    queryFn: async () => {
      const { data } = await api.get(`/outlet-sales/buyers/${buyerId}`, {
        params: outletQuery(scoped ? null : outletId),
      })
      return data.data as BuyerDetail
    },
  })

  useEffect(() => {
    if (!detail.data) return
    setEditForm({
      name: detail.data.name || '',
      phone: detail.data.phone || '',
      notes: detail.data.notes || '',
    })
  }, [detail.data])

  const [statementOrder, setStatementOrder] = useState<'oldest' | 'newest'>('oldest')

  // Calculate the running balance mathematically: plus debit, minus credit
  const statementRows = useMemo(() => {
    const raw = detail.data?.statement || []
    if (!raw.length) return []

    // 1. Sort strictly in chronological order (oldest first)
    const chronological = [...raw].sort((a, b) => {
      const da = String(a.businessDate || '')
      const db = String(b.businessDate || '')
      if (da !== db) return da.localeCompare(db)

      const saleA = a.type === 'SALE' ? (a.rawId || a.saleId) : (a.saleId || null)
      const saleB = b.type === 'SALE' ? (b.rawId || b.saleId) : (b.saleId || null)
      if (saleA && saleB && saleA === saleB) {
        const ordA = a.type === 'SALE' ? 1 : 2
        const ordB = b.type === 'SALE' ? 1 : 2
        if (ordA !== ordB) return ordA - ordB
      }
      if (saleA && saleB && saleA !== saleB) {
        return Number(saleA) - Number(saleB)
      }

      const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0
      if (ca !== cb && ca > 0 && cb > 0) return ca - cb

      const ordA = a.type === 'SALE' ? 1 : 2
      const ordB = b.type === 'SALE' ? 1 : 2
      if (ordA !== ordB) return ordA - ordB

      return (Number(a.rawId || a.saleId) || 0) - (Number(b.rawId || b.saleId) || 0)
    })

    // 2. Compute running balance top-to-bottom:
    // Starts at 0: debit increases (+), credit decreases (-)
    let running = 0
    const computed = chronological.map((row) => {
      const debit = Number(row.debit || 0)
      const credit = Number(row.credit || 0)
      running = +(running + debit - credit).toFixed(2)
      return {
        ...row,
        balanceAfter: running,
      }
    })

    return statementOrder === 'newest' ? [...computed].reverse() : computed
  }, [detail.data?.statement, statementOrder])

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!outletId) throw new Error('Shop required')
      const name = editForm.name.trim()
      if (!name) throw new Error('Enter the customer name')
      const { data } = await api.patch(`/outlet-sales/buyers/${buyerId}`, {
        outletCustomerId: outletId,
        name,
        phone: editForm.phone.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      return data as { message?: string; data: BuyerDetail }
    },
    onSuccess: async (body) => {
      setEditOpen(false)
      setEditError('')
      setMessage(body.message || 'Customer updated')
      await qc.invalidateQueries({ queryKey: ['outlet-buyer', buyerId] })
      await qc.invalidateQueries({ queryKey: ['outlet-buyers'] })
      await qc.invalidateQueries({ queryKey: ['outlet-overview'] })
      await qc.invalidateQueries({ queryKey: ['distributor'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { err?: string } }; message?: string }
      setEditError(axiosErr.response?.data?.err || axiosErr.message || 'Could not save')
    },
  })

  const d = detail.data
  const backTo = shopCustomersPath(scoped ? null : outletId, shopCode)

  const advanceBalance = Number(d?.advanceBalance || 0)
  const balanceDue = Number(d?.balanceDue || 0)

  const openSalesForModal = useMemo(
    () => d?.openSales || (d?.sales || []).filter((s) => Number(s.balanceDue) > 0.001).map(s => ({
      saleNumber: s.saleNumber,
      businessDate: s.businessDate,
      totalAmount: s.totalAmount,
      amountPaid: s.amountPaid,
      balanceDue: s.balanceDue,
      paymentStatus: s.paymentStatus,
      saleType: s.saleType,
    })),
    [d],
  )

  if (!outletId) {
    return (
      <PageLayout
        title="Customer"
        description="Shop required"
        back
        backTo={shopCustomersPath()}
        backLabel="Customers"
      >
        <p className="text-xs text-zinc-500">Open this customer from a shop book.</p>
      </PageLayout>
    )
  }

  const isFactory = Boolean(d?.isFactoryDistributor || d?.linkedCustomerId)

  return (
    <PageLayout
      bare
      title={d?.name || 'Customer'}
      description={
        d
          ? `${d.saleCount} purchase${d.saleCount === 1 ? '' : 's'}${d.phone ? ` · ${d.phone}` : ''}${
              isFactory
                ? ` · Factory Distributor (${d.distributorCode || d.linkedCustomer?.code || 'linked'})`
                : ''
            }`
          : 'Shop customer'
      }
      back
      backTo={backTo}
      backLabel="Customers"
      actions={
        <div className="flex items-center gap-1.5">
          {canEdit && d ? (
            <>
              {!isFactory ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 px-2.5 text-xs font-semibold"
                  onClick={() => {
                    setEditError('')
                    setEditOpen(true)
                  }}
                >
                  <Pencil className="size-3" />
                  Edit
                </Button>
              ) : null}
              <Button
                size="sm"
                className="h-8 gap-1 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white"
                onClick={() => {
                  setMessage('')
                  setError('')
                  setPayModalOpen(true)
                }}
              >
                <Banknote className="size-3.5" />
                Record payment
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs font-semibold" asChild>
            <Link
              to={
                scoped ? '/shop/sales/new' : `/shop/sales/new?outletId=${outletId}`
              }
            >
              Record sale
            </Link>
          </Button>
        </div>
      }
    >
      <div className="w-full space-y-4">
        {(message || error) && (
          <p
            className={cn(
              'rounded-xl border px-3 py-2 text-xs font-medium',
              error
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-teal-200 bg-teal-50 text-teal-900',
            )}
          >
            {error || message}
          </p>
        )}

        {detail.isLoading && <p className="text-xs text-zinc-500">Loading customer…</p>}
        {detail.isError && (
          <p className="text-xs text-red-700">Could not load this customer.</p>
        )}

        {d && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <CompactStat
                label="Times bought"
                value={String(d.saleCount)}
                hint="Purchases at this stall"
                icon={ShoppingBag}
                tone="info"
              />
              <CompactStat
                label="Total spent"
                value={money(d.totalSpent)}
                hint="At this stall"
                icon={Banknote}
                tone="ok"
              />
              <CompactStat
                label="Owes at stall"
                value={money(balanceDue)}
                hint={balanceDue > 0.001 ? (isFactory ? 'Unpaid stall sales' : 'Open credit') : 'Stall debt settled'}
                icon={CreditCard}
                tone={balanceDue > 0.001 ? 'warn' : 'neutral'}
              />
              <CompactStat
                label={isFactory ? 'Company advance' : 'Advance held'}
                value={advanceBalance > 0.001 ? money(advanceBalance) : '—'}
                hint={
                  advanceBalance > 0.001
                    ? isFactory
                      ? 'Factory deposit wallet'
                      : 'Stall wallet balance'
                    : 'No advance'
                }
                icon={Wallet}
                tone={advanceBalance > 0.001 ? 'info' : 'neutral'}
              />
            </div>

            {isFactory ? (
              <div className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50/70 p-3 sm:flex-row sm:items-center sm:justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-semibold text-violet-950">
                    <Building2 className="size-4 text-violet-600 shrink-0" />
                    <span>Factory Distributor Account · {d.distributorCode || d.linkedCustomer?.code || 'Linked'}</span>
                  </div>
                  <p className="text-[11px] text-violet-800 leading-snug">
                    Profile managed by factory head office. Purchases here draw from their company advance wallet or stall credit.
                    Factory orders & bank deposits stay on their company ledger.
                  </p>
                </div>
                {!scoped && d.linkedCustomer?.code ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 gap-1 border-violet-300 bg-white text-xs font-semibold text-violet-800 hover:bg-violet-100"
                    asChild
                  >
                    <Link to={`/distributors/${d.linkedCustomer.code}`}>
                      View factory ledger
                      <ExternalLink className="size-3" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}

            {/* Tab bar */}
            <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs font-semibold">
              {(
                [
                  ['statement', isFactory ? 'Stall statement' : 'Statement'],
                  ['sales', `Stall sales · ${d.sales.length}`],
                  ['payments', `Stall payments · ${(d.payments || []).length}`],
                  ...(isFactory ? [['factory', 'Factory account']] : []),
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id as typeof tab)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-2 transition-colors',
                    tab === id
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'statement' ? (
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <header className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 bg-zinc-50/80 px-3.5 py-3 sm:px-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {isFactory ? 'Stall Statement · This Shop Only' : 'Account statement'}
                    </p>
                    <p
                      className={cn(
                        'mt-0.5 text-base font-black tabular-nums',
                        balanceDue > 0.001 ? 'text-red-700' : 'text-teal-800',
                      )}
                    >
                      {money(balanceDue)}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {balanceDue > 0.001
                        ? isFactory
                          ? 'Balance due at this stall'
                          : 'Balance due'
                        : 'Stall debt settled'}
                      {advanceBalance > 0.001
                        ? ` · ${money(advanceBalance)} ${isFactory ? 'company advance available' : 'advance held'}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 text-[11px] font-medium shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setStatementOrder('oldest')}
                        className={cn(
                          'rounded px-2.5 py-1 transition-colors',
                          statementOrder === 'oldest'
                            ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900',
                        )}
                      >
                        Oldest first
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatementOrder('newest')}
                        className={cn(
                          'rounded px-2.5 py-1 transition-colors',
                          statementOrder === 'newest'
                            ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900',
                        )}
                      >
                        Newest first
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-400 hidden sm:block">
                      Debit (+) · Credit (−)
                    </p>
                  </div>
                </header>

                {!statementRows.length ? (
                  <p className="px-3.5 py-6 text-center text-xs text-zinc-500 sm:px-5">
                    No transactions yet.
                  </p>
                ) : (
                  <div className="border-b border-zinc-200">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-2 border-b border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:px-4">
                      <span>Particulars</span>
                      <span className="w-14 text-right sm:w-20">Debit</span>
                      <span className="w-14 text-right sm:w-20">Credit</span>
                      <span className="w-14 text-right sm:w-20">Balance</span>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {statementRows.map((row) => {
                        const isDebit = row.debit > 0.001
                        return (
                          <div
                            key={row.id}
                            className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-2 px-2.5 py-2 text-xs sm:px-4 sm:text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-zinc-900">
                                {row.title}
                                {row.saleNumber ? (
                                  <>
                                    {' · '}
                                    <Link
                                      to={shopSalePath(row.saleNumber)}
                                      className="text-teal-800 hover:underline"
                                    >
                                      {row.saleNumber}
                                    </Link>
                                  </>
                                ) : null}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-zinc-500 sm:text-[11px]">
                                {formatBusinessDate(row.businessDate) || '—'}
                                {row.meta ? ` · ${row.meta}` : ''}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'w-14 text-right tabular-nums sm:w-20',
                                isDebit ? 'font-semibold text-zinc-900' : 'text-zinc-300',
                              )}
                            >
                              {isDebit ? money(row.debit) : '—'}
                            </span>
                            <span
                              className={cn(
                                'w-14 text-right tabular-nums sm:w-20',
                                !isDebit ? 'font-semibold text-teal-800' : 'text-zinc-300',
                              )}
                            >
                              {!isDebit ? money(row.credit) : '—'}
                            </span>
                            <span className="w-14 text-right tabular-nums text-zinc-700 sm:w-20">
                              {money(row.balanceAfter)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="ml-auto w-full max-w-[15rem] space-y-1 px-3.5 py-3 text-xs sm:px-5 sm:py-4 sm:text-sm">
                  <div className="flex items-center justify-between gap-3 border-t border-zinc-300 pt-1.5">
                    <span className="font-semibold text-zinc-900">
                      {isFactory ? 'Stall balance due' : 'Balance due'}
                    </span>
                    <span
                      className={cn(
                        'font-black tabular-nums',
                        balanceDue > 0.001 ? 'text-red-700' : 'text-teal-800',
                      )}
                    >
                      {money(balanceDue)}
                    </span>
                  </div>
                  {advanceBalance > 0.001 ? (
                    <div className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="text-zinc-500">
                        {isFactory ? 'Company advance wallet' : 'Advance wallet'}
                      </span>
                      <span className="font-semibold tabular-nums text-sky-700">
                        {money(advanceBalance)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : tab === 'payments' ? (
              <BookPanel title="Payment history">
                {!(d.payments || []).length ? (
                  <p className="py-3 text-xs text-zinc-500">No payments recorded yet.</p>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {(d.payments || []).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2 text-xs gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-teal-800 tabular-nums">
                              {money(p.amount)}
                            </span>
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                              {p.paymentMethod}
                            </span>
                            {p.saleNumber ? (
                              <Link
                                to={shopSalePath(p.saleNumber)}
                                className="text-[11px] text-teal-700 hover:underline font-mono"
                              >
                                {p.saleNumber}
                              </Link>
                            ) : null}
                          </div>
                          {p.reference ? (
                            <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                              Ref: {p.reference}
                            </p>
                          ) : null}
                          {p.notes ? (
                            <p className="text-[10px] text-zinc-400 mt-0.5">{p.notes}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right text-[11px] text-zinc-500">
                          <span className="block">{p.businessDate || '—'}</span>
                          {p.createdBy ? (
                            <span className="text-[10px] text-zinc-400">By {p.createdBy}</span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </BookPanel>
            ) : tab === 'sales' ? (
              <BookPanel title="Purchase history">
                {!d.sales.length ? (
                  <p className="py-3 text-xs text-zinc-500">No sales yet.</p>
                ) : (
                  d.sales.map((sale) => (
                    <Link
                      key={sale.id}
                      to={shopSalePath(sale.saleNumber)}
                      className="block -mx-0.5 rounded-md px-0.5 transition-colors hover:bg-zinc-50"
                    >
                      <DataRow
                        title={sale.saleNumber}
                        meta={`${sale.businessDate || '—'} · ${sale.saleType.toLowerCase()}${
                          sale.lines[0]?.productName
                            ? ` · ${sale.lines
                                .map((l) => l.productName)
                                .filter(Boolean)
                                .slice(0, 2)
                                .join(', ')}`
                            : ''
                        }`}
                        value={money(sale.totalAmount)}
                        hint={
                          sale.balanceDue > 0.001
                            ? `Owes ${money(sale.balanceDue)} · View →`
                            : 'Invoice / receipt →'
                        }
                      />
                    </Link>
                  ))
                )}
              </BookPanel>
            ) : tab === 'factory' && isFactory ? (
              <BookPanel title="Factory Distributor Account Details">
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DataRow title="Distributor code" value={d.distributorCode || d.linkedCustomer?.code || '—'} />
                    <DataRow title="Account name" value={d.linkedCustomer?.name || d.name} />
                    <DataRow title="Phone" value={d.linkedCustomer?.phone || d.phone || '—'} />
                    <DataRow title="Account type" value={d.linkedCustomer?.distributorKind || 'EXTERNAL'} />
                    <DataRow
                      title="Company advance wallet"
                      value={advanceBalance > 0.001 ? money(advanceBalance) : '₦0.00'}
                    />
                    <DataRow
                      title="Factory credit limit"
                      value={
                        d.linkedCustomer?.creditLimit
                          ? money(d.linkedCustomer.creditLimit)
                          : 'No limit set'
                      }
                    />
                    <DataRow
                      title="Payment terms"
                      value={`${d.linkedCustomer?.paymentTermsDays || 14} days`}
                    />
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-1.5">
                    <p className="font-semibold text-zinc-900">About Factory Accounts at Stalls</p>
                    <p className="text-zinc-600 text-[11px] leading-relaxed">
                      This customer is a company distributor registered at factory headquarters. When they shop here, any available company advance is automatically applied to their stall purchases.
                      Stall debt and stall payments are tracked locally on this stall’s statement and also synchronized to their central ledger. Factory-direct invoices, factory dispatches, and bank payments to company accounts are managed exclusively by head office finance.
                    </p>
                  </div>

                  {!scoped && d.linkedCustomer?.code ? (
                    <div className="pt-2">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs font-semibold" asChild>
                        <Link to={`/distributors/${d.linkedCustomer.code}`}>
                          <ExternalLink className="size-3.5" />
                          Open full factory distributor ledger
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </BookPanel>
            ) : null}
          </>
        )}
      </div>

      {/* Record Payment Modal */}
      {d ? (
        <ShopPaymentModal
          open={payModalOpen}
          onOpenChange={setPayModalOpen}
          buyerId={d.id}
          buyerName={d.name}
          isFactoryDistributor={Boolean(d.isFactoryDistributor || d.linkedCustomerId)}
          distributorCode={d.distributorCode || d.linkedCustomer?.code}
          totalDebt={balanceDue}
          advanceBalance={advanceBalance}
          unpaid={openSalesForModal}
          onSuccess={async () => {
            setMessage('Payment recorded successfully')
            await qc.invalidateQueries({ queryKey: ['outlet-buyer', buyerId] })
            await qc.invalidateQueries({ queryKey: ['outlet-overview'] })
            await qc.invalidateQueries({ queryKey: ['outlet-buyers'] })
            await qc.invalidateQueries({ queryKey: ['distributor'] })
          }}
        />
      ) : null}

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>Update name, phone, or notes for this shop account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="h-9 text-xs"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">Phone</label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                className="h-9 text-xs"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">Notes</label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                className="h-9 text-xs"
                placeholder="Optional"
              />
            </div>
            {editError && (
              <div className="rounded-lg bg-red-50 px-2.5 py-2 text-[11px] font-medium text-red-700">
                {editError}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-1 text-xs"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 flex-1 text-xs font-semibold"
                disabled={saveEdit.isPending || !editForm.name.trim()}
                onClick={() => saveEdit.mutate()}
              >
                {saveEdit.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
