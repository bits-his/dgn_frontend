import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Boxes, CreditCard, Package, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, NairaAmountInput } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { isOutletScoped } from '@/lib/outlet'
import { CreditBar, kindLabel, money, unpaidSummary, type DistributorCredit } from '@/pages/DistributorsPage'
import { DistributorPaymentForm, type UnpaidInvoice } from '@/pages/DistributorPaymentForm'
import { BookPanel, CompactStat, DataRow, StatusChip } from '@/components/outlet/OutletBookUi'

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
  advanceBalance?: number
  notes: string | null
  distributorKind?: 'INTERNAL' | 'EXTERNAL' | string | null
  minOrderQty?: number | null
  isActive: boolean
  credit: DistributorCredit & { unpaid: UnpaidInvoice[]; paymentTermsDays: number; advanceBalance?: number }
  totals: {
    saleCount: number
    revenue: number
    collected: number
    outstanding: number
    advanceBalance?: number
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
  outlet?: {
    remainingQty: number
    stock: {
      productId: number
      productName: string
      uom: string
      received: number
      sold: number
      remaining: number
    }[]
    money: {
      generated: number
      collected: number
      creditOutstanding: number
      todayGenerated: number
      saleCount: number
    }
    sales: {
      id: number
      saleNumber: string
      buyerName: string | null
      saleType: string
      businessDate: string | null
      totalAmount: number
      amountPaid: number
      balanceDue: number
      paymentStatus: string
      soldBy: string | null
    }[]
  }
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
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [advanceForm, setAdvanceForm] = useState({
    amount: '',
    paymentMethod: 'TRANSFER',
    reference: '',
    notes: '',
  })
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    region: '',
    address: '',
    creditLimit: '',
    paymentTermsDays: '',
    notes: '',
  distributorKind: 'EXTERNAL' as 'INTERNAL' | 'EXTERNAL' | 'SHOP',
    minOrderQty: '',
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
      distributorKind: (['INTERNAL', 'SHOP'].includes(
        String(d.distributorKind || '').toUpperCase(),
      )
        ? String(d.distributorKind).toUpperCase()
        : 'EXTERNAL') as 'INTERNAL' | 'EXTERNAL' | 'SHOP',
      minOrderQty: String(d.minOrderQty ?? ''),
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
        creditLimit: form.distributorKind === 'SHOP' ? 0 : Number(form.creditLimit),
        paymentTermsDays: form.distributorKind === 'SHOP' ? 0 : Number(form.paymentTermsDays || 14),
        notes: form.notes.trim() || null,
        distributorKind: form.distributorKind,
        minOrderQty: form.distributorKind === 'SHOP' ? 0 : Number(form.minOrderQty),
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

  const advanceMutation = useMutation({
    mutationFn: async () => {
      if (!detail.data) throw new Error('Missing distributor')
      const { data } = await api.post(`/distributors/${detail.data.code}/advance`, {
        amount: Number(advanceForm.amount),
        paymentMethod: advanceForm.paymentMethod,
        reference: advanceForm.reference.trim() || null,
        notes: advanceForm.notes.trim() || null,
      })
      return data.data
    },
    onSuccess: async () => {
      setMessage('Advance deposit recorded')
      setError('')
      setAdvanceOpen(false)
      setAdvanceForm({ amount: '', paymentMethod: 'TRANSFER', reference: '', notes: '' })
      await qc.invalidateQueries({ queryKey: ['distributor', code] })
      await qc.invalidateQueries({ queryKey: ['distributors'] })
      await qc.invalidateQueries({ queryKey: ['distributor-credit'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: { data?: { err?: string; errors?: Record<string, string> } }
        message?: string
      }
      const errors = axiosErr.response?.data?.errors
      setMessage('')
      setError(
        (errors && Object.values(errors).join(' · ')) ||
          axiosErr.response?.data?.err ||
          axiosErr.message ||
          'Could not record advance',
      )
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
  const isShop = String(d.distributorKind || '').toUpperCase() === 'SHOP'
  const creditClosed = !isShop && c.creditLimit > 0 && c.atLimit
  const unpaid = c.unpaid || []
  const advanceBalance = Number(
    d.advanceBalance ?? c.advanceBalance ?? d.totals.advanceBalance ?? 0,
  )

  const refreshAfterPayment = async () => {
    setPaying(null)
    setMessage('Payment recorded')
    await qc.invalidateQueries({ queryKey: ['distributor', code] })
    await qc.invalidateQueries({ queryKey: ['distributors'] })
    await qc.invalidateQueries({ queryKey: ['sales'] })
  }

  return (
    <PageLayout
      bare
      title={d.name}
      description={`${d.code} · ${kindLabel(d.distributorKind)}${d.region ? ` · ${d.region}` : ''}`}
      back={!isOutletScoped(user)}
      backTo="/distributors"
      backLabel="All"
      actions={
        isOutletScoped(user) ? (
          <Button size="sm" className="h-8 gap-1 text-xs font-semibold" asChild>
            <Link to="/shop/sales/new">
              <Plus className="size-3.5" />
              Record
            </Link>
          </Button>
        ) : canSell ? (
          <Button size="sm" className="h-8 text-xs font-semibold" asChild>
            <Link to={`/sales/new?customer=${d.id}`}>{isShop ? 'Issue stock' : 'New sale'}</Link>
          </Button>
        ) : null
      }
    >
      <div className="space-y-2.5">
        {(message || error) && (
          <p className={`text-xs font-medium ${error ? 'text-red-700' : 'text-teal-800'}`}>
            {error || message}
          </p>
        )}

        {d.isActive === false && (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-700">
            Inactive — dispatch is blocked until you start selling again.
          </p>
        )}
        {!isShop && creditClosed && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800">
            Credit closed. They owe {money(c.outstanding)} of {money(c.creditLimit)}. Cash collection still allowed.
          </p>
        )}

        {isShop ? (
              <>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <CompactStat
                    label="Stock left"
                    value={fmt(d.outlet?.remainingQty || 0)}
                    icon={Boxes}
                    tone="info"
                  />
                  <CompactStat
                    label="Generated"
                    value={money(d.outlet?.money.generated || 0)}
                    hint={`${d.outlet?.money.saleCount || 0} shop sales`}
                    icon={Banknote}
                    tone="ok"
                  />
                  <CompactStat
                    label="Collected"
                    value={money(d.outlet?.money.collected || 0)}
                    icon={Banknote}
                    tone="ok"
                  />
                  <CompactStat
                    label="Credit sold"
                    value={money(d.outlet?.money.creditOutstanding || 0)}
                    icon={CreditCard}
                    tone={(d.outlet?.money.creditOutstanding || 0) > 0.001 ? 'warn' : 'neutral'}
                  />
                </div>
                <div className="grid gap-2.5 lg:grid-cols-2">
                <BookPanel title="Stock on hand">
                  {(d.outlet?.stock || []).length === 0 ? (
                    <p className="text-xs text-zinc-500">No stock at this shop yet.</p>
                  ) : (
                    d.outlet!.stock.map((row) => (
                      <DataRow
                        key={row.productId}
                        title={row.productName}
                        meta={`${fmt(row.received)} in · ${fmt(row.sold)} sold`}
                        value={`${fmt(row.remaining)} ${row.uom}`}
                      />
                    ))
                  )}
                </BookPanel>
                <BookPanel title="Shop sales">
                  {(d.outlet?.sales || []).length === 0 ? (
                    <p className="text-xs text-zinc-500">No sales recorded yet.</p>
                  ) : (
                    d.outlet!.sales.map((sale) => (
                      <DataRow
                        key={sale.id}
                        title={sale.buyerName || 'Walk-in'}
                        meta={`${sale.saleNumber} · ${sale.saleType.toLowerCase()}`}
                        value={money(sale.totalAmount)}
                        hint={sale.balanceDue > 0.001 ? `Owes ${money(sale.balanceDue)}` : undefined}
                      />
                    ))
                  )}
                </BookPanel>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <CompactStat
                    label="Owes"
                    value={money(c.outstanding)}
                    hint={unpaidSummary(c)}
                    icon={CreditCard}
                    tone={c.outstanding > 0.001 ? 'warn' : 'ok'}
                  />
                  <CompactStat
                    label="Available"
                    value={money(c.available)}
                    hint={c.creditLimit > 0 ? `of ${money(c.creditLimit)}` : 'Cash only'}
                    tone={creditClosed ? 'warn' : 'ok'}
                  />
                  <CompactStat
                    label="Collected"
                    value={money(d.totals.collected)}
                    hint={`${c.saleCount || d.totals.saleCount || 0} invoices`}
                    icon={Banknote}
                    tone="ok"
                  />
                  <CompactStat
                    label="Units taken"
                    value={fmt(d.totals.qtySold)}
                    hint={`${fmt(d.totals.qtyReturned)} returned`}
                    icon={Package}
                    tone="info"
                  />
                </div>
                <BookPanel title="Credit line">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="text-zinc-600">
                      {money(c.outstanding)} outstanding
                    </span>
                    <span className={creditClosed ? 'font-semibold text-red-700' : 'font-semibold text-teal-800'}>
                      {money(c.available)} left
                    </span>
                  </div>
                  <div className="mt-2">
                    <CreditBar percent={c.utilizationPercent} atLimit={creditClosed} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                    <span>Advance {money(advanceBalance)}</span>
                    {canEdit && (
                      <button
                        type="button"
                        className="font-semibold text-amber-800"
                        onClick={() => {
                          setError('')
                          setAdvanceOpen(true)
                        }}
                      >
                        Record advance
                      </button>
                    )}
                  </div>
                </BookPanel>
                {unpaid.length > 0 && (
                  <BookPanel
                    title="Unpaid invoices"
                    action={
                      canSell ? (
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-amber-800"
                          onClick={() => setPaying(unpaid)}
                        >
                          Collect all
                        </button>
                      ) : null
                    }
                  >
                    {unpaid.map((row) => (
                      <div
                        key={row.saleNumber}
                        className="flex items-start justify-between gap-3 border-b border-zinc-100 py-2 last:border-0 last:pb-0 first:pt-0"
                      >
                        <div className="min-w-0">
                          <Link
                            to={`/sales/${row.saleNumber}`}
                            className="font-mono text-xs font-semibold text-amber-800"
                          >
                            {row.saleNumber}
                          </Link>
                          <p className="flex flex-wrap items-center gap-1 text-[11px] text-zinc-500">
                            {row.ageDays ?? 0}d
                            {row.overdue ? <StatusChip tone="danger">Overdue</StatusChip> : null}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold tabular-nums text-red-700">
                            {money(row.balanceDue)}
                          </p>
                          {canSell && (
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-amber-800"
                              onClick={() => setPaying([row])}
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </BookPanel>
                )}
              </>
            )}

            <BookPanel title={isShop ? 'Received from factory' : 'Dispatch history'}>
              {d.sales.length === 0 ? (
                <p className="text-xs text-zinc-500">Nothing dispatched yet.</p>
              ) : (
                d.sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="border-b border-zinc-100 py-2 last:border-0 last:pb-0 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/sales/${sale.saleNumber}`}
                          className="font-mono text-xs font-semibold text-amber-800"
                        >
                          {sale.saleNumber}
                        </Link>
                        <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                          {sale.lines
                            .map((l) => `${l.productName || l.batchNumber} × ${fmt(l.qty)}`)
                            .join(', ') || `${sale.lineCount} lines`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {!isShop && <p className="text-xs font-semibold tabular-nums">{money(sale.totalAmount)}</p>}
                        <StatusChip
                          tone={
                            sale.paymentStatus === 'PAID' || sale.paymentStatus === 'SETTLED'
                              ? 'ok'
                              : sale.paymentStatus === 'PARTIAL'
                                ? 'warn'
                                : isShop
                                  ? 'muted'
                                  : 'danger'
                          }
                        >
                          {isShop ? 'Received' : sale.paymentStatus}
                        </StatusChip>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </BookPanel>
            {d.returns.length > 0 && (
              <BookPanel title="Returns">
                {d.returns.map((ret) => (
                  <DataRow
                    key={ret.id}
                    title={ret.returnNumber}
                    meta={`${ret.saleNumber || '—'} · ${fmt(ret.qty)} ${ret.uom}`}
                    value={money(ret.refundAmount)}
                  />
                ))}
              </BookPanel>
            )}

            <BookPanel
              title="Details"
              action={
                canEdit && !editing ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-amber-800"
                    onClick={() => setEditing(true)}
                  >
                    Edit
                  </button>
                ) : null
              }
            >
              {!editing ? (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Fact label="Contact" value={d.contactPerson || '—'} />
                  <Fact label="Phone" value={d.phone || '—'} />
                  <Fact label="Region" value={d.region || '—'} />
                  <Fact label="Status" value={d.isActive ? 'Active' : 'Inactive'} />
                  {!isShop && (
                    <>
                      <Fact label="Terms" value={`${d.paymentTermsDays} days`} />
                      <Fact
                        label="Min qty"
                        value={
                          Number(d.minOrderQty || 0) > 0
                            ? Number(d.minOrderQty).toLocaleString()
                            : 'None'
                        }
                      />
                    </>
                  )}
                  <div className="col-span-2">
                    <Fact label="Address" value={d.address || '—'} />
                  </div>
                  {d.notes && (
                    <div className="col-span-2">
                      <Fact label="Notes" value={d.notes} />
                    </div>
                  )}
                </dl>
              ) : (
                <form
                  className="grid gap-3 sm:grid-cols-2"
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
                  <div className="sm:col-span-2">
                    <Field label="Address">
                      <input
                        className="dgn-input"
                        value={form.address}
                        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      />
                    </Field>
                  </div>
                  {form.distributorKind !== 'SHOP' && (
                    <>
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
                      <Field label="Type">
                        <select
                          className="dgn-input"
                          value={form.distributorKind}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              distributorKind: (['INTERNAL', 'SHOP'].includes(e.target.value)
                                ? e.target.value
                                : 'EXTERNAL') as 'INTERNAL' | 'EXTERNAL' | 'SHOP',
                            }))
                          }
                        >
                          <option value="EXTERNAL">External dealer</option>
                          <option value="INTERNAL">Internal distributor</option>
                          <option value="SHOP">Market shop</option>
                        </select>
                      </Field>
                      <Field label="Minimum quantity">
                        <input
                          className="dgn-input"
                          type="number"
                          min={0}
                          inputMode="decimal"
                          value={form.minOrderQty}
                          onChange={(e) => setForm((f) => ({ ...f, minOrderQty: e.target.value }))}
                          required
                        />
                      </Field>
                    </>
                  )}
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
                  </div>
                </form>
              )}
            </BookPanel>
            {!isShop && (
              <BookPanel title="What they buy">
                {d.byProduct.length === 0 ? (
                  <p className="text-xs text-zinc-500">No purchases yet.</p>
                ) : (
                  d.byProduct.map((row) => (
                    <DataRow
                      key={row.productId}
                      title={row.productName}
                      meta={`${fmt(row.qty)} units`}
                      value={money(row.revenue)}
                    />
                  ))
                )}
              </BookPanel>
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

        {advanceOpen && (
          <Dialog title="Record advance payment" onClose={() => setAdvanceOpen(false)}>
            <p className="mb-4 text-sm text-zinc-700">
              Use this when {d.name} pays money before buying goods. The amount is held as their
              advance balance and can be deducted on the next sale.
            </p>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                advanceMutation.mutate()
              }}
            >
              <Field label="Amount">
                <NairaAmountInput
                  value={advanceForm.amount}
                  onChange={(value) => setAdvanceForm((f) => ({ ...f, amount: value }))}
                  required
                />
              </Field>
              <Field label="Payment method">
                <select
                  className="dgn-input"
                  value={advanceForm.paymentMethod}
                  onChange={(e) => setAdvanceForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                >
                  <option value="TRANSFER">Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="POS">POS</option>
                </select>
              </Field>
              <Field label="Reference">
                <input
                  className="dgn-input"
                  value={advanceForm.reference}
                  onChange={(e) => setAdvanceForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="Bank reference / receipt no."
                />
              </Field>
              <Field label="Notes">
                <textarea
                  className="dgn-input"
                  rows={2}
                  value={advanceForm.notes}
                  onChange={(e) => setAdvanceForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional"
                />
              </Field>
              {error && <p className="text-sm text-red-700">{error}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  className="dgn-btn dgn-btn-primary"
                  disabled={advanceMutation.isPending || !(Number(advanceForm.amount) > 0)}
                >
                  {advanceMutation.isPending ? 'Saving…' : 'Save advance'}
                </button>
                <button
                  type="button"
                  className="dgn-btn dgn-btn-ghost"
                  onClick={() => setAdvanceOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Dialog>
        )}
      </div>
    </PageLayout>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-zinc-900">{value}</p>
    </div>
  )
}
