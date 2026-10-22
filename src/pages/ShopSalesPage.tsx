import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import {
  isOutletScoped,
  outletHomePath,
  outletQuery,
  shopRecordSalePath,
  shopSalePath,
} from '@/lib/outlet'
import { formatBusinessDate } from '@/lib/dates'
import { money } from '@/pages/DistributorsPage'
import { cn } from '@/lib/utils'

type SaleRow = {
  id: number
  saleNumber: string
  outletBuyerId: number | null
  buyerName: string | null
  saleType: string
  businessDate: string | null
  totalAmount: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  soldBy: string | null
}

type Filter = 'all' | 'unpaid' | 'paid'

export function ShopSalesPage() {
  const user = useAuthStore((s) => s.user)
  const [searchParams] = useSearchParams()
  const scoped = isOutletScoped(user)
  const outletIdParam = Number(searchParams.get('outletId') || 0) || null
  const shopCode = searchParams.get('shopCode')
  const effectiveOutletId = scoped ? Number(user?.outletCustomerId) : outletIdParam
  const [filter, setFilter] = useState<Filter>('all')

  const sales = useQuery({
    queryKey: ['outlet-sales-list', effectiveOutletId, filter],
    enabled: Boolean(effectiveOutletId),
    queryFn: async () => {
      const { data } = await api.get('/outlet-sales', {
        params: {
          ...outletQuery(scoped ? null : effectiveOutletId),
          filter,
          limit: 150,
        },
      })
      return data as { data: SaleRow[]; meta: { total: number } }
    },
  })

  const rows = sales.data?.data || []
  const total = sales.data?.meta?.total ?? rows.length

  const backTo = useMemo(() => {
    if (scoped) return outletHomePath(user)
    if (shopCode) return `/distributors/${shopCode}`
    return '/distributors'
  }, [scoped, user, shopCode])

  if (!effectiveOutletId) {
    return (
      <PageLayout title="Shop sales" description="Pick a market shop first" back backTo="/distributors">
        <p className="text-sm text-zinc-600">Open a shop book, then use View all sales.</p>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Shop sales"
      description={`${total} sale${total === 1 ? '' : 's'} at this outlet`}
      back
      backTo={backTo}
      backLabel="Shop book"
      actions={
        <Button asChild size="sm" className="h-8 gap-1.5 px-3 text-xs font-semibold">
          <Link to={shopRecordSalePath(scoped ? null : effectiveOutletId)}>
            <Plus className="size-3.5" />
            Record sale
          </Link>
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'unpaid', label: 'Unpaid' },
              { id: 'paid', label: 'Paid' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                filter === f.id
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {sales.isLoading ? (
          <p className="py-8 text-center text-xs text-zinc-500">Loading sales…</p>
        ) : !rows.length ? (
          <p className="rounded-lg border border-dashed border-zinc-200 bg-white py-10 text-center text-xs text-zinc-500">
            No sales in this filter yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {rows.map((sale) => {
                const owes = sale.balanceDue > 0.001
                return (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to={shopSalePath(sale.saleNumber)}
                          className="truncate text-sm font-semibold text-zinc-900 hover:text-teal-800 hover:underline"
                        >
                          {sale.buyerName || 'Walk-in'}
                        </Link>
                        {owes ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                            Credit {money(sale.balanceDue)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {formatBusinessDate(sale.businessDate) || '—'}
                        {' · '}
                        <span className="font-mono">{sale.saleNumber}</span>
                        {' · '}
                        {String(sale.saleType || '').toLowerCase()}
                        {sale.soldBy ? ` · ${sale.soldBy}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-zinc-900">
                          {money(sale.totalAmount)}
                        </p>
                        {!owes ? (
                          <p className="text-[11px] text-teal-700">Paid</p>
                        ) : null}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs font-semibold"
                        asChild
                      >
                        <Link to={shopSalePath(sale.saleNumber)}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            {total > rows.length ? (
              <p className="border-t border-zinc-100 px-3 py-2 text-center text-[11px] text-zinc-500 dark:border-zinc-800">
                Showing {rows.length} of {total}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </PageLayout>
  )
}
