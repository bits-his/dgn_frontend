import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search, UserPlus, Users } from 'lucide-react'
import { money } from '@/pages/DistributorsPage'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ShopBuyerRow = {
  id: number
  name: string
  phone?: string | null
  notes?: string | null
  saleCount: number
  totalSpent?: number
  balanceDue: number
  advanceBalance?: number
  lastActivity?: string | null
  lastPurchase?: string | null
  linkedCustomerId?: number | null
  distributorCode?: string | null
  distributorKind?: string | null
  kind?: string | null
  isFactoryDistributor?: boolean
}

export function ShopCustomersBoard({
  buyers = [],
  factoryDistributors,
  myCustomers,
  emptyHint,
  viewHref,
  action,
  onAddCustomer,
}: {
  buyers: ShopBuyerRow[]
  factoryDistributors?: ShopBuyerRow[]
  myCustomers?: ShopBuyerRow[]
  debtors?: ShopBuyerRow[]
  emptyHint?: string
  viewHref: (buyer: ShopBuyerRow) => string
  action?: ReactNode
  onAddCustomer?: () => void
}) {
  const [owingOnly, setOwingOnly] = useState(false)
  const [q, setQ] = useState('')

  // Merge into one unified list: factory distributors first, then stall-only customers
  const allRows = useMemo(() => {
    const factory = factoryDistributors ?? buyers.filter((b) => Boolean(b.linkedCustomerId || b.isFactoryDistributor))
    const stall = myCustomers ?? buyers.filter((b) => !b.linkedCustomerId && !b.isFactoryDistributor)
    // De-duplicate by id (factory list takes precedence)
    const seen = new Set(factory.map((b) => b.id))
    const stallUniq = stall.filter((b) => !seen.has(b.id))
    return [...factory, ...stallUniq]
  }, [buyers, factoryDistributors, myCustomers])

  const filtered = useMemo(() => {
    let list = allRows
    if (owingOnly) list = list.filter((b) => Number(b.balanceDue || 0) > 0.001)
    const needle = q.trim().toLowerCase()
    if (!needle) return list
    return list.filter(
      (b) =>
        b.name.toLowerCase().includes(needle) ||
        String(b.phone || '').toLowerCase().includes(needle) ||
        String(b.distributorCode || '').toLowerCase().includes(needle),
    )
  }, [allRows, owingOnly, q])

  const owing = allRows.filter((b) => Number(b.balanceDue || 0) > 0.001).length

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-xs">
      {/* Header */}
      <div className="border-b border-zinc-100 bg-zinc-50/70 p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-teal-700" />
            <h3 className="text-sm font-bold text-zinc-900">Customers &amp; Distributors</h3>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
              {allRows.length}
            </span>
            {owing > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                {owing} owing
              </span>
            )}
          </div>
          {action ? <div>{action}</div> : null}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOwingOnly(!owingOnly)}
            className={cn(
              'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
              owingOnly
                ? 'border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-400'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
            )}
          >
            Owing only
          </button>

          <div className="relative flex-1 min-w-[160px] sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone…"
              className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-2.5 text-xs text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
            />
          </div>
        </div>
      </div>

      {/* Empty */}
      {!filtered.length ? (
        <div className="py-10 text-center px-4">
          <p className="text-xs text-zinc-500">
            {q
              ? 'No matching customer found.'
              : owingOnly
                ? 'Nobody owes at the stall right now.'
                : emptyHint || 'No customers yet. Add a customer to start tracking sales and debt.'}
          </p>
          {!q && !owingOnly && onAddCustomer && (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                onClick={onAddCustomer}
                className="h-8 gap-1.5 px-3 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white"
              >
                <UserPlus className="size-3.5" />
                Add first customer
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="py-2.5 pl-4 pr-3">Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3 text-right">Owes</th>
                  <th className="py-2.5 px-3 text-right">Advance</th>
                  <th className="py-2.5 px-3">Last activity</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((buyer) => {
                  const owes = Number(buyer.balanceDue || 0) > 0.001
                  const adv = Number(buyer.advanceBalance || 0) > 0.001
                  const href = viewHref(buyer)
                  return (
                    <tr
                      key={buyer.id}
                      className={cn('hover:bg-zinc-50/80 transition-colors', owes && 'bg-amber-50/20')}
                    >
                      <td className="py-2.5 pl-4 pr-3">
                        <Link
                          to={href}
                          className="font-semibold text-zinc-900 hover:text-teal-800 hover:underline flex items-center gap-1.5 flex-wrap"
                        >
                          <span>{buyer.name}</span>
                          {buyer.distributorCode && (
                            <span className="font-mono text-[10px] text-zinc-400">
                              · {buyer.distributorCode}
                            </span>
                          )}
                          {buyer.isFactoryDistributor ? (
                            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800">
                              Distributor
                            </span>
                          ) : (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500">
                              Customer
                            </span>
                          )}
                        </Link>
                        {buyer.notes && (
                          <p className="text-[10px] text-zinc-400 truncate max-w-xs mt-0.5">{buyer.notes}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600 font-mono text-[11px]">
                        {buyer.phone || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <span className={cn('font-bold', owes ? 'text-amber-800' : 'text-zinc-400 font-normal')}>
                          {owes ? money(buyer.balanceDue) : '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <span className={cn('font-bold', adv ? 'text-sky-700' : 'text-zinc-400 font-normal')}>
                          {adv ? money(buyer.advanceBalance || 0) : '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-500 text-[11px]">
                        {buyer.lastActivity || buyer.lastPurchase || '—'}
                      </td>
                      <td className="py-2.5 pl-3 pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs font-semibold text-teal-800 hover:text-teal-900 hover:bg-teal-50 gap-1 px-2.5"
                          asChild
                        >
                          <Link to={href}>
                            {owes ? 'Collect' : 'Open'}
                            <ChevronRight className="size-3 text-zinc-400" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="block md:hidden divide-y divide-zinc-100">
            {filtered.map((buyer) => {
              const owes = Number(buyer.balanceDue || 0) > 0.001
              const adv = Number(buyer.advanceBalance || 0) > 0.001
              const href = viewHref(buyer)
              return (
                <Link
                  key={buyer.id}
                  to={href}
                  className={cn('block p-3.5 transition-colors hover:bg-zinc-50', owes && 'bg-amber-50/20')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm text-zinc-900">{buyer.name}</p>
                        {buyer.isFactoryDistributor ? (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800">
                            Distributor
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500">
                            Customer
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        {buyer.phone || 'No phone'}
                        {buyer.distributorCode && (
                          <span className="ml-1.5 text-zinc-400">· {buyer.distributorCode}</span>
                        )}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {owes ? (
                        <p className="text-sm font-bold tabular-nums text-amber-800">
                          {money(buyer.balanceDue)}
                        </p>
                      ) : (
                        <p className="text-sm font-semibold tabular-nums text-zinc-400">Clear</p>
                      )}
                      {adv && (
                        <p className="text-[10px] font-semibold text-sky-700 tabular-nums">
                          {money(buyer.advanceBalance || 0)} adv
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-[11px] text-zinc-400">
                    <span>{buyer.lastActivity || buyer.lastPurchase || 'No activity'}</span>
                    <span className="font-semibold text-teal-800 flex items-center gap-0.5">
                      {owes ? 'Collect payment' : 'Open account'}
                      <ChevronRight className="size-3 text-teal-600" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
