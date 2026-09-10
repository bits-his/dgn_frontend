import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Check,
  Printer,
  AlertTriangle,
  FileText,
  ChevronDown,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CreditBar } from '@/pages/DistributorsPage'

type SellableBatch = {
  id: number
  batchNumber: string
  productId: number | null
  productName: string | null
  qtyAvailable: number
  uom: string
  locationId: number | null
  locationName: string | null
  unitCost: number | null
  standardPrice?: number | null
}

type Customer = {
  id: number
  name: string
  code: string | null
  customerType: string | null
  contactPerson: string | null
  phone: string | null
  minOrderQty?: number
  priceTier?: string
  creditLimit?: number
  paymentTermsDays?: number
}

type DistributorCreditView = {
  creditLimit: number
  outstanding: number
  availableCredit: number
  utilizationPercent: number
  status: 'GREEN' | 'YELLOW' | 'RED'
  overdueCount: number
  overdueAmount: number
  minOrderQty?: number
  distributorKind?: string
  advanceBalance?: number
  paymentTermsDays?: number
}

type BatchSaleInput = {
  qty: string
  unitPrice: string
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function NewSalePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const initialCustomerParam = searchParams.get('distributor') || searchParams.get('customer') || ''

  const [customerId, setCustomerId] = useState(initialCustomerParam)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false)
  const [discount, setDiscount] = useState('0')
  const [amountPaid, setAmountPaid] = useState('')
  const [advanceApplied, setAdvanceApplied] = useState('')
  const [notes, setNotes] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [result, setResult] = useState<{ saleNumber: string; amountPaid: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const customerPickerRef = useRef<HTMLDivElement>(null)

  // Map of batchNumber -> { qty, unitPrice }
  const [batchInputs, setBatchInputs] = useState<Record<string, BatchSaleInput>>({})

  const customers = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await api.get('/masters/customers')
      return data.data as Customer[]
    },
  })

  const sellable = useQuery({
    queryKey: ['sellable-batches'],
    queryFn: async () => {
      const { data } = await api.get('/sales/sellable-batches')
      return data.data as SellableBatch[]
    },
  })

  // Match customer param to customer ID if code was passed
  useEffect(() => {
    if (!customers.data?.length || !initialCustomerParam) return
    const found = customers.data.find(
      (c) => String(c.id) === String(initialCustomerParam) || c.code === initialCustomerParam,
    )
    if (found && String(customerId) !== String(found.id)) {
      setCustomerId(String(found.id))
    }
  }, [customers.data, initialCustomerParam, customerId])

  const selectedCustomer = (customers.data ?? []).find((c) => String(c.id) === String(customerId))
  const selectedIsDistributor = selectedCustomer?.customerType === 'DISTRIBUTOR'

  const distributorCredit = useQuery({
    queryKey: ['distributor-credit', selectedCustomer?.code],
    enabled: Boolean(selectedIsDistributor && selectedCustomer?.code),
    queryFn: async () => {
      const { data } = await api.get(`/distributors/${selectedCustomer!.code}`)
      const profile = data.data as {
        minOrderQty?: number
        distributorKind?: string
        advanceBalance?: number
        paymentTermsDays?: number
        credit: DistributorCreditView & {
          available?: number
          atLimit?: boolean
          advanceBalance?: number
          paymentTermsDays?: number
        }
      }
      const credit = profile.credit
      const utilization = Number(credit.utilizationPercent || 0)
      return {
        creditLimit: Number(credit.creditLimit || 0),
        outstanding: Number(credit.outstanding || 0),
        availableCredit: Number(credit.available ?? credit.availableCredit ?? 0),
        utilizationPercent: utilization,
        status: (credit.atLimit || utilization >= 100
          ? 'RED'
          : utilization >= 80
            ? 'YELLOW'
            : 'GREEN') as 'GREEN' | 'YELLOW' | 'RED',
        overdueCount: Number(credit.overdueCount || 0),
        overdueAmount: Number(credit.overdueAmount || 0),
        advanceBalance: Number(
          profile.advanceBalance ?? credit.advanceBalance ?? 0,
        ),
        paymentTermsDays: Number(
          profile.paymentTermsDays ?? credit.paymentTermsDays ?? 14,
        ),
        minOrderQty: Number(profile.minOrderQty || 0),
        distributorKind: profile.distributorKind,
      } as DistributorCreditView
    },
  })

  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (!customerPickerRef.current?.contains(e.target as Node)) {
        setCustomerMenuOpen(false)
      }
    }
    if (customerMenuOpen) {
      document.addEventListener('mousedown', handleOutside)
      document.addEventListener('touchstart', handleOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [customerMenuOpen])

  // When switching distributor, clear advance application
  useEffect(() => {
    if (!selectedIsDistributor) {
      setAdvanceApplied('')
    }
  }, [selectedIsDistributor, selectedCustomer?.id])

  const filteredCustomers = useMemo(() => {
    const list = customers.data || []
    const q = customerSearch.trim().toLowerCase()
    const filtered = !q
      ? list
      : list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.code && c.code.toLowerCase().includes(q)) ||
            (c.phone && c.phone.toLowerCase().includes(q)) ||
            (c.customerType && c.customerType.toLowerCase().includes(q)),
        )
    // Keep the selected customer visible even if search excludes them
    if (customerId) {
      const selected = list.find((c) => String(c.id) === String(customerId))
      if (selected && !filtered.some((c) => c.id === selected.id)) {
        return [selected, ...filtered]
      }
    }
    return filtered
  }, [customers.data, customerSearch, customerId])

  // Pre-fill default price when batches load
  useEffect(() => {
    if (!sellable.data?.length) return
    setBatchInputs((prev) => {
      const next = { ...prev }
      for (const b of sellable.data) {
        if (!next[b.batchNumber]) {
          const defaultPrice = b.standardPrice != null ? String(b.standardPrice) : ''
          next[b.batchNumber] = {
            qty: '',
            unitPrice: defaultPrice,
          }
        }
      }
      return next
    })
  }, [sellable.data])

  const handleQtyChange = (batchNumber: string, val: string) => {
    setBatchInputs((prev) => ({
      ...prev,
      [batchNumber]: {
        ...(prev[batchNumber] || { unitPrice: '' }),
        qty: val,
      },
    }))
  }

  const handlePriceChange = (batchNumber: string, val: string) => {
    setBatchInputs((prev) => ({
      ...prev,
      [batchNumber]: {
        ...(prev[batchNumber] || { qty: '' }),
        unitPrice: val,
      },
    }))
  }

  const handleMaxQty = (batch: SellableBatch) => {
    handleQtyChange(batch.batchNumber, String(batch.qtyAvailable))
  }

  const handleClearQty = (batchNumber: string) => {
    handleQtyChange(batchNumber, '')
  }

  // Active items being sold (where qty > 0)
  const activeLines = useMemo(() => {
    if (!sellable.data?.length) return []
    const list = []
    for (const batch of sellable.data) {
      const input = batchInputs[batch.batchNumber]
      const qtyNum = Number(input?.qty) || 0
      if (qtyNum > 0) {
        const unitPriceNum = Number(input?.unitPrice) || 0
        list.push({
          batch,
          qty: qtyNum,
          unitPrice: unitPriceNum,
          lineTotal: qtyNum * unitPriceNum,
          lineCost: qtyNum * (batch.unitCost || 0),
        })
      }
    }
    return list
  }, [sellable.data, batchInputs])

  const computed = useMemo(() => {
    let subtotal = 0
    let cost = 0
    let totalQty = 0
    for (const line of activeLines) {
      subtotal += line.lineTotal
      cost += line.lineCost
      totalQty += line.qty
    }
    const disc = Number(discount) || 0
    const total = Math.max(0, subtotal - disc)
    const margin = subtotal - disc - cost
    const cash = Number(amountPaid) || 0
    const advance = Number(advanceApplied) || 0
    const paidNow = cash + advance
    return {
      subtotal,
      cost,
      total,
      margin,
      marginPercent: subtotal - disc > 0 ? (margin / (subtotal - disc)) * 100 : 0,
      cash,
      advance,
      paidNow,
      balance: total - paidNow,
      qty: totalQty,
      itemCount: activeLines.length,
    }
  }, [activeLines, discount, amountPaid, advanceApplied])

  const filteredSellable = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    const all = sellable.data || []
    if (!q) return all
    return all.filter(
      (b) =>
        b.batchNumber.toLowerCase().includes(q) ||
        (b.productName && b.productName.toLowerCase().includes(q)) ||
        (b.locationName && b.locationName.toLowerCase().includes(q))
    )
  }, [sellable.data, itemSearch])

  const credit = distributorCredit.data
  const thisSaleDue = Math.max(0, computed.balance)
  const projectedOutstanding = (credit?.outstanding || 0) + thisSaleDue
  const creditBlocked = Boolean(
    selectedIsDistributor &&
      credit &&
      thisSaleDue > 0.001 &&
      projectedOutstanding > credit.creditLimit + 0.001,
  )
  const minOrderQty = Number(
    credit?.minOrderQty ?? selectedCustomer?.minOrderQty ?? 0,
  )
  const belowMin = Boolean(
    selectedIsDistributor && minOrderQty > 0 && computed.qty + 0.0001 < minOrderQty,
  )
  const canSubmit = Boolean(
    customerId && activeLines.length > 0 && !saving && !creditBlocked && !belowMin,
  )
  const submitBlockedReason = !customerId
    ? 'Select a customer first.'
    : activeLines.length === 0
      ? 'Enter a quantity on at least one product.'
      : belowMin
        ? `This distributor’s minimum is ${fmt(minOrderQty)} units. You currently have ${fmt(computed.qty)}.`
        : creditBlocked
          ? 'This sale would exceed their credit limit. Collect more payment or reduce the order.'
          : saving
            ? 'Recording sale…'
            : null

  const submit = async (confirmLowMargin: boolean) => {
    setError(null)
    setWarning(null)
    setSaving(true)
    try {
      const termsDays = Number(
        credit?.paymentTermsDays ?? selectedCustomer?.paymentTermsDays ?? 14,
      )
      const saleType =
        computed.balance <= 0.001
          ? 'CASH'
          : selectedIsDistributor
            ? `NET_${termsDays}`
            : 'CREDIT'

      const { data } = await api.post('/sales', {
        customerId: Number(customerId),
        saleType,
        lines: activeLines.map((l) => ({
          batchNumber: l.batch.batchNumber,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
        discount: Number(discount) || 0,
        amountPaid: Number(amountPaid) || 0,
        advanceApplied: Number(advanceApplied) || 0,
        notes,
        confirmLowMargin,
      })
      setResult({
        saleNumber: data.saleNumber,
        amountPaid: (Number(amountPaid) || 0) + (Number(advanceApplied) || 0),
      })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['sales-overview'] })
      queryClient.invalidateQueries({ queryKey: ['sellable-batches'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-overview'] })
      queryClient.invalidateQueries({ queryKey: ['distributors'] })
      queryClient.invalidateQueries({ queryKey: ['distributor'] })
      queryClient.invalidateQueries({ queryKey: ['distributor-credit'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    } catch (err: unknown) {
      const res = (err as { response?: { data?: Record<string, unknown> } }).response
      const body = res?.data
      if (body && body.code === 'CREDIT_LIMIT_EXCEEDED') {
        setError(String(body.err || body.message || 'Credit limit reached'))
      } else if (body && body.code === 'BELOW_MIN_ORDER_QTY') {
        setError(String(body.err || 'This sale is below the distributor minimum'))
      } else if (body && body.warning) {
        setWarning(String(body.message))
      } else if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not record the sale'))
      }
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    return (
      <PageLayout
        title="Sale recorded"
        description={`Invoice #${result.saleNumber} created successfully`}
        back={true}
        backLabel="Back to sales"
        onBack={() => navigate('/sales')}
      >
        <div className="max-w-xl mx-auto rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs text-center">
          <div className="mx-auto size-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Check className="size-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">Sale Confirmed</h2>
          <p className="font-mono text-sm font-semibold text-[var(--accent-strong)] mt-1">
            {result.saleNumber}
          </p>
          <p className="text-xs text-zinc-500 mt-2">
            The finished goods inventory balances have been deducted and customer ledger updated.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" className="h-8 font-semibold gap-1.5" asChild>
              <Link to={`/sales/${result.saleNumber}/invoice`}>
                <Printer className="size-3.5" /> Print invoice
              </Link>
            </Button>
            {result.amountPaid > 0.001 && (
              <Button variant="outline" size="sm" className="h-8 font-semibold gap-1.5" asChild>
                <Link to={`/sales/${result.saleNumber}/receipt`}>
                  <Printer className="size-3.5" /> Print receipt
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 font-semibold gap-1.5" asChild>
              <Link to={`/sales/${result.saleNumber}`}>
                <FileText className="size-3.5" /> Open sale
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 font-semibold" onClick={() => navigate('/sales')}>
              All sales
            </Button>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="New sale"
      description="Select goods and enter quantity & price directly on each item"
      back={true}
      backLabel="Back to sales"
      onBack={() => navigate('/sales')}
    >
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Goods for Sale with Direct Quantity & Price Input */}
        <div className="order-2 lg:order-1 lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-xl border border-zinc-200/80 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900">Available Goods</h2>
                {activeLines.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                    {activeLines.length} item{activeLines.length === 1 ? '' : 's'} in sale ({fmt(computed.qty)} kg)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                QC-inspected finished stock batches ready for dispatch
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search batch or product..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
          </div>

          {sellable.isLoading && (
            <div className="py-12 text-center text-xs text-zinc-400">
              Loading sellable finished goods batches…
            </div>
          )}

          {!sellable.isLoading && filteredSellable.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center">
              <p className="text-sm font-semibold text-zinc-800">
                {sellable.data?.length === 0
                  ? 'No sellable inventory available'
                  : 'No matching items found'}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {sellable.data?.length === 0
                  ? 'Finished goods must be inspected and accepted by quality control before they can be sold.'
                  : 'Try searching with a different keyword.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredSellable.map((batch) => {
              const input = batchInputs[batch.batchNumber] || { qty: '', unitPrice: '' }
              const enteredQty = Number(input.qty) || 0
              const isSelected = enteredQty > 0
              const unitPriceNum = Number(input.unitPrice) || 0
              const lineTotal = enteredQty * unitPriceNum
              const costTotal = enteredQty * (batch.unitCost || 0)
              const lineMargin = lineTotal - costTotal
              const lineMarginPct = lineTotal > 0 ? (lineMargin / lineTotal) * 100 : 0
              const isExceeded = enteredQty > batch.qtyAvailable

              return (
                <div
                  key={batch.id}
                  className={`rounded-xl border p-3.5 transition-all duration-150 flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/20 shadow-xs ring-1 ring-emerald-500/20'
                      : 'border-zinc-200/80 bg-white hover:border-zinc-300 shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-[var(--accent-strong)] bg-zinc-100 px-2 py-0.5 rounded">
                        {batch.batchNumber}
                      </span>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-1.5 py-0.5 rounded-full">
                          <Check className="size-2.5" /> In Order
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-zinc-400">
                          {batch.locationName || 'Main Bay'}
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-xs text-zinc-900 line-clamp-1">
                      {batch.productName || 'Finished Product'}
                    </h3>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>
                        Available: <strong className="text-zinc-800">{fmt(batch.qtyAvailable)} {batch.uom}</strong>
                      </span>
                      {batch.unitCost != null && (
                        <span>
                          Cost: <strong className="text-zinc-700">{money(batch.unitCost)}/{batch.uom}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity & Price Direct Inputs */}
                  <div className="mt-3 pt-2.5 border-t border-zinc-100">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            Quantity ({batch.uom})
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMaxQty(batch)}
                              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                            >
                              Max
                            </button>
                            {isSelected && (
                              <button
                                type="button"
                                onClick={() => handleClearQty(batch.batchNumber)}
                                className="text-[10px] text-zinc-400 hover:text-red-600 cursor-pointer ml-1"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          max={batch.qtyAvailable}
                          step="any"
                          placeholder="0"
                          value={input.qty}
                          onChange={(e) => handleQtyChange(batch.batchNumber, e.target.value)}
                          className={`h-8 text-xs font-semibold tabular-nums ${
                            isExceeded
                              ? 'border-red-400 focus-visible:ring-red-400 bg-red-50/50'
                              : isSelected
                              ? 'border-emerald-400 focus-visible:ring-emerald-400 bg-white'
                              : ''
                          }`}
                        />
                        {isExceeded && (
                          <p className="text-[10px] text-red-600 mt-0.5">
                            Exceeds stock ({fmt(batch.qtyAvailable)})
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                          Unit Price (₦)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={input.unitPrice}
                          onChange={(e) => handlePriceChange(batch.batchNumber, e.target.value)}
                          className="h-8 text-xs font-semibold tabular-nums"
                        />
                      </div>
                    </div>

                    {/* Live Line Calculation */}
                    {isSelected && (
                      <div className="mt-2.5 pt-2 border-t border-emerald-200/50 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-emerald-800">
                          {money(lineTotal)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {unitPriceNum > 0 && batch.unitCost != null && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                lineMargin >= 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {lineMarginPct.toFixed(1)}% margin
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Checkout & Customer Information — first on mobile so customers are reachable */}
        <div className="order-1 lg:order-2 lg:col-span-5 xl:col-span-4 space-y-4">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4 lg:sticky lg:top-20">
            <h2 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2.5">
              Customer & Checkout
            </h2>

            {/* Customer combobox: search + select in one field */}
            <div ref={customerPickerRef}>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Customer <span className="text-red-500">*</span>
              </label>
              {customers.isLoading ? (
                <p className="text-xs text-zinc-500 py-2">Loading customers…</p>
              ) : customers.isError ? (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 space-y-1.5">
                  <p className="font-medium">Could not load customers.</p>
                  <p className="text-[11px] text-red-600/90">
                    If you are on a phone, open the app using your computer&apos;s Wi‑Fi address (not localhost), then retry.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs bg-white"
                    onClick={() => customers.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
                  <Input
                    type="text"
                    inputMode="search"
                    placeholder="Search and select a customer…"
                    value={
                      customerMenuOpen
                        ? customerSearch
                        : selectedCustomer
                          ? `${selectedCustomer.name}${selectedCustomer.customerType ? ` (${selectedCustomer.customerType})` : ''}`
                          : customerSearch
                    }
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      setCustomerMenuOpen(true)
                      if (customerId) setCustomerId('')
                    }}
                    onFocus={() => {
                      setCustomerMenuOpen(true)
                      if (selectedCustomer && !customerSearch) {
                        setCustomerSearch('')
                      }
                    }}
                    className="pl-8 pr-8 h-9 text-xs"
                    autoComplete="off"
                  />
                  <ChevronDown
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none transition-transform ${
                      customerMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                  {customerMenuOpen && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-md border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-800 dark:bg-zinc-950">
                      {filteredCustomers.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-zinc-500">No customers match.</p>
                      ) : (
                        filteredCustomers.map((c) => {
                          const selected = String(c.id) === String(customerId)
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2.5 sm:py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                                selected ? 'bg-zinc-100 font-bold dark:bg-zinc-800' : ''
                              }`}
                              onClick={() => {
                                setCustomerId(String(c.id))
                                setCustomerSearch('')
                                setAdvanceApplied('')
                                setCustomerMenuOpen(false)
                              }}
                            >
                              <span className="truncate">
                                {c.name}
                                {c.customerType ? ` (${c.customerType})` : ''}
                              </span>
                              {selected && <Check className="size-3.5 shrink-0 text-zinc-700" />}
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Distributor Credit + Advance */}
            {selectedIsDistributor && credit && (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Credit utilization</span>
                  <span className="font-semibold text-zinc-800">
                    {money(credit.outstanding)} / {money(credit.creditLimit)}
                  </span>
                </div>
                <CreditBar
                  percent={credit.utilizationPercent}
                  atLimit={credit.status === 'RED' || credit.utilizationPercent >= 100}
                />
                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-200/70">
                  <span className="text-zinc-500">Advance balance</span>
                  <span className="font-semibold text-teal-800">
                    {money(Number(credit.advanceBalance || 0))}
                  </span>
                </div>
                {creditBlocked && (
                  <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    Credit limit exceeded by {money(projectedOutstanding - credit.creditLimit)}
                  </p>
                )}
                {belowMin && (
                  <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 font-medium">
                    Order volume ({fmt(computed.qty)} units) is below distributor minimum of {fmt(minOrderQty)} units
                  </p>
                )}
              </div>
            )}

            {/* Discount, Paid Now, Advance */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Discount (₦)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-8 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Paid Now (₦)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="h-8 text-xs tabular-nums"
                />
                <p className="mt-1 text-[10px] text-zinc-400">Cash / transfer collected today</p>
              </div>
            </div>

            {selectedIsDistributor && Number(credit?.advanceBalance || 0) > 0.001 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-zinc-700">
                    Use from advance (₦)
                  </label>
                  <button
                    type="button"
                    className="text-[10px] font-bold text-teal-700 hover:text-teal-800"
                    onClick={() => {
                      const available = Number(credit?.advanceBalance || 0)
                      const remaining = Math.max(0, computed.total - (Number(amountPaid) || 0))
                      setAdvanceApplied(String(Math.min(available, remaining)))
                    }}
                  >
                    Use max
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={advanceApplied}
                  onChange={(e) => setAdvanceApplied(e.target.value)}
                  className="h-8 text-xs tabular-nums"
                />
                <p className="mt-1 text-[10px] text-zinc-400">
                  Deducted from their {money(Number(credit?.advanceBalance || 0))} advance wallet
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Remarks / Notes
              </label>
              <Textarea
                rows={2}
                placeholder="Delivery address, driver contact, truck plate..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Financial Summary */}
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Gross value ({activeLines.length} items)</span>
                <span className="tabular-nums font-medium">{money(computed.subtotal)}</span>
              </div>
              {Number(discount) > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Discount</span>
                  <span className="tabular-nums text-rose-600">- {money(Number(discount))}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-900 font-bold border-t border-zinc-200/80 pt-2">
                <span>Net Payable</span>
                <span className="tabular-nums text-sm">{money(computed.total)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 text-[11px]">
                <span>Estimated Margin</span>
                <span
                  className={`tabular-nums font-semibold ${
                    computed.margin >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {money(computed.margin)} ({computed.marginPercent.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between border-t border-zinc-200/80 pt-2 font-semibold">
                <span className="text-zinc-700">Cash paid now</span>
                <span className="tabular-nums text-teal-700">{money(computed.cash)}</span>
              </div>
              {computed.advance > 0.001 && (
                <div className="flex justify-between font-semibold">
                  <span className="text-zinc-700">From advance</span>
                  <span className="tabular-nums text-teal-700">{money(computed.advance)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span className="text-zinc-900">Balance Due</span>
                <span
                  className={`tabular-nums ${
                    computed.balance > 0 ? 'text-rose-700 font-bold' : 'text-zinc-800'
                  }`}
                >
                  {money(Math.max(0, computed.balance))}
                </span>
              </div>
            </div>

            {/* Error & Warning Messages */}
            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}
            {warning && (
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <p className="font-semibold mb-1.5">{warning}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs bg-white font-semibold inline-flex flex-row items-center gap-1.5"
                  onClick={() => submit(true)}
                >
                  Proceed anyway with low margin
                </Button>
              </div>
            )}

            {/* Action Buttons arranged horizontally */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-row items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 font-semibold text-xs whitespace-nowrap inline-flex flex-row items-center justify-center"
                  onClick={() => navigate('/sales')}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 h-9 font-semibold text-xs gap-1.5 whitespace-nowrap inline-flex flex-row items-center justify-center"
                  disabled={!canSubmit}
                  onClick={() => submit(false)}
                >
                  {saving ? 'Recording sale…' : 'Record sale'}
                </Button>
              </div>
              {!canSubmit && submitBlockedReason && (
                <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-2">
                  {submitBlockedReason}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
