import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth-store'
import { isOutletScoped, outletHomePath } from '@/lib/outlet'
import { money } from '@/pages/DistributorsPage'

type StockRow = {
  productId: number
  productName: string
  uom: string
  remaining: number
}

type LineInput = {
  qty: string
  unitPrice: string
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function RecordOutletSalePage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [itemSearch, setItemSearch] = useState('')
  const [lineInputs, setLineInputs] = useState<Record<string, LineInput>>({})
  const [saleType, setSaleType] = useState<'CASH' | 'CREDIT' | 'TRANSFER'>('CASH')
  const [buyerName, setBuyerName] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ saleNumber: string; totalAmount: number } | null>(null)

  const overview = useQuery({
    queryKey: ['outlet-overview', user?.outletCustomerId],
    enabled: isOutletScoped(user),
    queryFn: async () => {
      const { data } = await api.get('/outlet-sales/overview')
      return data.data as { stock: StockRow[] }
    },
  })

  const stock = useMemo(
    () => (overview.data?.stock || []).filter((row) => row.remaining > 0.0001),
    [overview.data],
  )

  const filteredStock = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    if (!q) return stock
    return stock.filter((row) => row.productName.toLowerCase().includes(q))
  }, [stock, itemSearch])

  useEffect(() => {
    if (!stock.length) return
    setLineInputs((prev) => {
      const next = { ...prev }
      for (const row of stock) {
        const key = String(row.productId)
        if (!next[key]) next[key] = { qty: '', unitPrice: '' }
      }
      return next
    })
  }, [stock])

  const activeLines = useMemo(() => {
    return stock
      .map((row) => {
        const input = lineInputs[String(row.productId)] || { qty: '', unitPrice: '' }
        const qty = Number(input.qty) || 0
        const unitPrice = Number(input.unitPrice) || 0
        return {
          ...row,
          qty,
          unitPrice,
          lineTotal: qty * unitPrice,
          exceeded: qty > row.remaining + 0.0001,
        }
      })
      .filter((row) => row.qty > 0)
  }, [stock, lineInputs])

  const subtotal = activeLines.reduce((sum, row) => sum + row.lineTotal, 0)
  const qtyTotal = activeLines.reduce((sum, row) => sum + row.qty, 0)
  const hasExceeded = activeLines.some((row) => row.exceeded)
  const missingPrice = activeLines.some((row) => !(row.unitPrice > 0))
  const canSubmit = activeLines.length > 0 && !hasExceeded && !missingPrice && !overview.isLoading

  const setLine = (productId: number, patch: Partial<LineInput>) => {
    const key = String(productId)
    setLineInputs((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { qty: '', unitPrice: '' }),
        ...patch,
      },
    }))
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!activeLines.length) throw new Error('Enter quantity on at least one product')
      if (hasExceeded) throw new Error('One of the quantities is more than stock left')
      if (missingPrice) throw new Error('Enter a unit price on every item in the sale')
      const { data } = await api.post('/outlet-sales', {
        saleType,
        buyerName: buyerName.trim() || null,
        amountPaid: saleType === 'CREDIT' ? 0 : subtotal,
        lines: activeLines.map((row) => ({
          productId: row.productId,
          qty: row.qty,
          unitPrice: row.unitPrice,
        })),
      })
      return data as {
        message?: string
        data?: { saleNumber: string; totalAmount: number }
      }
    },
    onSuccess: async (body) => {
      setError('')
      setResult({
        saleNumber: body.data?.saleNumber || '',
        totalAmount: body.data?.totalAmount || subtotal,
      })
      setLineInputs({})
      setBuyerName('')
      await qc.invalidateQueries({ queryKey: ['outlet-overview'] })
      await qc.invalidateQueries({ queryKey: ['distributor'] })
      await qc.invalidateQueries({ queryKey: ['distributors'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { err?: string } }; message?: string }
      setError(axiosErr.response?.data?.err || axiosErr.message || 'Could not record sale')
    },
  })

  if (result) {
    return (
      <PageLayout
        title="Sale recorded"
        description={`${result.saleNumber} saved`}
        back
        backTo="/"
        backLabel="Dashboard"
      >
        <div className="mx-auto max-w-xl rounded-2xl border border-zinc-200/80 bg-white p-6 text-center shadow-xs">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="size-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">Sale confirmed</h2>
          <p className="mt-1 font-mono text-sm font-semibold text-[var(--accent-strong)]">
            {result.saleNumber}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {money(result.totalAmount)} · stock at this stall has been updated.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              className="h-8 font-semibold"
              onClick={() => {
                setResult(null)
                setError('')
              }}
            >
              Record another
            </Button>
            <Button variant="outline" size="sm" className="h-8 font-semibold" asChild>
              <Link to={outletHomePath(user)}>Shop book</Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 font-semibold" asChild>
              <Link to="/">Dashboard</Link>
            </Button>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Record sale"
      description={user?.outlet?.name ? `Selling from ${user.outlet.name}` : 'Shop sale'}
      back
      backTo="/"
      backLabel="Dashboard"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7 xl:col-span-8">
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900">Stock on hand</h2>
                {activeLines.length > 0 && (
                  <span className="inline-flex items-center rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    {activeLines.length} item{activeLines.length === 1 ? '' : 's'} ({fmt(qtyTotal)})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                Enter quantity and price on each product you are selling
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search product…"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {overview.isLoading && (
            <div className="py-12 text-center text-xs text-zinc-400">Loading stock…</div>
          )}

          {!overview.isLoading && filteredStock.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-zinc-800">
                {stock.length === 0 ? 'No stock at this shop' : 'No matching products'}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {stock.length === 0
                  ? 'Goods appear here after the factory issues stock to this stall.'
                  : 'Try a different search.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredStock.map((row) => {
              const input = lineInputs[String(row.productId)] || { qty: '', unitPrice: '' }
              const enteredQty = Number(input.qty) || 0
              const isSelected = enteredQty > 0
              const unitPriceNum = Number(input.unitPrice) || 0
              const lineTotal = enteredQty * unitPriceNum
              const isExceeded = enteredQty > row.remaining + 0.0001

              return (
                <div
                  key={row.productId}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-150 ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/20 shadow-xs ring-1 ring-emerald-500/20'
                      : 'border-zinc-200/80 bg-white shadow-2xs hover:border-zinc-300'
                  }`}
                >
                  <div>
                    <div className="mb-1.5 flex items-start justify-between gap-1.5">
                      <h3 className="line-clamp-1 text-xs font-semibold text-zinc-900">
                        {row.productName}
                      </h3>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100/70 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          <Check className="size-2.5" /> In sale
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-zinc-400">{row.uom}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Available:{' '}
                      <strong className="text-zinc-800">
                        {fmt(row.remaining)} {row.uom}
                      </strong>
                    </p>
                  </div>

                  <div className="mt-3 border-t border-zinc-100 pt-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <label className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                            Quantity ({row.uom})
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setLine(row.productId, { qty: String(row.remaining) })}
                              className="cursor-pointer text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                            >
                              Max
                            </button>
                            {isSelected && (
                              <button
                                type="button"
                                onClick={() => setLine(row.productId, { qty: '' })}
                                className="ml-1 cursor-pointer text-[10px] text-zinc-400 hover:text-red-600"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          max={row.remaining}
                          step="any"
                          placeholder="0"
                          value={input.qty}
                          onChange={(e) => setLine(row.productId, { qty: e.target.value })}
                          className={`h-8 text-xs font-semibold tabular-nums ${
                            isExceeded
                              ? 'border-red-400 bg-red-50/50 focus-visible:ring-red-400'
                              : isSelected
                                ? 'border-emerald-400 bg-white focus-visible:ring-emerald-400'
                                : ''
                          }`}
                        />
                        {isExceeded && (
                          <p className="mt-0.5 text-[10px] text-red-600">
                            Exceeds stock ({fmt(row.remaining)})
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                          Unit price (₦)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={input.unitPrice}
                          onChange={(e) => setLine(row.productId, { unitPrice: e.target.value })}
                          className="h-8 text-xs font-semibold tabular-nums"
                        />
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-2.5 flex items-center justify-between border-t border-emerald-200/50 pt-2 text-[11px]">
                        <span className="font-bold text-emerald-800">{money(lineTotal)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5 xl:col-span-4">
          <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xs sm:p-5 lg:sticky lg:top-20">
            <h2 className="border-b border-zinc-100 pb-2.5 text-sm font-semibold text-zinc-900">
              Customer & checkout
            </h2>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">Buyer name</label>
              <Input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Walk-in customer"
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">How they paid</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['CASH', 'Cash'],
                    ['TRANSFER', 'Transfer'],
                    ['CREDIT', 'Credit'],
                  ] as const
                ).map(([value, label]) => {
                  const active = saleType === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSaleType(value)}
                      className={`h-9 rounded-lg border text-xs font-semibold ${
                        active
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {saleType === 'CREDIT' && (
                <p className="mt-1.5 text-[10px] text-zinc-500">They will pay later. This sits on credit sold.</p>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Gross value ({activeLines.length} items)</span>
                <span className="font-medium tabular-nums">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200/80 pt-2 font-bold text-zinc-900">
                <span>Net payable</span>
                <span className="text-sm tabular-nums">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-zinc-700">Collected now</span>
                <span className="tabular-nums text-teal-700">
                  {money(saleType === 'CREDIT' ? 0 : subtotal)}
                </span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-zinc-900">Balance due</span>
                <span
                  className={`tabular-nums ${saleType === 'CREDIT' && subtotal > 0 ? 'text-rose-700' : 'text-zinc-800'}`}
                >
                  {money(saleType === 'CREDIT' ? subtotal : 0)}
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{error}</div>
            )}

            <div className="space-y-2 pt-1">
              <div className="flex flex-row items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 text-xs font-semibold"
                  onClick={() => navigate('/')}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-9 flex-1 text-xs font-semibold"
                  disabled={!canSubmit || save.isPending}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? 'Recording sale…' : 'Record sale'}
                </Button>
              </div>
              {!canSubmit && (
                <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                  {stock.length === 0
                    ? 'No stock to sell yet.'
                    : hasExceeded
                      ? 'Reduce quantity on the highlighted item.'
                      : missingPrice
                        ? 'Enter a unit price on every item in the sale.'
                        : 'Enter quantity on at least one product.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
