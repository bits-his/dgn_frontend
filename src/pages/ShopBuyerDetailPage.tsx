import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, ShoppingBag, CreditCard, History, Pencil } from 'lucide-react'
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
import { useAuthStore } from '@/stores/auth-store'
import { isOutletScoped, outletQuery, shopSalePath } from '@/lib/outlet'
import { money } from '@/pages/DistributorsPage'
import { hasPermission } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { formatBusinessDate } from '@/lib/dates'

type StatementRow = {
  id: string
  entryType: string
  businessDate: string | null
  saleNumber: string | null
  saleId: number
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
  linkedCustomer?: {
    id: number
    code: string
    name: string
    distributorKind?: string | null
  } | null
  saleCount: number
  totalSpent: number
  balanceDue: number
  lastPurchase: string | null
  statement?: StatementRow[]
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

  const [tab, setTab] = useState<'statement' | 'sales'>('statement')
  const [paySaleId, setPaySaleId] = useState<number | null>(null)
  const [payAmount, setPayAmount] = useState('')
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

  const openSales = useMemo(
    () => (detail.data?.sales || []).filter((s) => Number(s.balanceDue) > 0.001),
    [detail.data],
  )

  const statement = detail.data?.statement || []

  const collect = useMutation({
    mutationFn: async () => {
      if (!paySaleId) throw new Error('Pick a sale')
      const amount = Number(payAmount)
      if (!(amount > 0)) throw new Error('Enter an amount')
      const { data } = await api.post(`/outlet-sales/${paySaleId}/payments`, { amount })
      return data as { message?: string }
    },
    onSuccess: async (body) => {
      setError('')
      setMessage(body.message || 'Payment recorded')
      setPayAmount('')
      setPaySaleId(null)
      await qc.invalidateQueries({ queryKey: ['outlet-buyer', buyerId] })
      await qc.invalidateQueries({ queryKey: ['outlet-overview'] })
      await qc.invalidateQueries({ queryKey: ['outlet-buyers'] })
      await qc.invalidateQueries({ queryKey: ['distributor'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { err?: string } }; message?: string }
      setMessage('')
      setError(axiosErr.response?.data?.err || axiosErr.message || 'Could not collect')
    },
  })

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
  const backTo = scoped ? '/' : shopCode ? `/distributors/${shopCode}` : '/distributors'

  if (!outletId) {
    return (
      <PageLayout title="Customer" description="Shop required" back backTo="/distributors">
        <p className="text-xs text-zinc-500">Open this customer from a shop book.</p>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      bare
      title={d?.name || 'Customer'}
      description={
        d
          ? `${d.saleCount} purchase${d.saleCount === 1 ? '' : 's'}${d.phone ? ` · ${d.phone}` : ''}`
          : 'Shop customer'
      }
      back
      backTo={backTo}
      backLabel={scoped ? 'Dashboard' : 'Shop book'}
      actions={
        <div className="flex items-center gap-1.5">
          {canEdit && d ? (
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
          <Button size="sm" className="h-8 gap-1 text-xs font-semibold" asChild>
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
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <CompactStat
                label="Times bought"
                value={String(d.saleCount)}
                hint="Purchases here"
                icon={ShoppingBag}
                tone="info"
              />
              <CompactStat
                label="Total spent"
                value={money(d.totalSpent)}
                icon={Banknote}
                tone="ok"
              />
              <CompactStat
                label="Owes"
                value={money(d.balanceDue)}
                hint={d.balanceDue > 0.001 ? 'Open credit' : 'Settled'}
                icon={CreditCard}
                tone={d.balanceDue > 0.001 ? 'warn' : 'neutral'}
              />
              <CompactStat
                label="Last buy"
                value={d.lastPurchase || '—'}
                icon={History}
                tone="neutral"
              />
            </div>

            {d.linkedCustomer ? (
              <p className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 text-[11px] text-violet-900">
                Linked distributor{' '}
                <Link
                  to={`/distributors/${d.linkedCustomer.code}`}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  {d.linkedCustomer.name}
                </Link>
                <span className="text-violet-700/80">
                  {' '}
                  — shop sales also post on their main statement
                </span>
              </p>
            ) : null}

            {canEdit && openSales.length > 0 && (
              <BookPanel title="Collect payment">
                <div className="space-y-2.5">
                  <select
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                    value={paySaleId ?? ''}
                    onChange={(e) => {
                      const id = Number(e.target.value) || null
                      setPaySaleId(id)
                      const sale = openSales.find((s) => s.id === id)
                      setPayAmount(sale ? String(sale.balanceDue) : '')
                    }}
                  >
                    <option value="">Select credit sale…</option>
                    {openSales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.saleNumber} · owes {money(s.balanceDue)}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Amount"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="h-10 text-sm"
                    />
                    <Button
                      size="sm"
                      className="h-10 shrink-0 px-4 text-sm font-semibold"
                      disabled={!paySaleId || collect.isPending}
                      onClick={() => collect.mutate()}
                    >
                      {collect.isPending ? 'Saving…' : 'Collect'}
                    </Button>
                  </div>
                </div>
              </BookPanel>
            )}

            <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs font-semibold">
              {(
                [
                  ['statement', 'Statement'],
                  ['sales', `Sales · ${d.sales.length}`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
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
                <header className="flex items-end justify-between gap-3 border-b border-zinc-200 bg-zinc-50/80 px-3.5 py-3 sm:px-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Account statement
                    </p>
                    <p
                      className={cn(
                        'mt-0.5 text-base font-black tabular-nums',
                        d.balanceDue > 0.001 ? 'text-red-700' : 'text-teal-800',
                      )}
                    >
                      {money(d.balanceDue)}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {d.balanceDue > 0.001 ? 'Balance due' : 'Settled'}
                    </p>
                  </div>
                  <p className="max-w-[12rem] text-right text-[10px] leading-snug text-zinc-500">
                    Debit = sale · Credit = paid
                  </p>
                </header>

                {!statement.length ? (
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
                      {statement.map((row) => {
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
                                !isDebit ? 'font-semibold text-zinc-900' : 'text-zinc-300',
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

                <div className="ml-auto w-full max-w-[14rem] space-y-1 px-3.5 py-3 text-xs sm:px-5 sm:py-4 sm:text-sm">
                  <div className="flex items-center justify-between gap-3 border-t border-zinc-300 pt-1.5">
                    <span className="font-semibold text-zinc-900">Balance due</span>
                    <span
                      className={cn(
                        'font-black tabular-nums',
                        d.balanceDue > 0.001 ? 'text-red-700' : 'text-teal-800',
                      )}
                    >
                      {money(d.balanceDue)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
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
            )}
          </>
        )}
      </div>

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
