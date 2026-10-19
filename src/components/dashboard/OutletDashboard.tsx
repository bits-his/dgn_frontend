import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Boxes, CreditCard, Banknote, ShoppingBag, ArrowRight, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { PageLayout } from '@/components/PageLayout'
import { useAuthStore } from '@/stores/auth-store'
import { isOutletScoped, outletHomePath, shopBuyerPath, shopSalesListPath } from '@/lib/outlet'
import { money } from '@/pages/DistributorsPage'
import { BookPanel, DataRow } from '@/components/outlet/OutletBookUi'
import {
  ShopCustomersBoard,
  type ShopBuyerRow,
} from '@/components/outlet/ShopCustomersBoard'
import { cn } from '@/lib/utils'

type OutletOverview = {
  outlet: { id: number; code: string; name: string; kind?: string }
  remainingQty: number
  stock: {
    productId: number
    productName: string
    uom: string
    received: number
    sold: number
    remaining: number
  }[]
  money: {
    generated: number
    collected: number
    creditOutstanding: number
    todayGenerated: number
    saleCount: number
  }
  sales: {
    id: number
    saleNumber: string
    outletBuyerId?: number | null
    buyerName: string | null
    saleType: string
    businessDate: string | null
    totalAmount: number
    balanceDue: number
    paymentStatus: string
  }[]
  buyers?: ShopBuyerRow[]
  debtors?: ShopBuyerRow[]
  buyerTotals?: {
    customerCount: number
    debtorCount: number
    creditOutstanding: number
  }
}

export function OutletDashboard() {
  const user = useAuthStore((s) => s.user)
  const overview = useQuery({
    queryKey: ['outlet-overview', user?.outletCustomerId],
    enabled: isOutletScoped(user),
    queryFn: async () => {
      const { data } = await api.get('/outlet-sales/overview')
      return data.data as OutletOverview
    },
    refetchInterval: 30_000,
  })

  const d = overview.data
  const shopName = d?.outlet.name || user?.outlet?.name || 'Your shop'
  const credit = d?.money.creditOutstanding || 0
  const buyers = d?.buyers || []
  const debtors = d?.debtors || []
  const bookHref = outletHomePath(user)

  return (
    <PageLayout
      bare
      title={shopName}
      description="Stall overview"
      actions={
        <Button size="sm" className="h-9 gap-1.5 px-3 text-xs font-semibold shadow-sm" asChild>
          <Link to="/shop/sales/new">
            <Plus className="size-3.5" />
            Record sale
          </Link>
        </Button>
      }
    >
      <div className="w-full space-y-4">
        {/* Primary numbers — today + credit */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-teal-200/70 bg-gradient-to-b from-teal-50/90 to-white p-3.5 sm:p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700/80">
              <ShoppingBag className="size-3" />
              Today
            </div>
            <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-teal-950 sm:text-2xl">
              {money(d?.money.todayGenerated || 0)}
            </p>
            <p className="mt-0.5 text-[11px] text-teal-800/70">Sales recorded today</p>
          </div>
          <div
            className={cn(
              'rounded-2xl border p-3.5 sm:p-4',
              credit > 0.001
                ? 'border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-white'
                : 'border-zinc-200/80 bg-gradient-to-b from-zinc-50 to-white',
            )}
          >
            <div
              className={cn(
                'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider',
                credit > 0.001 ? 'text-amber-800/80' : 'text-zinc-500',
              )}
            >
              <CreditCard className="size-3" />
              Credit out
            </div>
            <p
              className={cn(
                'mt-1.5 text-xl font-bold tabular-nums tracking-tight sm:text-2xl',
                credit > 0.001 ? 'text-amber-950' : 'text-zinc-900',
              )}
            >
              {money(credit)}
            </p>
            <p
              className={cn(
                'mt-0.5 text-[11px]',
                credit > 0.001 ? 'text-amber-800/70' : 'text-zinc-500',
              )}
            >
              {debtors.length
                ? `${debtors.length} customer${debtors.length === 1 ? '' : 's'} owing`
                : 'All settled'}
            </p>
          </div>
        </div>

        {/* Secondary strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-zinc-200/80 bg-white px-2.5 py-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Stock</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
              {Number(d?.remainingQty || 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white px-2.5 py-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Sales</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
              {d?.money.saleCount || 0}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200/80 bg-white px-2.5 py-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Generated</p>
            <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-zinc-900">
              {money(d?.money.generated || 0)}
            </p>
          </div>
        </div>

        <ShopCustomersBoard
          buyers={buyers}
          debtors={debtors}
          viewHref={(b) => shopBuyerPath(b.id)}
          action={
            <Link
              to={bookHref}
              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-teal-800"
            >
              Book <ArrowRight className="size-3" />
            </Link>
          }
        />

        {/* Stock + recent */}
        <div className="grid gap-3 sm:grid-cols-2">
          <BookPanel
            title="Stock on hand"
            action={
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400">
                <Boxes className="size-3" />
                {d?.stock.length || 0} products
              </span>
            }
          >
            {!d?.stock.length ? (
              <p className="py-3 text-xs leading-relaxed text-zinc-500">
                Nothing here yet. Stock appears after the factory issues goods to this shop.
              </p>
            ) : (
              d.stock.slice(0, 6).map((row) => (
                <DataRow
                  key={row.productId}
                  title={row.productName}
                  meta={`${Number(row.sold).toLocaleString()} sold`}
                  value={`${Number(row.remaining).toLocaleString()} ${row.uom}`}
                />
              ))
            )}
            {(d?.stock.length || 0) > 6 ? (
              <Link
                to={bookHref}
                className="mt-2 inline-flex text-[11px] font-semibold text-teal-800"
              >
                See all stock →
              </Link>
            ) : null}
          </BookPanel>

          <BookPanel
            title="Recent sales"
            action={
              <Link to={shopSalesListPath()} className="text-[11px] font-semibold text-teal-800">
                View all {(d?.money.saleCount || 0) > 0 ? d?.money.saleCount : ''} →
              </Link>
            }
          >
            {!d?.sales.length ? (
              <p className="py-3 text-xs leading-relaxed text-zinc-500">
                No sales yet. Tap Record sale to start.
              </p>
            ) : (
              d.sales.slice(0, 6).map((sale) => (
                <DataRow
                  key={sale.id}
                  title={
                    sale.outletBuyerId ? (
                      <Link
                        to={shopBuyerPath(sale.outletBuyerId)}
                        className="font-medium text-zinc-900 hover:text-teal-800"
                      >
                        {sale.buyerName || 'Customer'}
                      </Link>
                    ) : (
                      sale.buyerName || 'Walk-in'
                    )
                  }
                  meta={`${sale.saleNumber} · ${sale.saleType.toLowerCase()}`}
                  value={money(sale.totalAmount)}
                  hint={sale.balanceDue > 0.001 ? `Owes ${money(sale.balanceDue)}` : undefined}
                />
              ))
            )}
          </BookPanel>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-white px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Banknote className="size-3.5 text-zinc-400" />
            Full stall book — customers, stock, every sale
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" asChild>
            <Link to={bookHref}>Open book</Link>
          </Button>
        </div>
      </div>
    </PageLayout>
  )
}
