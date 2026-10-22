import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Search, UserRound } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth-store'
import {
  isOutletScoped,
  outletHomePath,
  outletQuery,
  shopSaleInvoicePath,
  shopSalePath,
  shopSaleReceiptPath,
} from '@/lib/outlet'
import { money } from '@/pages/DistributorsPage'
import { NairaAmountInput } from '@/components/ui'
import {
  isPieceUom,
  fmtDozenPcs,
  perDozenOf,
  dozenPriceFromUnit,
  unitPriceFromDozen,
} from '@/lib/units'
import type { ShopBuyerRow } from '@/components/outlet/ShopCustomersBoard'

type StockRow = {
  productId: number
  productName: string
  uom: string
  remaining: number
  sellingPrice?: number | null
  standardPrice?: number | null
  unitsPerDozen?: number | null
}

type LineInput = {
  qty: string
  dozen: string
  pcs: string
  unitPrice: string
  dozenPrice: string
}

type DistributorOption = {
  id: number
  code: string
  name: string
  phone?: string | null
  distributorKind?: string
}

type BuyerPick =
  | {
      kind: 'buyer'
      id: number
      name: string
      saleCount?: number
      balanceDue?: number
      linkedCustomerId?: number | null
    }
  | {
      kind: 'distributor'
      id: number
      name: string
      code: string
      phone?: string | null
    }

