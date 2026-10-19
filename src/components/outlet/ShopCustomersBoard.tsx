import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
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
  linkedCustomerId?: number | null
  kind?: string | null
}

function BuyerRow({
  buyer,
  href,
  emphasizeDebt,
}: {
  buyer: ShopBuyerRow
  href: string
  emphasizeDebt?: boolean
}) {
  const owes = buyer.balanceDue > 0.001
  return (
    <Link
      to={href}
      className="group flex items-center gap-2.5 border-b border-zinc-100 py-2 last:border-0 last:pb-0 first:pt-0 transition-colors hover:bg-zinc-50/90 -mx-1 px-1 rounded-md"
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase',
          owes
            ? 'bg-amber-100 text-amber-800'
            : 'bg-zinc-100 text-zinc-600 group-hover:bg-teal-50 group-hover:text-teal-800',
        )}
      >
        {buyer.name.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{buyer.name}</p>
        <p className="truncate text-[11px] text-zinc-500">
          {buyer.saleCount} sale{buyer.saleCount === 1 ? '' : 's'}
          {buyer.phone ? ` · ${buyer.phone}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            'text-sm font-semibold tabular-nums',
            owes ? 'text-amber-800' : 'text-zinc-900',
          )}
        >
          {owes ? money(buyer.balanceDue) : money(buyer.totalSpent || 0)}
        </p>
        <p className="text-[10px] text-zinc-400 group-hover:text-teal-700">
          {owes ? 'Owes · Collect' : 'View'}
        </p>
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-zinc-300 group-hover:text-teal-600" />
    </Link>
  )
}

export function ShopCustomersBoard({
  buyers,
  debtors,
  emptyHint = 'No customers yet. Name them when you record a sale — they show up here.',
  viewHref,
  action,
  limit = 20,
}: {
  buyers: ShopBuyerRow[]
  debtors?: ShopBuyerRow[]
  emptyHint?: string
  viewHref: (buyer: ShopBuyerRow) => string
  action?: ReactNode
  limit?: number
}) {
  const [tab, setTab] = useState<'all' | 'owing'>('all')
  const [q, setQ] = useState('')

  const owingList = debtors ?? buyers.filter((b) => b.balanceDue > 0.001)
  const source = tab === 'owing' ? owingList : buyers

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = !needle
      ? source
      : source.filter(
          (b) =>
            b.name.toLowerCase().includes(needle) ||
            String(b.phone || '').toLowerCase().includes(needle),
        )
    return filtered.slice(0, limit)
  }, [source, q, limit])

  return (
    <BookPanel
      title="Customers"
      action={
        <div className="flex items-center gap-1.5">
          {action}
          <div className="flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5 text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={cn(
                'rounded px-2 py-0.5 transition-colors',
                tab === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500',
              )}
            >
              All {buyers.length}
            </button>
            <button
              type="button"
              onClick={() => setTab('owing')}
              className={cn(
                'rounded px-2 py-0.5 transition-colors',
                tab === 'owing' ? 'bg-white text-amber-800 shadow-xs' : 'text-zinc-500',
              )}
            >
              Owing {owingList.length}
            </button>
          </div>
        </div>
      }
    >
      {buyers.length > 0 ? (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer…"
            className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
          />
        </div>
      ) : null}

      {!rows.length ? (
        <p className="py-4 text-center text-xs leading-relaxed text-zinc-500">
          {tab === 'owing' && buyers.length
            ? 'Nobody owes the shop right now.'
            : emptyHint}
        </p>
      ) : (
        <div>
          {rows.map((buyer) => (
            <BuyerRow
              key={buyer.id}
              buyer={buyer}
              href={viewHref(buyer)}
              emphasizeDebt={tab === 'owing' || buyer.balanceDue > 0.001}
            />
          ))}
        </div>
      )}
    </BookPanel>
  )
}

/** @deprecated Prefer ShopCustomersBoard with debtors + Owing tab */
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
    <ShopCustomersBoard
      buyers={debtors}
      debtors={debtors}
      viewHref={viewHref}
      action={action}
      emptyHint="No balances owed right now."
    />
  )
}
