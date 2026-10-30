import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { useAuthStore } from '@/stores/auth-store'
import {
  isOutletScoped,
  outletQuery,
  shopBuyerPath,
  shopCustomersPath,
} from '@/lib/outlet'
import {
  ShopCustomersBoard,
  type ShopBuyerRow,
} from '@/components/outlet/ShopCustomersBoard'
import { Button } from '@/components/ui/button'

type BuyersList = {
  rows: ShopBuyerRow[]
  factoryDistributors?: ShopBuyerRow[]
  myCustomers?: ShopBuyerRow[]
  debtors?: ShopBuyerRow[]
  totals?: {
    customerCount: number
    debtorCount: number
    creditOutstanding: number
  }
}

export function ShopCustomersPage() {
  const user = useAuthStore((s) => s.user)
  const [search] = useSearchParams()
  const outletIdParam = search.get('outletId')
  const shopCode = search.get('shopCode')

  // When outlet-scoped we use outletCustomerId; otherwise use url param for admin view
  const outletId = outletIdParam
    ? Number(outletIdParam)
    : isOutletScoped(user)
    ? Number(user?.outletCustomerId)
    : null

  const buyers = useQuery({
    queryKey: ['shop-buyers', outletId],
    queryFn: async () => {
      const { data } = await api.get('/outlet-sales/buyers', {
        params: outletQuery(outletId),
      })
      return data.data as BuyersList
    },
    refetchInterval: 30_000,
  })

  const d = buyers.data
  const totalCount =
    d?.totals?.customerCount ??
    (d?.rows?.length ?? 0)

  return (
    <PageLayout
      bare
      title="Customers"
      description={
        totalCount
          ? `${totalCount} customer${totalCount === 1 ? '' : 's'}`
          : 'All your buyers'
      }
      actions={
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 px-3 text-xs font-semibold"
          asChild
        >
          <Link
            to={shopCustomersPath(outletId, shopCode) + '#new'}
            // We don't have a create-customer dialog here yet;
            // for now this just focuses the board which has inline add.
          >
            <UserPlus className="size-3.5" />
            Add customer
          </Link>
        </Button>
      }
    >
      <ShopCustomersBoard
        buyers={d?.rows || []}
        factoryDistributors={d?.factoryDistributors}
        myCustomers={d?.myCustomers}
        viewHref={(b) => shopBuyerPath(b.id, outletId, shopCode)}
        emptyHint="No customers yet. Add a buyer to start selling on credit."
      />
    </PageLayout>
  )
}

