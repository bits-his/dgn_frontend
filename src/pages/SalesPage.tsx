import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Truck } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
import { hasPermission } from '@/lib/auth'
import { formatBusinessDate } from '@/lib/dates'
import { useAuthStore } from '@/stores/auth-store'

type SellableBatch = {
  id: number
  batchNumber: string
  productId: number | null
  productName: string | null
  qtyAvailable: number
  uom: string
  locationName: string | null
  unitCost: number | null
}

type Customer = {
  id: number
  code: string
  name: string
  customerType: string
  phone: string | null
  address: string | null
}

type SaleRow = {
  id: number
  saleNumber: string
  customerName: string | null
  saleType: string
  status: string
  businessDate: string | null
  totalAmount: number
  totalCost: number
  grossMargin: number
  grossMarginPercent: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  vehicleNumber: string | null
  driverName: string | null
  destination: string | null
  batchNumbers: (string | null)[]
  soldBy: string | null
}

type CartLine = {
  batchNumber: string
  productName: string | null
  uom: string
  qtyAvailable: number
  unitCost: number | null
  qty: string
  unitPrice: string
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function SalesPage() {
  const user = useAuthStore((s) => s.user)
  const canSell = hasPermission(user, 'sales.create')
  const [composing, setComposing] = useState(false)

  const sales = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const { data } = await api.get('/sales')
      return data.data as SaleRow[]
    },
  })

  const overview = useQuery({
    queryKey: ['sales-overview'],
    queryFn: async () => {
      const { data } = await api.get('/sales/overview')
      return data.data as {
        totals: {
          revenue: number
          cost: number
          grossMargin: number
          grossMarginPercent: number
          discounts: number
          netMargin: number
          qtyNet: number
          qtyReturned: number
          returnRatePercent: number
          receivablesTotal: number
        }
        receivables: {
          saleNumber: string
          customerName: string | null
          balanceDue: number
        }[]
      }
    },
  })

  if (composing) {
    return <NewSaleForm onDone={() => setComposing(false)} />
  }

  const totals = overview.data?.totals
  const receivables = overview.data?.receivables ?? []

  return (
    <div>
      <PageHeader
        eyebrow="Sales & distribution"
        title="Sales desk"
        description="Sell only quality-accepted finished goods. Every sale drops stock, records revenue against the exact batches dispatched, and shows the margin those batches earned."
        actions={
          canSell ? (
            <button className="dgn-btn dgn-btn-primary" onClick={() => setComposing(true)}>
              <Plus className="h-4 w-4" /> New sale
            </button>
          ) : null
        }
      />

      {totals && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatPill label="Net revenue" value={money(totals.revenue)} tone="accent" />
          <StatPill label="Cost of goods sold" value={money(totals.cost)} />
          <StatPill
            label="Gross margin"
            value={`${money(totals.grossMargin)} · ${totals.grossMarginPercent}%`}
            tone={totals.grossMargin > 0 ? 'success' : 'danger'}
          />
          <StatPill
            label="Outstanding receivables"
            value={money(totals.receivablesTotal)}
            tone={totals.receivablesTotal > 0 ? 'danger' : 'success'}
          />
        </div>
      )}

      {totals && (
        <Card className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SmallFact label="Discounts given" value={money(totals.discounts)} />
            <SmallFact label="Margin after discounts" value={money(totals.netMargin)} />
            <SmallFact label="Net units sold" value={fmt(totals.qtyNet)} />
            <SmallFact
              label="Return rate"
              value={`${totals.returnRatePercent}% (${fmt(totals.qtyReturned)} units back)`}
            />
          </div>
        </Card>
      )}

      {receivables.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50/40">
          <h2 className="text-base font-semibold">Money still owed</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            These dispatches have left the factory but have not been fully paid for.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {receivables.map((r) => (
              <Link
                key={r.saleNumber}
                to={`/sales/${r.saleNumber}`}
                className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm hover:border-red-400"
              >
                <span className="font-mono text-xs">{r.saleNumber}</span>
                <span className="mx-2 text-[var(--ink-faint)]">·</span>
                {r.customerName}
                <span className="ml-2 font-semibold text-red-700">{money(r.balanceDue)}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-base font-semibold">Recent sales & dispatches</h2>
        {sales.isLoading && <p className="mt-3 text-sm text-[var(--ink-muted)]">Loading…</p>}
        {sales.data && sales.data.length === 0 && (
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            No sales recorded yet. Once quality control accepts a production batch it becomes
            sellable here.
          </p>
        )}
        {sales.data && sales.data.length > 0 && (
          <div className="mt-4 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--ink-faint)]">
                  <th className="py-2 pr-4">Sale</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Batches</th>
                  <th className="py-2 pr-4 text-right">Value</th>
                  <th className="py-2 pr-4 text-right">Margin</th>
                  <th className="py-2 pr-4">Payment</th>
                  <th className="py-2 pr-4">Vehicle</th>
                </tr>
              </thead>
              <tbody>
                {sales.data.map((sale) => (
                  <tr key={sale.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-3 pr-4">
                      <Link
                        to={`/sales/${sale.saleNumber}`}
                        className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                      >
                        {sale.saleNumber}
                      </Link>
                      <p className="text-xs text-[var(--ink-faint)]">
                        {sale.saleType} · {sale.status.replace('_', ' ').toLowerCase()}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-[var(--ink-muted)] tabular-nums">
                      {formatBusinessDate(sale.businessDate)}
                    </td>
                    <td className="py-3 pr-4">
                      {sale.customerName}
                      {sale.destination && (
                        <p className="text-xs text-[var(--ink-faint)]">{sale.destination}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {sale.batchNumbers.filter(Boolean).map((bn) => (
                          <Link
                            key={bn}
                            to={`/batches/${bn}`}
                            className="rounded-lg bg-zinc-100 px-2 py-0.5 font-mono text-[11px] hover:bg-zinc-200"
                          >
                            {bn}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold">
                      {money(sale.totalAmount)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={
                          sale.grossMargin > 0
                            ? 'font-semibold text-teal-700'
                            : 'font-semibold text-red-700'
                        }
                      >
                        {money(sale.grossMargin)}
                      </span>
                      <p className="text-xs text-[var(--ink-faint)]">
                        {sale.grossMarginPercent}%
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          'rounded-lg px-2 py-1 text-xs font-semibold ' +
                          (sale.paymentStatus === 'PAID' || sale.paymentStatus === 'SETTLED'
                            ? 'bg-teal-50 text-teal-800'
                            : sale.paymentStatus === 'PARTIAL'
                              ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                              : 'bg-red-50 text-red-700')
                        }
                      >
                        {sale.paymentStatus}
                      </span>
                      {sale.balanceDue > 0 && (
                        <p className="mt-1 text-xs text-red-700">{money(sale.balanceDue)} due</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[var(--ink-muted)]">
                      {sale.vehicleNumber || '—'}
                      {sale.driverName && <p>{sale.driverName}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}

function NewSaleForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const [customerId, setCustomerId] = useState('')
  const [saleType, setSaleType] = useState('CASH')
  const [lines, setLines] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState('0')
  const [transportCharge, setTransportCharge] = useState('0')
  const [amountPaid, setAmountPaid] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [destination, setDestination] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [result, setResult] = useState<{ saleNumber: string } | null>(null)
  const [saving, setSaving] = useState(false)

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

  const remaining = useMemo(() => {
    const chosen = new Set(lines.map((l) => l.batchNumber))
    return (sellable.data ?? []).filter((b) => !chosen.has(b.batchNumber))
  }, [lines, sellable.data])

  const computed = useMemo(() => {
    let subtotal = 0
    let cost = 0
    for (const line of lines) {
      const qty = Number(line.qty) || 0
      subtotal += qty * (Number(line.unitPrice) || 0)
      cost += qty * (line.unitCost || 0)
    }
    const disc = Number(discount) || 0
    const transport = Number(transportCharge) || 0
    const total = subtotal - disc + transport
    const margin = subtotal - disc - cost
    return {
      subtotal,
      cost,
      total,
      margin,
      marginPercent: subtotal - disc > 0 ? (margin / (subtotal - disc)) * 100 : 0,
      balance: total - (Number(amountPaid) || 0),
    }
  }, [lines, discount, transportCharge, amountPaid])

  const addLine = (batch: SellableBatch) => {
    setLines((prev) => [
      ...prev,
      {
        batchNumber: batch.batchNumber,
        productName: batch.productName,
        uom: batch.uom,
        qtyAvailable: batch.qtyAvailable,
        unitCost: batch.unitCost,
        qty: '',
        unitPrice: '',
      },
    ])
  }

  const updateLine = (index: number, patch: Partial<CartLine>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const submit = async (confirmLowMargin: boolean) => {
    setError(null)
    setWarning(null)
    setSaving(true)
    try {
      const { data } = await api.post('/sales', {
        customerId: Number(customerId),
        saleType,
        lines: lines.map((line) => ({
          batchNumber: line.batchNumber,
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
        })),
        discount: Number(discount) || 0,
        transportCharge: Number(transportCharge) || 0,
        amountPaid: Number(amountPaid) || 0,
        vehicleNumber,
        driverName,
        driverPhone,
        destination,
        notes,
        confirmLowMargin,
      })
      setResult({ saleNumber: data.saleNumber })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['sales-overview'] })
      queryClient.invalidateQueries({ queryKey: ['sellable-batches'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-overview'] })
    } catch (err: unknown) {
      const res = (err as { response?: { data?: Record<string, unknown> } }).response
      const body = res?.data
      if (body && body.warning) {
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
      <div>
        <PageHeader eyebrow="Sales & distribution" title="Sale recorded" />
        <Card>
          <p className="text-sm text-[var(--ink-muted)]">Dispatch note</p>
          <p className="mt-1 font-mono text-2xl font-semibold">{result.saleNumber}</p>
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Stock has been reduced on the batches dispatched and the revenue is now recorded
            against them.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="dgn-btn dgn-btn-primary" to={`/sales/${result.saleNumber}`}>
              Open dispatch note
            </Link>
            <button className="dgn-btn dgn-btn-secondary" onClick={onDone}>
              Back to sales
            </button>
          </div>
        </Card>
      </div>
    )
  }

  const canSubmit = customerId && lines.length > 0 && !saving

  return (
    <div>
      <PageHeader
        eyebrow="Sales & distribution"
        title="New sale & dispatch"
        description="Pick the customer, then add the accepted batches leaving the factory. Cost per unit comes from that batch's real production lineage, so the margin is what the factory actually earned."
        actions={
          <button className="dgn-btn dgn-btn-ghost" onClick={onDone}>
            Cancel
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-base font-semibold">Customer</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Customer">
                <select
                  className="dgn-input"
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value)
                    const found = (customers.data ?? []).find(
                      (c) => String(c.id) === e.target.value
                    )
                    if (found && found.address && !destination) setDestination(found.address)
                  }}
                >
                  <option value="">Select customer</option>
                  {(customers.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customerType.toLowerCase()})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Payment terms">
                <select
                  className="dgn-input"
                  value={saleType}
                  onChange={(e) => setSaleType(e.target.value)}
                >
                  <option value="CASH">Cash — paid on collection</option>
                  <option value="CREDIT">Credit — pay later</option>
                  <option value="TRANSFER">Bank transfer</option>
                </select>
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold">Goods leaving the factory</h2>
            {sellable.data && sellable.data.length === 0 && (
              <p className="mt-3 rounded-xl bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent-strong)]">
                Nothing is sellable right now. Finished goods must be accepted by quality control
                before they can be dispatched.
              </p>
            )}

            {lines.length === 0 && (
              <p className="mt-3 text-sm text-[var(--ink-muted)]">
                No batches added yet. Choose from the accepted batches below.
              </p>
            )}

            <div className="mt-4 space-y-4">
              {lines.map((line, index) => {
                const qty = Number(line.qty) || 0
                const price = Number(line.unitPrice) || 0
                const lineMargin = qty * (price - (line.unitCost || 0))
                const overDrawn = qty > line.qtyAvailable
                return (
                  <div
                    key={line.batchNumber}
                    className="rounded-2xl border border-[var(--line)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold">{line.batchNumber}</p>
                        <p className="text-xs text-[var(--ink-faint)]">
                          {line.productName} · {fmt(line.qtyAvailable)} {line.uom} available ·
                          cost {line.unitCost != null ? money(line.unitCost) : 'unknown'} /{' '}
                          {line.uom.replace(/s$/, '')}
                        </p>
                      </div>
                      <button
                        className="dgn-btn dgn-btn-ghost"
                        onClick={() =>
                          setLines((prev) => prev.filter((_, i) => i !== index))
                        }
                        aria-label={`Remove ${line.batchNumber}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Field label={`Quantity (${line.uom})`}>
                        <input
                          className="dgn-input"
                          type="number"
                          inputMode="decimal"
                          value={line.qty}
                          onChange={(e) => updateLine(index, { qty: e.target.value })}
                        />
                      </Field>
                      <Field label="Unit price (₦)">
                        <input
                          className="dgn-input"
                          type="number"
                          inputMode="decimal"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                        />
                      </Field>
                      <div>
                        <span className="dgn-label">Line total</span>
                        <p className="mt-2 text-lg font-semibold">{money(qty * price)}</p>
                        <p
                          className={
                            'text-xs ' +
                            (lineMargin >= 0 ? 'text-teal-700' : 'text-red-700')
                          }
                        >
                          margin {money(lineMargin)}
                        </p>
                      </div>
                    </div>
                    {overDrawn && (
                      <p className="mt-2 text-xs font-semibold text-red-700">
                        Only {fmt(line.qtyAvailable)} {line.uom} are in stock for this batch.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {remaining.length > 0 && (
              <div className="mt-5">
                <p className="dgn-label">Accepted batches available</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {remaining.map((batch) => (
                    <button
                      key={batch.id}
                      className="rounded-xl border border-[var(--line)] px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
                      onClick={() => addLine(batch)}
                    >
                      <span className="font-mono text-xs font-semibold">
                        {batch.batchNumber}
                      </span>
                      <p className="text-xs text-[var(--ink-faint)]">
                        {batch.productName} · {fmt(batch.qtyAvailable)} {batch.uom}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-semibold">Dispatch details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Vehicle number">
                <input
                  className="dgn-input"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="KN-455-XA"
                />
              </Field>
              <Field label="Driver name">
                <input
                  className="dgn-input"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </Field>
              <Field label="Driver phone">
                <input
                  className="dgn-input"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                />
              </Field>
              <Field label="Destination">
                <input
                  className="dgn-input"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Notes">
                <textarea
                  className="dgn-input"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the office should know about this dispatch"
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="lg:sticky lg:top-6">
            <h2 className="text-base font-semibold">Money</h2>
            <div className="mt-4 grid gap-4">
              <Field label="Discount (₦)" hint="Taken off the value of the goods">
                <input
                  className="dgn-input"
                  type="number"
                  inputMode="decimal"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </Field>
              <Field label="Transport charged (₦)" hint="Added on top, if the customer pays it">
                <input
                  className="dgn-input"
                  type="number"
                  inputMode="decimal"
                  value={transportCharge}
                  onChange={(e) => setTransportCharge(e.target.value)}
                />
              </Field>
              <Field label="Amount paid now (₦)">
                <input
                  className="dgn-input"
                  type="number"
                  inputMode="decimal"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            <div className="mt-5 space-y-2 rounded-2xl bg-zinc-50 p-4 text-sm">
              <Row label="Goods value" value={money(computed.subtotal)} />
              <Row label="Discount" value={`− ${money(Number(discount) || 0)}`} />
              <Row label="Transport" value={`+ ${money(Number(transportCharge) || 0)}`} />
              <div className="border-t border-[var(--line)] pt-2">
                <Row label="Customer pays" value={money(computed.total)} strong />
              </div>
              <Row label="Cost of these batches" value={money(computed.cost)} />
              <Row
                label="Factory margin"
                value={`${money(computed.margin)} · ${computed.marginPercent.toFixed(1)}%`}
                tone={computed.margin > 0 ? 'good' : 'bad'}
                strong
              />
              {computed.balance > 0 && (
                <Row label="Balance owed" value={money(computed.balance)} tone="bad" />
              )}
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}

            {warning && (
              <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Check this sale</p>
                <p className="mt-1">{warning}</p>
                <button
                  className="dgn-btn dgn-btn-secondary mt-3"
                  disabled={saving}
                  onClick={() => submit(true)}
                >
                  Sell anyway
                </button>
              </div>
            )}

            <button
              className="dgn-btn dgn-btn-primary mt-5 w-full"
              disabled={!canSubmit}
              onClick={() => submit(false)}
            >
              <Truck className="h-4 w-4" />
              {saving ? 'Recording…' : 'Record sale & dispatch'}
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span
        className={
          (strong ? 'font-semibold ' : '') +
          (tone === 'good' ? 'text-teal-700' : tone === 'bad' ? 'text-red-700' : '')
        }
      >
        {value}
      </span>
    </div>
  )
}