type OverviewPayload = {
  outlet?: { id: number; code: string; name: string }
  stock: StockRow[]
  buyers?: ShopBuyerRow[]
  distributors?: DistributorOption[]
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function RecordOutletSalePage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const outletIdParam = Number(searchParams.get('outletId') || 0) || null
  const scoped = isOutletScoped(user)
  const effectiveOutletId = scoped ? Number(user?.outletCustomerId) : outletIdParam

  const [itemSearch, setItemSearch] = useState('')
  const [lineInputs, setLineInputs] = useState<Record<string, LineInput>>({})
  const [amountPaid, setAmountPaid] = useState('0')
  /** Text in the search box (not a customer until selected or created). */
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null)
  const [linkedCustomerId, setLinkedCustomerId] = useState<number | null>(null)
  const [selectedLabel, setSelectedLabel] = useState('')
  const [buyerPickerOpen, setBuyerPickerOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createError, setCreateError] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    saleNumber: string
    totalAmount: number
    amountPaid?: number
    balanceDue?: number
  } | null>(null)

  // Walk-in until an existing / newly created customer is selected
  const isWalkIn = !selectedBuyerId && !linkedCustomerId
  const hasNamedCustomer = !isWalkIn

  const overview = useQuery({
    queryKey: ['outlet-overview', effectiveOutletId],
    enabled: Boolean(effectiveOutletId),
    queryFn: async () => {
      const { data } = await api.get('/outlet-sales/overview', {
        params: outletQuery(scoped ? null : effectiveOutletId),
      })
      return data.data as OverviewPayload
    },
  })

  const rawDistributors = overview.data?.distributors || []
  const distributors = useMemo(() => {
    return rawDistributors.filter(
      (d) =>
        String(d.distributorKind || '').toUpperCase() !== 'SHOP' &&
        (!effectiveOutletId || Number(d.id) !== Number(effectiveOutletId)),
    )
  }, [rawDistributors, effectiveOutletId])

  const rawBuyers = overview.data?.buyers || []
  const buyers = useMemo(() => {
    const shopNames = new Set(
      rawDistributors
        .filter((d) => String(d.distributorKind || '').toUpperCase() === 'SHOP')
        .map((d) => d.name.toLowerCase().trim()),
    )
    return rawBuyers.filter((b) => {
      if (b.linkedCustomerId && Number(b.linkedCustomerId) === Number(effectiveOutletId)) return false
      if (shopNames.has(b.name.toLowerCase().trim())) return false
      return true
    })
  }, [rawBuyers, rawDistributors, effectiveOutletId])

  const stock = useMemo(
    () => (overview.data?.stock || []).filter((row) => row.remaining > 0.0001),
    [overview.data],
  )

  const filteredStock = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    if (!q) return stock
    return stock.filter((row) => row.productName.toLowerCase().includes(q))
  }, [stock, itemSearch])

  const buyerSuggestions = useMemo((): BuyerPick[] => {
    const q = customerQuery.trim().toLowerCase()
    const linkedDistributorIds = new Set(
      buyers
        .map((b) => Number(b.linkedCustomerId || 0))
        .filter((id) => id > 0),
    )

    const local: BuyerPick[] = (q
      ? buyers.filter((b) => b.name.toLowerCase().includes(q))
      : buyers
    )
      .slice(0, 8)
      .map((b) => ({
        kind: 'buyer' as const,
        id: b.id,
        name: b.name,
        saleCount: b.saleCount,
        balanceDue: b.balanceDue,
        linkedCustomerId: b.linkedCustomerId,
      }))

    const dists: BuyerPick[] = (q
      ? distributors.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            String(d.code || '')
              .toLowerCase()
              .includes(q),
        )
      : distributors
    )
      .filter((d) => !linkedDistributorIds.has(Number(d.id)))
      .slice(0, 8)
      .map((d) => ({
        kind: 'distributor' as const,
        id: d.id,
        name: d.name,
        code: d.code,
        phone: d.phone,
      }))

    const merged = [...local, ...dists]
    const seen = new Set<string>()
    const unique: BuyerPick[] = []
    for (const row of merged) {
      const key =
        row.kind === 'distributor'
          ? `d-${row.id}`
          : row.linkedCustomerId
            ? `link-${row.linkedCustomerId}`
            : `b-${row.id}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(row)
      if (unique.length >= 10) break
    }
    return unique
  }, [buyers, distributors, customerQuery])

  const canOfferCreate = useMemo(() => {
    const q = customerQuery.trim()
    if (!q || hasNamedCustomer) return false
    const exact = buyers.some((b) => b.name.trim().toLowerCase() === q.toLowerCase())
    return !exact
  }, [customerQuery, buyers, hasNamedCustomer])

  useEffect(() => {
    if (!stock.length) return
    setLineInputs((prev) => {
      const next = { ...prev }
      for (const row of stock) {
        const key = String(row.productId)
        const price = Number(row.standardPrice ?? row.sellingPrice)
        const defaultUnitPrice = Number.isFinite(price) && price > 0 ? String(price) : ''
        const per = perDozenOf(row.unitsPerDozen)
        const defaultDozenPrice =
          Number.isFinite(price) && price > 0 ? String(dozenPriceFromUnit(price, per)) : ''

        if (!next[key]) {
          next[key] = {
            qty: '',
            dozen: '',
            pcs: '',
            unitPrice: defaultUnitPrice,
            dozenPrice: defaultDozenPrice,
          }
        } else {
          const patch: Partial<LineInput> = {}
          if (!next[key].unitPrice && defaultUnitPrice) {
            patch.unitPrice = defaultUnitPrice
          }
          if (!next[key].dozenPrice && defaultDozenPrice) {
            patch.dozenPrice = defaultDozenPrice
          }
          if (Object.keys(patch).length > 0) {
            next[key] = { ...next[key], ...patch }
          }
        }
      }
      return next
    })
  }, [stock])

  const activeLines = useMemo(() => {
    return stock
      .map((row) => {
        const input = lineInputs[String(row.productId)] || {
          qty: '',
          dozen: '',
          pcs: '',
          unitPrice: '',
          dozenPrice: '',
        }
        const qty = Number(input.qty) || 0
        const unitPrice = Number(input.unitPrice) || 0
        const isPiece = isPieceUom(row.uom)
        const per = perDozenOf(row.unitsPerDozen)
        const dz = isPiece ? Math.floor(qty / per) : 0
        const remPcs = isPiece ? qty % per : 0
        const dozenPrice =
          Number(input.dozenPrice) || (unitPrice > 0 ? dozenPriceFromUnit(unitPrice, per) : 0)
        return {
          ...row,
          qty,
          dozen: input.dozen || (dz > 0 ? String(dz) : ''),
          pcs: input.pcs || (remPcs > 0 ? String(remPcs) : ''),
          unitPrice,
          dozenPrice,
          lineTotal: Math.round(qty * unitPrice * 100) / 100,
          exceeded: qty > row.remaining + 0.0001,
        }
      })
      .filter((row) => row.qty > 0)
  }, [stock, lineInputs])

  const subtotal = activeLines.reduce((sum, row) => sum + row.lineTotal, 0)
  const qtyTotal = activeLines.reduce((sum, row) => sum + row.qty, 0)
  const hasExceeded = activeLines.some((row) => row.exceeded)
  const missingPrice = activeLines.some((row) => !(row.unitPrice > 0))

  const typingCustomer = customerQuery.trim().length > 0 && !hasNamedCustomer

  const paidNow = useMemo(() => {
    const n = Number(amountPaid)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.min(subtotal, n)
  }, [amountPaid, subtotal])
  const balanceDueNow = Math.max(0, Math.round((subtotal - paidNow) * 100) / 100)
  const saleType: 'CASH' | 'CREDIT' = paidNow <= 0.001 ? 'CREDIT' : 'CASH'

  const canSubmit =
    Boolean(effectiveOutletId) &&
    activeLines.length > 0 &&
    !hasExceeded &&
    !missingPrice &&
    !overview.isLoading &&
    !typingCustomer &&
    !(balanceDueNow > 0.001 && isWalkIn)

  const setLine = (
    productId: number,
    patch: Partial<LineInput>,
    rowContext?: StockRow,
  ) => {
    const key = String(productId)
    setLineInputs((prev) => {
      const current = prev[key] || {
        qty: '',
        dozen: '',
        pcs: '',
        unitPrice: '',
        dozenPrice: '',
      }
      const next: LineInput = { ...current, ...patch }
      const stockRow = rowContext || stock.find((s) => s.productId === productId)
      const isPiece = isPieceUom(stockRow?.uom)
      const per = perDozenOf(stockRow?.unitsPerDozen)

      if (isPiece) {
        if ('dozen' in patch || 'pcs' in patch) {
          const dz = Number(next.dozen) || 0
          const pcs = Number(next.pcs) || 0
          const totalPcs = dz * per + pcs
          next.qty = totalPcs > 0 ? String(totalPcs) : ''
        } else if ('qty' in patch) {
          const totalPcs = Number(next.qty) || 0
          next.dozen = totalPcs > 0 ? String(Math.floor(totalPcs / per)) : ''
          next.pcs = totalPcs > 0 ? String(totalPcs % per) : ''
        }

        if ('dozenPrice' in patch) {
          const dzP = Number(next.dozenPrice)
          if (Number.isFinite(dzP) && dzP > 0) {
            next.unitPrice = String(unitPriceFromDozen(dzP, per))
          } else if (next.dozenPrice === '') {
            next.unitPrice = ''
          }
        } else if ('unitPrice' in patch) {
          const uP = Number(next.unitPrice)
          if (Number.isFinite(uP) && uP > 0) {
            next.dozenPrice = String(dozenPriceFromUnit(uP, per))
          } else if (next.unitPrice === '') {
            next.dozenPrice = ''
          }
        }
      }

      return {
        ...prev,
        [key]: next,
      }
    })
  }

  const pickBuyer = (row: BuyerPick) => {
    if (row.kind === 'distributor') {
      setSelectedBuyerId(null)
      setLinkedCustomerId(row.id)
      setSelectedLabel(row.name)
    } else {
      setSelectedBuyerId(row.id)
      setLinkedCustomerId(null)
      setSelectedLabel(row.name)
    }
    setCustomerQuery('')
    setBuyerPickerOpen(false)
    setAmountPaid('0')
  }

  const clearBuyer = () => {
    setSelectedBuyerId(null)
    setLinkedCustomerId(null)
    setSelectedLabel('')
    setCustomerQuery('')
    setAmountPaid('0')
  }

  const setPaidFull = () => {
    setAmountPaid(subtotal > 0 ? String(Number(subtotal.toFixed(2))) : '0')
  }

  const openCreateModal = (prefill?: string) => {
    setCreateName((prefill || customerQuery).trim())
    setCreatePhone('')
    setCreateError('')
    setBuyerPickerOpen(false)
    setCreateOpen(true)
  }

  // Cap paid amount if cart total drops below what's entered; never auto-fill
  useEffect(() => {
    setAmountPaid((prev) => {
      const n = Number(prev)
      if (!prev.trim() || !Number.isFinite(n) || n < 0) return '0'
      if (n > subtotal + 0.001) return String(Number(subtotal.toFixed(2)))
      return prev
    })
  }, [subtotal])

  const createBuyer = useMutation({
    mutationFn: async () => {
      if (!effectiveOutletId) throw new Error('Pick a shop first')
      const name = createName.trim()
      if (!name) throw new Error('Enter the customer name')
      const { data } = await api.post('/outlet-sales/buyers', {
        outletCustomerId: effectiveOutletId,
        name,
        phone: createPhone.trim() || null,
      })
      return data.data as { id: number; name: string; phone: string | null }
    },
    onSuccess: async (buyer) => {
      setCreateOpen(false)
      setSelectedBuyerId(buyer.id)
      setLinkedCustomerId(null)
      setSelectedLabel(buyer.name)
      setCustomerQuery('')
      setAmountPaid('0')
      setCreateError('')
      await qc.invalidateQueries({ queryKey: ['outlet-overview'] })
      await qc.invalidateQueries({ queryKey: ['outlet-buyers'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: { data?: { err?: string; errors?: { name?: string } } }
        message?: string
      }
      setCreateError(
        axiosErr.response?.data?.err ||
          axiosErr.response?.data?.errors?.name ||
          axiosErr.message ||
          'Could not save customer',
      )
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!effectiveOutletId) throw new Error('Pick a shop first')
      if (!activeLines.length) throw new Error('Enter quantity on at least one product')
      if (hasExceeded) throw new Error('One of the quantities is more than stock left')
      if (missingPrice) throw new Error('Enter a unit price on every item in the sale')
      if (balanceDueNow > 0.001 && isWalkIn) {
        throw new Error('Walk-in must pay in full — create or pick a customer to leave a balance')
      }
      if (customerQuery.trim() && isWalkIn) {
        throw new Error('Pick a customer from the list, or Create them — typing alone will not save a name')
      }
      const { data } = await api.post('/outlet-sales', {
        outletCustomerId: effectiveOutletId,
        saleType,
        outletBuyerId: selectedBuyerId,
        linkedCustomerId,
        // Never auto-create from free text — only selected / created customers
        buyerName: null,
        amountPaid: paidNow,
        lines: activeLines.map((row) => ({
          productId: row.productId,
          qty: row.qty,
          unitPrice: row.unitPrice,
        })),
      })
      return data as {
        message?: string
        data?: {
          saleNumber: string
          totalAmount: number
          amountPaid: number
          balanceDue: number
        }
      }
    },
    onSuccess: async (body) => {
      setError('')
      setResult({
        saleNumber: body.data?.saleNumber || '',
        totalAmount: body.data?.totalAmount || subtotal,
        amountPaid: body.data?.amountPaid ?? paidNow,
        balanceDue: body.data?.balanceDue ?? balanceDueNow,
      })
      setLineInputs({})
      clearBuyer()
      setAmountPaid('0')
      await qc.invalidateQueries({ queryKey: ['outlet-overview'] })
      await qc.invalidateQueries({ queryKey: ['outlet-buyers'] })
      await qc.invalidateQueries({ queryKey: ['outlet-sales-list'] })
      await qc.invalidateQueries({ queryKey: ['distributor'] })
      await qc.invalidateQueries({ queryKey: ['distributors'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { err?: string } }; message?: string }
      setError(axiosErr.response?.data?.err || axiosErr.message || 'Could not record sale')
    },
  })

  const shopName = overview.data?.outlet?.name || user?.outlet?.name || 'Shop'
  const backTo = scoped
    ? '/'
    : overview.data?.outlet?.code
      ? `/distributors/${overview.data.outlet.code}`
      : '/distributors'

  if (!effectiveOutletId) {
    return (
      <PageLayout title="Record sale" description="Choose a market shop first" back backTo="/distributors">
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">
          Open a market shop, then use <strong>Record sale</strong> from the shop book.
        </div>
      </PageLayout>
    )
  }

  if (result) {
    return (
      <PageLayout
        title="Sale recorded"
        description={`${result.saleNumber} saved`}
        back
        backTo={backTo}
        backLabel={scoped ? 'Dashboard' : 'Shop book'}
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
            {money(result.totalAmount)}
            {(result.balanceDue || 0) > 0.001
              ? ` · paid ${money(result.amountPaid || 0)} · credit ${money(result.balanceDue || 0)}`
              : ' · paid in full'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" className="h-8 font-semibold" asChild>
              <Link to={shopSaleInvoicePath(result.saleNumber)}>Invoice</Link>
            </Button>
            {(result.amountPaid || 0) > 0.001 ? (
              <Button variant="outline" size="sm" className="h-8 font-semibold" asChild>
                <Link to={shopSaleReceiptPath(result.saleNumber)}>Receipt</Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" className="h-8 font-semibold" asChild>
              <Link to={shopSalePath(result.saleNumber)}>View sale</Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 font-semibold"
              onClick={() => {
                setResult(null)
                setError('')
              }}
            >
              Record another
            </Button>
            <Button variant="ghost" size="sm" className="h-8 font-semibold" asChild>
              <Link to={scoped ? outletHomePath(user) : backTo}>Shop book</Link>
            </Button>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Record sale"
      description={`Selling from ${shopName}`}
      back
      backTo={backTo}
      backLabel={scoped ? 'Dashboard' : 'Shop book'}
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
              const input = lineInputs[String(row.productId)] || {
                qty: '',
                dozen: '',
                pcs: '',
                unitPrice: '',
                dozenPrice: '',
              }
              const enteredQty = Number(input.qty) || 0
              const isSelected = enteredQty > 0
              const unitPriceNum = Number(input.unitPrice) || 0
              const lineTotal = Math.round(enteredQty * unitPriceNum * 100) / 100
              const isExceeded = enteredQty > row.remaining + 0.0001
              const isPiece = isPieceUom(row.uom)
              const per = perDozenOf(row.unitsPerDozen)

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
                        <span className="text-[10px] font-medium text-zinc-400">
                          {isPiece ? 'dz · pcs' : row.uom}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Available:{' '}
                      <strong className="text-zinc-800">
                        {isPiece ? fmtDozenPcs(row.remaining, per) : `${fmt(row.remaining)} ${row.uom}`}
                      </strong>
                      {isPiece && row.remaining > 0 && (
                        <span className="ml-1 text-[10px] font-normal text-zinc-400">
                          ({fmt(row.remaining)} pcs)
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="mt-3 border-t border-zinc-100 pt-2.5">
                    {isPiece ? (
                      <div className="space-y-2.5">
                        {/* Quantity section with Dozen and Pcs */}
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                              Quantity
                            </label>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const dz = Math.floor(row.remaining / per)
                                  const rem = row.remaining % per
                                  setLine(
                                    row.productId,
                                    {
                                      dozen: dz > 0 ? String(dz) : '0',
                                      pcs: rem > 0 ? String(rem) : '0',
                                      qty: String(row.remaining),
                                    },
                                    row,
                                  )
                                }}
                                className="cursor-pointer text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                              >
                                Max ({fmtDozenPcs(row.remaining, per)})
                              </button>
                              {isSelected && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLine(row.productId, { dozen: '', pcs: '', qty: '' }, row)
                                  }
                                  className="cursor-pointer text-[10px] text-zinc-400 hover:text-red-600"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  value={input.dozen}
                                  onChange={(e) =>
                                    setLine(row.productId, { dozen: e.target.value }, row)
                                  }
                                  className={`h-8 pr-7 text-xs font-semibold tabular-nums ${
                                    isExceeded
                                      ? 'border-red-400 bg-red-50/50'
                                      : isSelected
                                        ? 'border-emerald-400 bg-white'
                                        : ''
                                  }`}
                                />
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">
                                  dz
                                </span>
                              </div>
                              <p className="mt-0.5 text-[9px] text-zinc-400">Dozen</p>
                            </div>
                            <div>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  value={input.pcs}
                                  onChange={(e) =>
                                    setLine(row.productId, { pcs: e.target.value }, row)
                                  }
                                  className={`h-8 pr-7 text-xs font-semibold tabular-nums ${
                                    isExceeded
                                      ? 'border-red-400 bg-red-50/50'
                                      : isSelected
                                        ? 'border-emerald-400 bg-white'
                                        : ''
                                  }`}
                                />
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">
                                  pcs
                                </span>
                              </div>
                              <p className="mt-0.5 text-[9px] text-zinc-400">Pieces</p>
                            </div>
                          </div>
                          {isExceeded && (
                            <p className="mt-1 text-[10px] text-red-600">
                              Exceeds stock ({fmtDozenPcs(row.remaining, per)})
                            </p>
                          )}
                        </div>

                        {/* Price section with Price/dz and Price/pc */}
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                              Price (₦)
                            </label>
                            <span className="text-[9px] text-zinc-400">auto-converts</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="0.00"
                                  value={input.dozenPrice}
                                  onChange={(e) =>
                                    setLine(row.productId, { dozenPrice: e.target.value }, row)
                                  }
                                  className="h-8 pr-8 text-xs font-semibold tabular-nums"
                                />
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400">
                                  /dz
                                </span>
                              </div>
                              <p className="mt-0.5 text-[9px] text-zinc-400">Per dozen</p>
                            </div>
                            <div>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="0.00"
                                  value={input.unitPrice}
                                  onChange={(e) =>
                                    setLine(row.productId, { unitPrice: e.target.value }, row)
                                  }
                                  className="h-8 pr-8 text-xs font-semibold tabular-nums"
                                />
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400">
                                  /pc
                                </span>
                              </div>
                              <p className="mt-0.5 text-[9px] text-zinc-400">Per piece</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <label className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                              Quantity ({row.uom})
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setLine(row.productId, { qty: String(row.remaining) }, row)
                                }
                                className="cursor-pointer text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                              >
                                Max
                              </button>
                              {isSelected && (
                                <button
                                  type="button"
                                  onClick={() => setLine(row.productId, { qty: '' }, row)}
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
                            onChange={(e) =>
                              setLine(row.productId, { qty: e.target.value }, row)
                            }
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
                            onChange={(e) =>
                              setLine(row.productId, { unitPrice: e.target.value }, row)
                            }
                            className="h-8 text-xs font-semibold tabular-nums"
                          />
                        </div>
                      </div>
                    )}

                    {isSelected && (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 border-t border-emerald-200/50 pt-2 text-[11px]">
                        <div>
                          {isPiece ? (
                            <span className="text-[10px] text-zinc-600 font-medium">
                              {fmtDozenPcs(enteredQty, per)} ({enteredQty} pcs)
                              {Number(input.dozenPrice) > 0
                                ? ` · @ ${money(Number(input.dozenPrice))}/dz`
                                : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-medium">
                              {enteredQty} {row.uom} × {money(unitPriceNum)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-emerald-800 tabular-nums">
                          {money(lineTotal)}
                        </span>
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

            <div className="relative">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-zinc-700">Customer</label>
                {hasNamedCustomer && (
                  <button
                    type="button"
                    onClick={clearBuyer}
                    className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-800"
                  >
                    Clear · walk-in
                  </button>
                )}
              </div>
              {hasNamedCustomer ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                  <UserRound className="size-3.5 shrink-0 text-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-zinc-900">{selectedLabel}</p>
                    <p className="text-[10px] text-emerald-800">
                      {linkedCustomerId ? 'Distributor account' : 'Shop customer'} · credit allowed
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value)
                      setBuyerPickerOpen(true)
                    }}
                    onFocus={() => setBuyerPickerOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setBuyerPickerOpen(false), 150)
                    }}
                    placeholder="Search customer or distributor…"
                    className="h-9 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Leave empty for walk-in (full payment). Typing alone does not create a customer.
                  </p>
                </>
              )}
              {!hasNamedCustomer && buyerPickerOpen && (buyerSuggestions.length > 0 || canOfferCreate) && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-md">
                  {buyerSuggestions.map((b) => (
                    <li key={b.kind === 'distributor' ? `d-${b.id}` : `b-${b.id}`}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickBuyer(b)}
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium text-zinc-900">{b.name}</span>
                          {b.kind === 'distributor' ? (
                            <span className="mt-0.5 block font-mono text-[10px] text-violet-600">
                              App distributor · {b.code}
                            </span>
                          ) : b.linkedCustomerId ? (
                            <span className="mt-0.5 block text-[10px] text-teal-700">
                              Shop account · linked distributor
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 tabular-nums text-[10px] text-zinc-500">
                          {b.kind === 'distributor'
                            ? 'New link'
                            : `${b.saleCount || 0}×${
                                (b.balanceDue || 0) > 0.001
                                  ? ` · owes ${money(b.balanceDue || 0)}`
                                  : ''
                              }`}
                        </span>
                      </button>
                    </li>
                  ))}
                  {canOfferCreate && (
                    <li className="border-t border-zinc-100">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => openCreateModal()}
                      >
                        <Plus className="size-3.5 shrink-0" />
                        Create «{customerQuery.trim()}»
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">Amount paid now</label>
              <div className="flex gap-2">
                <NairaAmountInput
                  value={amountPaid}
                  onChange={setAmountPaid}
                  className="h-9 flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 px-3 text-xs font-semibold"
                  disabled={subtotal <= 0}
                  onClick={setPaidFull}
                >
                  Pay full
                </Button>
              </div>
              <p className="text-[10px] text-zinc-500">
                {isWalkIn
                  ? 'Walk-in must pay the full total — use Pay full or type the amount.'
                  : 'Starts at 0 (credit) · Pay full or enter a part payment.'}
              </p>
            </div>

            {activeLines.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-zinc-100 bg-zinc-50/50 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Items in sale ({activeLines.length})
                </p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {activeLines.map((line) => {
                    const per = perDozenOf(line.unitsPerDozen)
                    const isPiece = isPieceUom(line.uom)
                    return (
                      <div
                        key={line.productId}
                        className="flex items-start justify-between gap-2 border-b border-zinc-100/80 pb-1.5 text-xs last:border-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-zinc-900">{line.productName}</p>
                          <p className="text-[10px] text-zinc-500">
                            {isPiece
                              ? `${fmtDozenPcs(line.qty, per)} (${line.qty} pcs) · ${money(line.dozenPrice)}/dz`
                              : `${line.qty} ${line.uom} · ${money(line.unitPrice)}/${line.uom}`}
                          </p>
                        </div>
                        <span className="font-bold text-zinc-900 tabular-nums shrink-0">
                          {money(line.lineTotal)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Total ({activeLines.length} items)</span>
                <span className="font-medium tabular-nums">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-zinc-700">Paid now</span>
                <span className="tabular-nums text-teal-700">{money(paidNow)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200/80 pt-2 font-bold">
                <span className="text-zinc-900">Balance (credit)</span>
                <span
                  className={`tabular-nums ${balanceDueNow > 0.001 ? 'text-rose-700' : 'text-zinc-800'}`}
                >
                  {money(balanceDueNow)}
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
                  onClick={() => navigate(backTo)}
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
                        : typingCustomer
                          ? 'Pick a customer from the list, or Create them — then Record sale.'
                          : balanceDueNow > 0.001 && isWalkIn
                            ? 'Walk-in must pay in full — tap Pay full, or pick / create a customer for credit.'
                            : 'Enter quantity on at least one product.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New shop customer</DialogTitle>
            <DialogDescription>
              Save name and phone so you can find them next time and sell on credit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">Name</label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Customer name"
                className="h-9 text-xs"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">Phone</label>
              <Input
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                placeholder="Optional"
                className="h-9 text-xs"
                inputMode="tel"
              />
            </div>
            {createError && (
              <div className="rounded-lg bg-red-50 px-2.5 py-2 text-[11px] font-medium text-red-700">
                {createError}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-1 text-xs"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 flex-1 text-xs font-semibold"
                disabled={createBuyer.isPending || !createName.trim()}
                onClick={() => createBuyer.mutate()}
              >
                {createBuyer.isPending ? 'Saving…' : 'Save customer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
