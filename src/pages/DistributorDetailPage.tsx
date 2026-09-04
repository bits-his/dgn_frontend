import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, NairaAmountInput } from '@/components/ui'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { CreditBar, money, unpaidSummary, type DistributorCredit } from '@/pages/DistributorsPage'
import { DistributorPaymentForm, type UnpaidInvoice } from '@/pages/DistributorPaymentForm'

type SaleRow = {
  id: number
  saleNumber: string
  saleType: string
  status: string
  businessDate: string | null
  totalAmount: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  destination: string | null
  vehicleNumber: string | null
  driverName: string | null
  soldBy: string | null
  lineCount: number
  lines: {
    id: number
    batchNumber: string | null
    productName: string | null
    qty: number
    qtyReturned: number
    uom: string
    unitPrice: number
    lineTotal: number
  }[]
}

type DistributorDetail = {
  id: number
  code: string
  name: string
  phone: string | null
  address: string | null
  contactPerson: string | null
  region: string | null
  paymentTermsDays: number
  creditLimit: number
  notes: string | null
  isActive: boolean
  credit: DistributorCredit & { unpaid: UnpaidInvoice[]; paymentTermsDays: number }
  totals: {
    saleCount: number
    revenue: number
    collected: number
    outstanding: number
    qtySold: number
    qtyReturned: number
    returnRatePercent: number
    lastSaleNumber: string | null
    lastSaleDate: string | null
  }
  byProduct: { productId: number; productName: string; qty: number; revenue: number }[]
  sales: SaleRow[]
  returns: {
    id: number
    returnNumber: string
    saleNumber: string | null
    batchNumber: string | null
    qty: number
    uom: string
    reason: string
    condition: string
    refundAmount: number
    businessDate: string | null
    notes: string | null
  }[]
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="dgn-card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-2xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="dgn-btn dgn-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

export function DistributorDetailPage() {
  const { code } = useParams()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canEdit = hasPermission(user, 'sales.create') || hasPermission(user, 'masters.manage')
  const canSell = hasPermission(user, 'sales.create')
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [paying, setPaying] = useState<UnpaidInvoice[] | null>(null)
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    region: '',
    address: '',
    creditLimit: '',
    paymentTermsDays: '',
    notes: '',
    isActive: true,
  })

  const detail = useQuery({
    queryKey: ['distributor', code],
    enabled: Boolean(code),
    queryFn: async () => {
      const { data } = await api.get(`/distributors/${code}`)
      return data.data as DistributorDetail
    },
  })

  useEffect(() => {
    const d = detail.data
    if (!d) return
    setForm({
      name: d.name || '',
      contactPerson: d.contactPerson || '',
      phone: d.phone || '',
      region: d.region || '',
      address: d.address || '',
      creditLimit: String(d.creditLimit ?? ''),
      paymentTermsDays: String(d.paymentTermsDays ?? 14),
      notes: d.notes || '',
      isActive: d.isActive !== false,
    })
  }, [detail.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!detail.data) throw new Error('Missing distributor')
      const { data } = await api.patch(`/distributors/${detail.data.id}`, {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || null,
        phone: form.phone.trim() || null,
        region: form.region.trim() || null,
        address: form.address.trim() || null,
        creditLimit: Number(form.creditLimit),
        paymentTermsDays: Number(form.paymentTermsDays || 14),
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      })
      return data.data
    },
    onSuccess: async () => {
      setMessage('Saved')
      setError('')
      setEditing(false)
      await qc.invalidateQueries({ queryKey: ['distributor', code] })
      await qc.invalidateQueries({ queryKey: ['distributors'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { err?: string } }; message?: string }
      setMessage('')
      setError(axiosErr.response?.data?.err || axiosErr.message || 'Could not save')
    },
  })

  if (detail.isLoading) {
    return <p className="text-sm text-zinc-800">Loading distributor…</p>
  }

  if (detail.isError || !detail.data) {
    return (
      <Card>
        <p className="text-sm text-red-700">That distributor could not be found.</p>
        <Link className="dgn-btn dgn-btn-secondary mt-4" to="/distributors">
          Back to distributors
        </Link>
      </Card>
    )
  }

  const d = detail.data
  const c = d.credit
  const creditClosed = c.creditLimit > 0 && c.atLimit
  const unpaid = c.unpaid || []

  const refreshAfterPayment = async () => {
    setPaying(null)
    setMessage('Payment recorded')
    await qc.invalidateQueries({ queryKey: ['distributor', code] })
    await qc.invalidateQueries({ queryKey: ['distributors'] })
    await qc.invalidateQueries({ queryKey: ['sales'] })
  }

  return (
    <div>
      <div className="mb-6">
        <Link className="dgn-btn dgn-btn-ghost" to="/distributors">
          <ArrowLeft className="h-4 w-4" /> All distributors
        </Link>
      </div>

      {(message || error) && (
        <p className={`mb-4 text-sm ${error ? 'text-red-700' : 'text-zinc-800'}`}>{error || message}</p>
      )}

      {d.isActive === false && (
        <Card className="mb-6 border-zinc-200 bg-zinc-50">
          <p className="text-sm font-semibold">Not selling to this distributor</p>
          <p className="mt-1 text-sm text-zinc-800">
            They remain in the book with their ledger. Dispatch is blocked until you start selling
            again.
          </p>
        </Card>
      )}

      {creditClosed && (
        <Card className="mb-6 border-red-200 bg-red-50/60">
          <p className="text-sm font-semibold text-red-800">No more goods on credit until they pay</p>
          <p className="mt-1 text-sm text-red-800">
            {d.name} already owes {money(c.outstanding)} against a {money(c.creditLimit)} limit.
            Cash-on-collection is still allowed. Credit dispatch is blocked.
          </p>
        </Card>
      )}
      {c.creditLimit <= 0 && (
        <Card className="mb-6 border-zinc-200 bg-zinc-50">
          <p className="text-sm font-semibold">Cash only</p>
          <p className="mt-1 text-sm text-zinc-800">
            This distributor has no credit facility. Goods may leave only when the full amount is
            paid on dispatch.
          </p>
        </Card>
      )}

      <Card className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight">{d.name}</h1>
      <p className="mt-1 font-mono text-xs text-[var(--ink-muted)]">{d.code}</p>
        <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
          <span></span>
          <span className={creditClosed ? 'font-semibold text-red-700' : 'font-semibold text-teal-800'}>
            {money(c.available)} left
          </span>
        </div>
        <p className="mb-2 text-sm text-zinc-700">
          Owes {money(c.outstanding)} of {money(c.creditLimit)} limit
        </p>
        <CreditBar percent={c.utilizationPercent} atLimit={creditClosed} />
        <div className="mt-3 grid gap-2 text-xs text-zinc-700 sm:grid-cols-3">
          <span>{c.saleCount || d.totals.saleCount || 0} sales</span>
          <span>Bought {money(d.totals.revenue)}</span>
          <span>{unpaidSummary(c)}</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Fact label="Collected" value={money(d.totals.collected)} />
          <Fact label="Units taken" value={fmt(d.totals.qtySold)} />
          <Fact
            label="Returned"
            value={`${fmt(d.totals.qtyReturned)} · ${d.totals.returnRatePercent}%`}
          />
        </div>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Profile</h2>
            {canEdit && !editing && (
              <button
                type="button"
                className="text-sm font-semibold text-[var(--accent-strong)]"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
            )}
          </div>
          {!editing ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              <Fact label="Contact" value={d.contactPerson || '—'} />
              <Fact label="Phone" value={d.phone || '—'} />
              <Fact label="Region" value={d.region || '—'} />
              <Fact label="Address" value={d.address || '—'} />
              <Fact label="Payment terms" value={`${d.paymentTermsDays} days`} />
              <Fact label="Status" value={d.isActive ? 'Active' : 'Inactive'} />
              {d.notes && (
                <div className="sm:col-span-2">
                  <Fact label="Notes" value={d.notes} />
                </div>
              )}
            </dl>
          ) : (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
            >
              <Field label="Business name">
                <input
                  className="dgn-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Contact person">
                <input
                  className="dgn-input"
                  value={form.contactPerson}
                  onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="dgn-input"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </Field>
              <Field label="Region">
                <input
                  className="dgn-input"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                />
              </Field>
              <Field label="Address">
                <input
                  className="dgn-input"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </Field>
              <Field label="Credit limit">
                <NairaAmountInput
                  value={form.creditLimit}
                  onChange={(value) => setForm((f) => ({ ...f, creditLimit: value }))}
                  required
                />
              </Field>
              <Field label="Payment terms (days)">
                <input
                  className="dgn-input"
                  type="number"
                  min={0}
                  max={365}
                  value={form.paymentTermsDays}
                  onChange={(e) => setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))}
                />
              </Field>
              <Field label="Status">
                <select
                  className="dgn-input"
                  value={form.isActive ? '1' : '0'}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === '1' }))}
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <textarea
                    className="dgn-input"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="dgn-btn dgn-btn-primary"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="dgn-btn dgn-btn-ghost"
                  onClick={() => {
                    setEditing(false)
                    setError('')
                  }}
                >
                  Cancel
                </button>
                {(message || error) && (
                  <p className={`text-sm ${error ? 'text-red-600' : 'text-zinc-800'}`}>
                    {error || message}
                  </p>
                )}
              </div>
            </form>
          )}
        </Card>

        <Card>
          <h2 className="text-base font-semibold">What they buy</h2>
          {d.byProduct.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-800">No purchases yet.</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-zinc-700">
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {d.byProduct.map((row) => (
                  <tr key={row.productId} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-2 pr-3">{row.productName}</td>
                    <td className="py-2 pr-3 text-right">{fmt(row.qty)}</td>
                    <td className="py-2 text-right font-semibold">{money(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {unpaid.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Unpaid invoices</h2>
              <p className="mt-1 text-sm text-zinc-800">
                These dispatches have left the factory. Collecting them frees credit so they can take
                more goods.
              </p>
            </div>
            {canSell && (
              <button
                type="button"
                className="dgn-btn dgn-btn-primary !px-3 !py-1.5 text-sm"
                onClick={() => setPaying(unpaid)}
              >
                Record payment
              </button>
            )}
          </div>
          <div className="mt-4 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-zinc-700">
                  <th className="py-2 pr-4">Sale</th>
                  <th className="py-2 pr-4">Age</th>
                  <th className="py-2 pr-4 text-right">Invoiced</th>
                  <th className="py-2 pr-4 text-right">Paid</th>
                  <th className="py-2 pr-4 text-right">Still owed</th>
                  <th className="py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {unpaid.map((row) => (
                  <tr key={row.saleNumber} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-2.5 pr-4">
                      <Link
                        to={`/sales/${row.saleNumber}`}
                        className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                      >
                        {row.saleNumber}
                      </Link>
                      {row.overdue && (
                        <span className="ml-2 rounded-lg bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-800">{row.ageDays ?? 0}d</td>
                    <td className="py-2.5 pr-4 text-right">{money(row.totalAmount || 0)}</td>
                    <td className="py-2.5 pr-4 text-right">{money(row.amountPaid || 0)}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-red-700">
                      {money(row.balanceDue)}
                    </td>
                    <td className="py-2.5 text-right">
                      {canSell && (
                        <button
                          type="button"
                          className="text-sm font-semibold text-[var(--accent-strong)]"
                          onClick={() => setPaying([row])}
                        >
                          Record payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="text-base font-semibold">Sales history</h2>
        {d.sales.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-800">Nothing dispatched to them yet.</p>
        ) : (
          <div className="mt-4 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-zinc-700">
                  <th className="py-2 pr-4">Sale</th>
                  <th className="py-2 pr-4">Goods</th>
                  <th className="py-2 pr-4 text-right">Value</th>
                  <th className="py-2 pr-4">Payment</th>
                  <th className="py-2 pr-4">Vehicle</th>
                </tr>
              </thead>
              <tbody>
                {d.sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-3 pr-4">
                      <Link
                        to={`/sales/${sale.saleNumber}`}
                        className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                      >
                        {sale.saleNumber}
                      </Link>
                      <p className="text-xs text-zinc-700">
                        {sale.saleType} · {sale.status.replace('_', ' ').toLowerCase()}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-xs text-zinc-800">
                      {sale.lines
                        .map((l) => `${l.productName || l.batchNumber} × ${fmt(l.qty)}`)
                        .join(', ') || `${sale.lineCount} lines`}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold">{money(sale.totalAmount)}</td>
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
                    <td className="py-3 pr-4 text-xs text-zinc-800">
                      {sale.vehicleNumber || '—'}
                      {sale.destination && <p>{sale.destination}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {d.returns.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold">Returns from this distributor</h2>
          <div className="mt-4 space-y-3">
            {d.returns.map((ret) => (
              <div key={ret.id} className="rounded-xl border border-[var(--line)] px-3 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-semibold">{ret.returnNumber}</span>
                  <span className="text-zinc-800">{money(ret.refundAmount)}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-800">
                  {ret.saleNumber} · {fmt(ret.qty)} {ret.uom} · {ret.reason.replace(/_/g, ' ').toLowerCase()}{' '}
                  · {ret.condition.toLowerCase()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {paying && (
        <Dialog title="Record payment" onClose={() => setPaying(null)}>
          <DistributorPaymentForm
            key={paying.map((row) => row.saleNumber).join(',')}
            unpaid={paying}
            onSaved={refreshAfterPayment}
          />
        </Dialog>
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-900">{value}</p>
    </div>
  )
}
