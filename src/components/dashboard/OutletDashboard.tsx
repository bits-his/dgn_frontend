import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Boxes, CreditCard, Banknote, ShoppingBag, ArrowRight, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { PageLayout } from '@/components/PageLayout'
import { useAuthStore } from '@/stores/auth-store'
import { isOutletScoped, outletHomePath } from '@/lib/outlet'
import { money } from '@/pages/DistributorsPage'
import { BookPanel, CompactStat, DataRow } from '@/components/outlet/OutletBookUi'

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
    buyerName: string | null
    saleType: string
    businessDate: string | null
    totalAmount: number
    balanceDue: number
    paymentStatus: string
  }[]
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

  return (
    <PageLayout
      bare
      title={shopName}
      description="Your stall · stock, sales, and cash"
      actions={
        <Button size="sm" className="h-8 gap-1 text-xs font-semibold" asChild>
          <Link to="/shop/sales/new">
            <Plus className="size-3.5" />
            Record sale
          </Link>
        </Button>
      }
    >
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <CompactStat
            label="Stock left"
            value={Number(d?.remainingQty || 0).toLocaleString()}
            hint="At this stall"
            icon={Boxes}
            tone="info"
          />
          <CompactStat
            label="Today"
            value={money(d?.money.todayGenerated || 0)}
            hint="Recorded today"
            icon={ShoppingBag}
            tone="ok"
          />
          <CompactStat
            label="Generated"
            value={money(d?.money.generated || 0)}
            hint={`${d?.money.saleCount || 0} sales`}
            icon={Banknote}
            tone="ok"
          />
          <CompactStat
            label="Credit out"
            value={money(credit)}
            hint="Customers owing"
            icon={CreditCard}
            tone={credit > 0.001 ? 'warn' : 'neutral'}
          />
        </div>

        <div className="grid gap-2.5 lg:grid-cols-2">
          <BookPanel
            title="Stock on hand"
            action={
              <Link
                to={outletHomePath(user)}
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-800"
              >
                Full book <ArrowRight className="size-3" />
              </Link>
            }
          >
            {!d?.stock.length ? (
              <p className="text-xs text-zinc-500">
                Nothing here yet. Stock appears after the factory issues goods to this shop.
              </p>
            ) : (
              d.stock.map((row) => (
                <DataRow
                  key={row.productId}
                  title={row.productName}
                  meta={`${Number(row.received).toLocaleString()} in · ${Number(row.sold).toLocaleString()} sold`}
                  value={`${Number(row.remaining).toLocaleString()} ${row.uom}`}
                />
              ))
            )}
          </BookPanel>

          <BookPanel
            title="Recent sales"
            action={
              <Link to="/shop/sales/new" className="text-[11px] font-semibold text-amber-800">
                New
              </Link>
            }
          >
            {!d?.sales.length ? (
              <p className="text-xs text-zinc-500">No sales recorded yet.</p>
            ) : (
              d.sales.slice(0, 8).map((sale) => (
                <DataRow
                  key={sale.id}
                  title={sale.buyerName || 'Walk-in'}
                  meta={`${sale.saleNumber} · ${sale.saleType.toLowerCase()}`}
                  value={money(sale.totalAmount)}
                  hint={sale.balanceDue > 0.001 ? `Owes ${money(sale.balanceDue)}` : undefined}
                />
              ))
            )}
          </BookPanel>
        </div>
      </div>
    </PageLayout>
  )
}
