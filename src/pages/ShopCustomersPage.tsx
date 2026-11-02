import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { useAuthStore } from '@/stores/auth-store'
import {
  isOutletScoped,
  outletQuery,
  shopBuyerPath,
} from '@/lib/outlet'
import {
  ShopCustomersBoard,
  type ShopBuyerRow,
} from '@/components/outlet/ShopCustomersBoard'
import { CreateShopCustomerDialog } from '@/components/outlet/CreateShopCustomerDialog'
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
  const [createOpen, setCreateOpen] = useState(false)

  // Listen to #new hash in url to automatically open create customer dialog
  useEffect(() => {
    if (window.location.hash === '#new') {
      setCreateOpen(true)
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

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
          className="h-9 gap-1.5 px-3 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white shadow-xs cursor-pointer"
          onClick={() => setCreateOpen(true)}
        >
          <UserPlus className="size-3.5" />
          Add customer
        </Button>
      }
    >
      <ShopCustomersBoard
        buyers={d?.rows || []}
        factoryDistributors={d?.factoryDistributors}
        myCustomers={d?.myCustomers}
        onAddCustomer={() => setCreateOpen(true)}
        viewHref={(b) => shopBuyerPath(b.id, outletId, shopCode)}
        emptyHint="No customers yet. Add a customer to start tracking sales and debt."
      />

      <CreateShopCustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        outletId={outletId}
        shopCode={shopCode}
      />
    </PageLayout>
  )
}

