import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { BookPanel } from '@/components/outlet/OutletBookUi'
import { money } from '@/pages/DistributorsPage'
import { cn } from '@/lib/utils'

export type ShopBuyerRow = {
  id: number
  name: string
  phone?: string | null
  saleCount: number
  totalSpent?: number
  balanceDue: number
  lastPurchase?: string | null
}

function BuyerRow({
  buyer,
  href,
  trailing,
  emphasizeDebt,
}: {
  buyer: ShopBuyerRow
  href: string
  trailing?: ReactNode
  emphasizeDebt?: boolean
}) {
  return (
    <Link
      to={href}
      className="group flex items-center gap-3 border-b border-zinc-100 py-2.5 last:border-0 last:pb-0 first:pt-0 transition-colors hover:bg-zinc-50/80 -mx-1 px-1 rounded-md"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold uppercase tracking-wide text-zinc-600 group-hover:bg-teal-50 group-hover:text-teal-800">
        {buyer.name.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-900">{buyer.name}</p>
        <p className="truncate text-[11px] text-zinc-500">
          {buyer.saleCount} purchase{buyer.saleCount === 1 ? '' : 's'}
          {buyer.phone ? ` · ${buyer.phone}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {trailing ?? (
          <>
            <p
              className={cn(
                'text-sm font-semibold tabular-nums',
                emphasizeDebt && buyer.balanceDue > 0.001 ? 'text-amber-800' : 'text-zinc-900',
              )}
            >
              {buyer.balanceDue > 0.001
                ? money(buyer.balanceDue)
                : buyer.totalSpent
                  ? money(buyer.totalSpent)
                  : `${buyer.saleCount}×`}
            </p>
            <p className="text-[10px] font-medium text-zinc-400 group-hover:text-teal-700">
              {emphasizeDebt && buyer.balanceDue > 0.001 ? 'Collect →' : 'View →'}
            </p>
          </>
        )}
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-zinc-300 group-hover:text-teal-600" />
    </Link>
  )
}

export function ShopCustomersBoard({
  buyers,
  emptyHint = 'No customers yet. Name them when you record a sale — they show up here.',
  viewHref,
  action,
  limit = 8,
}: {
  buyers: ShopBuyerRow[]
  emptyHint?: string
  viewHref: (buyer: ShopBuyerRow) => string
  action?: ReactNode
  limit?: number
}) {
  const rows = buyers.slice(0, limit)

  return (
    <BookPanel title="Customers" action={action}>
      {!rows.length ? (
        <p className="py-3 text-xs leading-relaxed text-zinc-500">{emptyHint}</p>
      ) : (
        <div>
          {rows.map((buyer) => (
            <BuyerRow key={buyer.id} buyer={buyer} href={viewHref(buyer)} />
          ))}
        </div>
      )}
    </BookPanel>
  )
}

export function ShopDebtorsPanel({
  debtors,
  viewHref,
  action,
}: {
  debtors: ShopBuyerRow[]
  viewHref: (buyer: ShopBuyerRow) => string
  action?: ReactNode
}) {
  return (
    <BookPanel title="Who owes" action={action}>
      {!debtors.length ? (
        <p className="py-3 text-xs leading-relaxed text-zinc-500">
          Nobody on credit right now.
        </p>
      ) : (
        <div>
          {debtors.map((d) => (
            <BuyerRow key={d.id} buyer={d} href={viewHref(d)} emphasizeDebt />
          ))}
        </div>
      )}
    </BookPanel>
  )
}
