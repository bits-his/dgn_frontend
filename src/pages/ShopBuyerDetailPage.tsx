import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, ShoppingBag, CreditCard, History } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookPanel, CompactStat, DataRow } from '@/components/outlet/OutletBookUi'
import { useAuthStore } from '@/stores/auth-store'
import { isOutletScoped, outletQuery, shopSalePath } from '@/lib/outlet'
import { money } from '@/pages/DistributorsPage'
import { hasPermission } from '@/lib/auth'
import { cn } from '@/lib/utils'

type BuyerDetail = {
  id: number
  name: string
  phone: string | null
  notes: string | null
  outletCustomerId: number
  saleCount: number
  totalSpent: number
  balanceDue: number
  lastPurchase: string | null
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
  const canCollect = hasPermission(user, 'outlet.sell') || hasPermission(user, 'sales.create')

  const [paySaleId, setPaySaleId] = useState<number | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

  const openSales = useMemo(
    () => (detail.data?.sales || []).filter((s) => Number(s.balanceDue) > 0.001),
    [detail.data],
  )

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
        <Button size="sm" className="h-8 gap-1 text-xs font-semibold" asChild>
          <Link
            to={
              scoped
                ? '/shop/sales/new'
                : `/shop/sales/new?outletId=${outletId}`
            }
          >
            Record sale
          </Link>
        </Button>
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

            {canCollect && openSales.length > 0 && (
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
                          ? ` · ${sale.lines.map((l) => l.productName).filter(Boolean).slice(0, 2).join(', ')}`
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
          </>
        )}
      </div>
    </PageLayout>
  )
}
