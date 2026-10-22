import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Plus, ExternalLink } from 'lucide-react'
import { fmtDozenPcs, isPieceUom, qtyDozenLabel } from '@/lib/units'
import { api } from '@/lib/api'
import { Card, Field, NairaAmountInput } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import {
  isOutletScoped,
  shopBuyerPath,
  shopRecordSalePath,
  shopSalesListPath,
  shopSalePath,
} from '@/lib/outlet'
import { formatBusinessDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { CreditBar, kindLabel, money, unpaidSummary, type DistributorCredit } from '@/pages/DistributorsPage'
import { DistributorPaymentForm, type UnpaidInvoice } from '@/pages/DistributorPaymentForm'
import { BookPanel, StatusChip } from '@/components/outlet/OutletBookUi'
import {
  ShopCustomersBoard,
  type ShopBuyerRow,
} from '@/components/outlet/ShopCustomersBoard'

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
  isOutletSale?: boolean
  outletName?: string | null
  lines: {
    id: number
    batchNumber?: string | null
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
  ledger?: {
    receivable: number
    advance: number
    /** Netted amount they still owe (0 if advance covers receivable). */
    owed: number
    /** Netted advance held (0 if they still owe overall). */
    held: number
    net: number
    txns: {
      id: number
      account: string
      entryType: string
      debit: number
      credit: number
      balanceAfter: number
      saleId?: number | null
      saleNumber: string | null
      businessDate: string | null
      paymentMethod: string | null
      reference: string | null
      notes: string | null
      createdAt?: string
    }[]
  }
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
      outletBuyerId?: number | null
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

type LedgerEntry = {
  id: string
  dateLabel: string
  title: string
  meta?: string
  debit: number
  credit: number
  balanceAfter: number
  href?: string
  saleNumber?: string | null
  entryType?: string
  expandable?: boolean
}

function entryTypeLabel(entryType: string) {
  const t = String(entryType || '').toUpperCase()
  if (t === 'SALE') return 'Sale'
  if (t === 'PAYMENT') return 'Payment'
  if (t === 'OPENING_RECEIVABLE') return 'Opening receivable'
  if (t === 'OPENING_ADVANCE') return 'Opening advance'
  if (t === 'ADVANCE_DEPOSIT') return 'Advance deposit'
  if (t === 'ADVANCE_APPLY') return 'Advance applied'
  if (t === 'SALE_RETURN') return 'Return'
  return entryType || 'Entry'
}

function buildLedgerFromServer(
  txns: NonNullable<DistributorDetail['ledger']>['txns'],
): LedgerEntry[] {
  // Statement = receivable activity + advance deposits (wallet top-ups).
  // Skip ADVANCE/ADVANCE_APPLY — that apply already appears as a receivable credit.
  const rows = txns.filter((t) => {
    const account = String(t.account).toUpperCase()
    const entryType = String(t.entryType || '').toUpperCase()
    if (account === 'RECEIVABLE') return true
    if (account === 'ADVANCE') {
      return entryType === 'ADVANCE_DEPOSIT' || entryType === 'OPENING_ADVANCE'
    }
    return false
  })

  // Oldest → newest for running net due (receivable − advance held).
  const chronological = rows.slice().sort((a, b) => {
    const da = String(a.businessDate || '')
    const db = String(b.businessDate || '')
    if (da !== db) return da.localeCompare(db)
    return Number(a.id) - Number(b.id)
  })

  let netDue = 0
  const withBalance = chronological.map((t) => {
    const account = String(t.account).toUpperCase()
    const entryType = String(t.entryType || '').toUpperCase()
    const debit = Number(t.debit || 0)
    const credit = Number(t.credit || 0)

    if (account === 'RECEIVABLE') {
      netDue = +(netDue + debit - credit).toFixed(2)
    } else if (account === 'ADVANCE') {
      // Deposit increases prepaid wallet → reduces net due.
      netDue = +(netDue - credit + debit).toFixed(2)
    }

    const saleNo = t.saleNumber || t.reference || null
    let cleanNote = t.notes ? String(t.notes).trim() : null
    if (cleanNote && saleNo && cleanNote.toLowerCase().includes(saleNo.toLowerCase())) {
      cleanNote = null
    }
    if (
      cleanNote &&
      (cleanNote === 'Sale invoice' ||
        cleanNote === 'Backfill advance balance snapshot' ||
        cleanNote.startsWith('Backfill payments on'))
    ) {
      cleanNote = null
    }

    return {
      id: `txn-${t.id}`,
      dateLabel: formatBusinessDate(t.businessDate) || '—',
      title: saleNo
        ? `${entryTypeLabel(t.entryType)} · ${saleNo}`
        : entryTypeLabel(t.entryType),
      meta: [t.paymentMethod, cleanNote].filter(Boolean).join(' · ') || undefined,
      debit,
      credit,
      balanceAfter: netDue,
      saleNumber: saleNo,
      entryType,
      // Factory and shop sales expand with line items
      expandable:
        (entryType === 'SALE' || entryType === 'SALE_RETURN') &&
        Boolean(t.saleId || t.saleNumber || t.reference),
    }
  })

  // Newest first on screen (same as before).
  return withBalance.reverse()
}

function buildDistributorLedger(
  sales: SaleRow[],
  returns: DistributorDetail['returns'],
): LedgerEntry[] {
  type Raw = {
    id: string
    sortKey: string
    dateLabel: string
    title: string
    meta?: string
    debit: number
    credit: number
    href?: string
    saleNumber?: string | null
    entryType?: string
    expandable?: boolean
  }
  const raw: Raw[] = []

  const salesAsc = [...sales].reverse()
  for (const sale of salesAsc) {
    const dateLabel = formatBusinessDate(sale.businessDate) || '—'
    const sortKey = `${sale.businessDate || '000000'}-${sale.id}-1`
    const linesMeta =
      sale.lines
        .map((l) => `${l.productName || l.batchNumber} × ${fmt(l.qty)}`)
        .join(', ') || `${sale.lineCount} lines`
    raw.push({
      id: `sale-${sale.id}`,
      sortKey,
      dateLabel,
      title: 'Sale',
      meta: linesMeta,
      debit: Number(sale.totalAmount || 0),
      credit: 0,
      saleNumber: sale.saleNumber,
      entryType: 'SALE',
      expandable: true,
    })
    if (Number(sale.amountPaid || 0) > 0.001) {
      raw.push({
        id: `pay-${sale.id}`,
        sortKey: `${sale.businessDate || '000000'}-${sale.id}-2`,
        dateLabel,
        title: 'Payment',
        meta: sale.paymentStatus,
        debit: 0,
        credit: Number(sale.amountPaid || 0),
        saleNumber: sale.saleNumber,
        entryType: 'PAYMENT',
      })
    }
  }

  const returnsAsc = [...returns].reverse()
  for (const ret of returnsAsc) {
    if (!(Number(ret.refundAmount || 0) > 0.001)) continue
    raw.push({
      id: `ret-${ret.id}`,
      sortKey: `${ret.businessDate || '000000'}-ret-${ret.id}`,
      dateLabel: formatBusinessDate(ret.businessDate) || '—',
      title: 'Return',
      meta: undefined,
      debit: 0,
      credit: Number(ret.refundAmount || 0),
      saleNumber: ret.saleNumber,
      entryType: 'SALE_RETURN',
      expandable: Boolean(ret.saleNumber),
    })
  }

  raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  let balance = 0
  const withBalance = raw.map((row) => {
    balance = +(balance + row.debit - row.credit).toFixed(2)
    return { ...row, balanceAfter: balance }
  })
  return withBalance.reverse()
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
  const canOutletSell = hasPermission(user, 'outlet.sell') || hasPermission(user, 'sales.create')
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [expandedLedgerId, setExpandedLedgerId] = useState<string | null>(null)
  const [shopTab, setShopTab] = useState<'overview' | 'customers'>('overview')
  const [paying, setPaying] = useState<UnpaidInvoice[] | null>(null)
  const [openingOpen, setOpeningOpen] = useState(false)
  const [openingForm, setOpeningForm] = useState({
    receivableAmount: '',
    advanceAmount: '',
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

  const isShopKind =
    String(detail.data?.distributorKind || '').toUpperCase() === 'SHOP'

  const shopBuyers = useQuery({
    queryKey: ['outlet-buyers', detail.data?.id],
    enabled: Boolean(detail.data?.id) && isShopKind,
    queryFn: async () => {
      const { data } = await api.get('/outlet-sales/buyers', {
        params: isOutletScoped(user) ? {} : { outletId: detail.data!.id },
      })
      return data.data as {
        rows: ShopBuyerRow[]
        debtors: ShopBuyerRow[]
        totals: { customerCount: number; debtorCount: number; creditOutstanding: number }
      }
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


  const openingMutation = useMutation({
    mutationFn: async () => {
      if (!detail.data) throw new Error('Missing distributor')
      const { data } = await api.post(`/distributors/${detail.data.code}/opening-balance`, {
        receivableAmount: Number(openingForm.receivableAmount) || 0,
        advanceAmount: Number(openingForm.advanceAmount) || 0,
        notes: openingForm.notes.trim() || null,
      })
      return data as { message?: string; data?: unknown }
    },
    onSuccess: async (body) => {
      setMessage(body.message || 'Opening balance recorded')
      setError('')
      setOpeningOpen(false)
      setOpeningForm({ receivableAmount: '', advanceAmount: '', notes: '' })
      await qc.invalidateQueries({ queryKey: ['distributor', code] })
      await qc.invalidateQueries({ queryKey: ['distributors'] })
      await qc.invalidateQueries({ queryKey: ['distributor-credit'] })
      await qc.invalidateQueries({ queryKey: ['sales'] })
      await qc.invalidateQueries({ queryKey: ['dashboard'] })
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
          'Could not save opening balance',
      )
    },
  })

  const d = detail.data
  const isShop = String(d?.distributorKind || '').toUpperCase() === 'SHOP'
  const ledger = useMemo(() => {
    if (!d || isShop) return []
    if (d.ledger?.txns?.length) return buildLedgerFromServer(d.ledger.txns)
    return buildDistributorLedger(d.sales || [], d.returns || [])
  }, [d, isShop])

  if (detail.isLoading) {
    return <p className="text-sm text-zinc-800">Loading distributor…</p>
  }

  if (detail.isError || !d) {
    return (
      <Card>
        <p className="text-sm text-red-700">That distributor could not be found.</p>
        <Link className="dgn-btn dgn-btn-secondary mt-4" to="/distributors">
          Back to distributors
        </Link>
      </Card>
    )
  }

  const c = d.credit
  const creditClosed = !isShop && c.creditLimit > 0 && c.atLimit
  const unpaid = c.unpaid || []
  // Netted advance held after offsetting receivable (0 if they still owe overall)
  const advanceBalance = Number(
    d.ledger?.held ?? d.advanceBalance ?? c.advanceBalance ?? d.totals.advanceBalance ?? 0,
  )

  const refreshAfterPayment = async () => {
    setPaying(null)
    setMessage('Payment recorded')
    await qc.invalidateQueries({ queryKey: ['distributor', code] })
    await qc.invalidateQueries({ queryKey: ['distributors'] })
    await qc.invalidateQueries({ queryKey: ['sales'] })
    await qc.invalidateQueries({ queryKey: ['outlet-sales'] })
    await qc.invalidateQueries({ queryKey: ['outlet-sales-list'] })
    await qc.invalidateQueries({ queryKey: ['outlet-sales-overview'] })
    await qc.invalidateQueries({ queryKey: ['outlet-buyers'] })
    await qc.invalidateQueries({ queryKey: ['outlet-stock'] })
  }

  return (
    <PageLayout
      bare
      title={d.name}
      description={
        isShop
          ? `${kindLabel(d.distributorKind)}${d.region ? ` · ${d.region}` : ''}`
          : `${d.code} · ${kindLabel(d.distributorKind)}${d.region ? ` · ${d.region}` : ''}`
      }
      back={!isOutletScoped(user)}
      backTo="/distributors"
      backLabel="Back"
      actions={
        <div className="flex items-center gap-1.5">
          {canEdit && !isOutletScoped(user) && !isShop ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 text-xs font-semibold whitespace-nowrap"
                onClick={() => {
                  setError('')
                  setOpeningOpen(true)
                }}
              >
                Opening balance
              </Button>
              {!isShop && canSell ? (
                <Button
                  size="sm"
                  className="h-8 px-2.5 text-xs font-semibold whitespace-nowrap bg-zinc-900 hover:bg-zinc-800 text-white"
                  onClick={() => {
                    setError('')
                    setPaying(unpaid)
                  }}
                >
                  Record payment
                </Button>
              ) : null}
            </>
          ) : null}
          {/* Issue stock lives on the distributors list — keep shop detail lean */}
          {!isOutletScoped(user) && canSell && !isShop ? (
            <Button size="sm" className="h-8 px-2.5 text-xs font-semibold whitespace-nowrap" asChild>
              <Link to={`/sales/new?customer=${d.id}`}>New sale</Link>
            </Button>
          ) : null}
          {isShop && canOutletSell ? (
            <Button
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs font-semibold whitespace-nowrap bg-zinc-900 hover:bg-zinc-800 text-white"
              asChild
            >
              <Link to={shopRecordSalePath(isOutletScoped(user) ? null : d.id)}>
                <Plus className="size-3.5" />
                Record sale
              </Link>
            </Button>
          ) : null}
        </div>
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
              <div className="w-full space-y-3">
                {/* Today-at-a-glance */}
                <section className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white">
                  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-100 bg-gradient-to-br from-teal-50/80 via-white to-zinc-50 px-3.5 py-3 sm:px-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-800/70">
                        Shop book
                      </p>
                      <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-zinc-900">
                        {money(d.outlet?.money.generated || 0)}
                        <span className="ml-1.5 text-xs font-medium text-zinc-500">
                          · {d.outlet?.money.saleCount || 0} sales
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        Stock on hand{' '}
                        <span className="font-semibold text-zinc-800">
                          {fmtDozenPcs(d.outlet?.remainingQty || 0)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-zinc-100">
                    <div className="px-3 py-2.5 text-center sm:px-4 sm:text-left">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        Collected
                      </p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-teal-800">
                        {money(d.outlet?.money.collected || 0)}
                      </p>
                    </div>
                    <div className="px-3 py-2.5 text-center sm:px-4 sm:text-left">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        Credit out
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 text-sm font-bold tabular-nums',
                          (d.outlet?.money.creditOutstanding || 0) > 0.001
                            ? 'text-amber-800'
                            : 'text-zinc-900',
                        )}
                      >
                        {money(d.outlet?.money.creditOutstanding || 0)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShopTab('customers')}
                      className="px-3 py-2.5 text-center sm:px-4 sm:text-left hover:bg-zinc-50/80"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        Owing
                      </p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900">
                        {shopBuyers.data?.totals.debtorCount || 0}
                        <span className="ml-1 text-[10px] font-medium text-zinc-400">
                          customers
                        </span>
                      </p>
                    </button>
                  </div>
                </section>

                <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs font-semibold">
                  {(
                    [
                      ['overview', 'Overview'],
                      [
                        'customers',
                        `Customers${
                          shopBuyers.data?.rows?.length
                            ? ` · ${shopBuyers.data.rows.length}`
                            : ''
                        }`,
                      ],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setShopTab(id)}
                      className={cn(
                        'flex-1 rounded-md px-3 py-2 transition-colors',
                        shopTab === id
                          ? 'bg-white text-zinc-900 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-800',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {shopTab === 'customers' ? (
                  <ShopCustomersBoard
                    buyers={shopBuyers.data?.rows || []}
                    debtors={shopBuyers.data?.debtors || []}
                    viewHref={(b) =>
                      shopBuyerPath(b.id, isOutletScoped(user) ? null : d.id, d.code)
                    }
                    limit={200}
                  />
                ) : (
                  <div className="space-y-3">
                    <BookPanel title="Stock on hand">
                      {(d.outlet?.stock || []).length === 0 ? (
                        <p className="py-4 text-center text-xs text-zinc-500">
                          No stock yet — issue goods from the factory first.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {d.outlet!.stock.map((row) => (
                            <div
                              key={row.productId}
                              className="flex flex-col justify-between rounded-lg border border-zinc-100 bg-zinc-50/60 p-2.5"
                            >
                              <div>
                                <h4 className="text-xs font-semibold text-zinc-900 truncate">
                                  {row.productName}
                                </h4>
                                <p className="mt-0.5 text-[10px] text-zinc-500">
                                  {isPieceUom(row.uom)
                                    ? fmtDozenPcs(row.sold)
                                    : `${fmt(row.sold)} ${row.uom}`}{' '}
                                  sold
                                </p>
                              </div>
                              <div className="mt-2 flex items-baseline justify-between border-t border-zinc-200/50 pt-1.5">
                                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                                  On hand
                                </span>
                                <span className="text-xs font-bold text-zinc-900 tabular-nums">
                                  {isPieceUom(row.uom)
                                    ? fmtDozenPcs(row.remaining)
                                    : qtyDozenLabel(row.remaining, row.uom)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </BookPanel>

                    <BookPanel
                      title="Recent sales"
                      action={
                        (d.outlet?.money.saleCount || 0) > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 shadow-sm"
                            asChild
                          >
                            <Link
                              to={shopSalesListPath(
                                isOutletScoped(user) ? null : d.id,
                                d.code,
                              )}
                            >
                              View all ({d.outlet?.money.saleCount || 0})
                            </Link>
                          </Button>
                        ) : null
                      }
                    >
                      {(d.outlet?.sales || []).length === 0 ? (
                        <p className="py-4 text-center text-xs text-zinc-500">
                          No sales recorded yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-zinc-100">
                          {(d.outlet?.sales || []).slice(0, 5).map((sale) => (
                            <div
                              key={sale.id}
                              className="flex items-center justify-between gap-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={shopSalePath(sale.saleNumber)}
                                    className="truncate text-xs font-semibold text-zinc-900 hover:text-teal-800 hover:underline"
                                  >
                                    {sale.buyerName || 'Walk-in'}
                                  </Link>
                                  {sale.balanceDue > 0.001 ? (
                                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                                      Credit {money(sale.balanceDue)}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-[10px] text-zinc-500">
                                  {formatBusinessDate(sale.businessDate) || '—'} ·{' '}
                                  <span className="font-mono">{sale.saleNumber}</span>
                                </p>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs font-bold tabular-nums text-zinc-900">
                                  {money(sale.totalAmount)}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs font-semibold"
                                  asChild
                                >
                                  <Link to={shopSalePath(sale.saleNumber)}>
                                    View
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </BookPanel>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <BookPanel title="Credit line">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-zinc-600">{money(c.outstanding)} outstanding</span>
                      <span
                        className={
                          creditClosed ? 'font-semibold text-red-700' : 'font-semibold text-teal-800'
                        }
                      >
                        {money(c.available)} left
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <CreditBar percent={c.utilizationPercent} atLimit={creditClosed} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-zinc-500">
                      Limit {money(c.creditLimit)} · Advance {money(advanceBalance)} ·{' '}
                      {unpaidSummary(c)}
                    </p>
                  </BookPanel>

                  <BookPanel
                    title="Unpaid"
                    action={
                      canSell && (unpaid.length > 0 || c.outstanding > 0.001) ? (
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-amber-800 hover:underline"
                          onClick={() => setPaying(unpaid)}
                        >
                          Record payment
                        </button>
                      ) : null
                    }
                  >
                    {unpaid.length > 0 ? (
                      <>
                        {unpaid.slice(0, 4).map((row) => (
                          <div
                            key={row.saleNumber}
                            className="flex items-center justify-between gap-2 border-b border-zinc-100 py-1.5 last:border-0 last:pb-0 first:pt-0"
                          >
                            <div className="min-w-0">
                              <Link
                                to={row.isOutletSale ? `/shop/sales/${row.saleNumber}` : `/sales/${row.saleNumber}`}
                                className="font-mono text-[11px] font-semibold text-amber-800 hover:underline"
                              >
                                {row.saleNumber}
                              </Link>
                              <p className="text-[10px] text-zinc-500">
                                {row.isOutletSale ? (
                                  <span className="font-medium text-emerald-800">
                                    Shop{row.outletName ? ` · ${row.outletName}` : ''} ·{' '}
                                  </span>
                                ) : null}
                                {row.ageDays ?? 0}d
                                {row.overdue ? ' · overdue' : ''}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[11px] font-semibold tabular-nums text-red-700">
                                {money(row.balanceDue)}
                              </p>
                              {canSell && (
                                <button
                                  type="button"
                                  className="text-[10px] font-semibold text-amber-800 hover:underline"
                                  onClick={() => setPaying([row])}
                                >
                                  Pay
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {unpaid.length > 4 ? (
                          <p className="pt-1 text-[10px] text-zinc-400">
                            +{unpaid.length - 4} more unpaid
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <div className="py-2 text-xs">
                        <p className="text-zinc-600 font-medium">No unpaid invoices</p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">All sales are settled.</p>
                      </div>
                    )}
                  </BookPanel>

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
                      <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
                        <Fact label="Contact" value={d.contactPerson || '—'} />
                        <Fact label="Phone" value={d.phone || '—'} />
                        <Fact label="Region" value={d.region || '—'} />
                        <Fact label="Terms" value={`${d.paymentTermsDays}d`} />
                        <div className="col-span-2">
                          <Fact label="Address" value={d.address || '—'} />
                        </div>
                      </dl>
                    ) : (
                      <form
                        className="grid gap-2 sm:grid-cols-2"
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
                            onChange={(e) =>
                              setForm((f) => ({ ...f, contactPerson: e.target.value }))
                            }
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
                            onChange={(e) =>
                              setForm((f) => ({ ...f, paymentTermsDays: e.target.value }))
                            }
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
                        <Field label="Status">
                          <select
                            className="dgn-input"
                            value={form.isActive ? '1' : '0'}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, isActive: e.target.value === '1' }))
                            }
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
                </div>

                <article className="overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-xs sm:rounded-xl">
                  <header className="space-y-2 border-b border-zinc-300 px-3 py-2.5 sm:space-y-0 sm:flex sm:items-start sm:justify-between sm:gap-3 sm:px-5 sm:py-4">
                    <div className="min-w-0 w-full sm:w-auto">
                      <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Account statement
                      </p>
                      <p className="mt-0.5 text-xs sm:text-sm font-semibold text-zinc-900">{d.name}</p>
                      <p className="font-mono text-[10px] sm:text-[11px] text-zinc-600">{d.code}</p>
                      {d.region ? (
                        <p className="mt-0.5 text-[10px] sm:text-[11px] text-zinc-500">{d.region}</p>
                      ) : null}
                    </div>
                    <div className="flex w-full items-end justify-between gap-3 border-t border-zinc-200 pt-2 sm:w-auto sm:flex-col sm:items-end sm:border-0 sm:pt-0 sm:text-right">
                      <div>
                        <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Balance due
                        </p>
                        <p
                          className={cn(
                            'mt-0.5 text-sm sm:text-base font-black tabular-nums',
                            (d.ledger?.net ?? c.outstanding) > 0.001
                              ? 'text-red-700'
                              : 'text-teal-800',
                          )}
                        >
                          {money(d.ledger?.net ?? c.outstanding)}
                        </p>
                      </div>
                      <div className="max-w-[12rem] text-right text-[9.5px] leading-snug text-zinc-500 sm:max-w-none sm:text-[11px]">
                        <p>Debit = they owe · Credit = paid / advance</p>
                        {d.ledger ? (
                          <p className="mt-0.5">
                            Advance held {money(d.ledger.held ?? Math.max(0, d.ledger.advance - d.ledger.receivable))}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </header>

                  {ledger.length === 0 ? (
                    <p className="px-3.5 py-6 text-center text-xs text-zinc-500 sm:px-5">
                      No ledger transactions yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto border-b border-zinc-200">
                      <div className="w-full sm:min-w-[640px]">
                        <div className="grid grid-cols-[1rem_minmax(0,1.2fr)_3.9rem_3.9rem_4.4rem] sm:grid-cols-[2.25rem_minmax(220px,1.5fr)_8.5rem_8.5rem_9.5rem] items-center gap-x-1.5 sm:gap-x-4 border-b border-zinc-200 bg-zinc-50/90 px-2.5 py-1.5 sm:px-5 sm:py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          <span className="w-4 sm:w-5" />
                          <span>Particulars</span>
                          <span className="text-right">Debit</span>
                          <span className="text-right">Credit</span>
                          <span className="text-right">Balance</span>
                        </div>
                        <div className="divide-y divide-zinc-100">
                          {[...ledger].reverse().map((row) => {
                            const isDebit = row.debit > 0.001
                            const open = expandedLedgerId === row.id
                            const sale = row.saleNumber
                              ? d.sales.find((s) => s.saleNumber === row.saleNumber)
                              : null
                            const lines = sale?.lines || []
                            const canExpand = Boolean(row.expandable && row.saleNumber)
                            return (
                              <div key={row.id}>
                                <button
                                  type="button"
                                  disabled={!canExpand}
                                  onClick={() =>
                                    canExpand &&
                                    setExpandedLedgerId(open ? null : row.id)
                                  }
                                  className={cn(
                                    'grid w-full grid-cols-[1rem_minmax(0,1.2fr)_3.9rem_3.9rem_4.4rem] sm:grid-cols-[2.25rem_minmax(220px,1.5fr)_8.5rem_8.5rem_9.5rem] items-center gap-x-1.5 sm:gap-x-4 px-2.5 py-2 sm:px-5 sm:py-2.5 text-left text-xs sm:text-sm transition-colors',
                                    canExpand && 'hover:bg-zinc-50/80 cursor-pointer',
                                    !canExpand && 'cursor-default',
                                  )}
                                >
                                  <span className="flex w-4 sm:w-5 items-center justify-center">
                                    {canExpand ? (
                                      <ChevronDown
                                        className={cn(
                                          'size-3 sm:size-3.5 text-zinc-400 transition-transform duration-200',
                                          open && 'rotate-180 text-zinc-700',
                                        )}
                                      />
                                    ) : (
                                      <span className="size-3 sm:size-3.5" />
                                    )}
                                  </span>
                                  <span className="min-w-0 pr-1 sm:pr-2">
                                    <span className="flex items-center gap-1 flex-wrap">
                                      <span className="font-semibold text-zinc-900 text-[11px] sm:text-sm leading-tight">
                                        {row.title}
                                      </span>
                                      {sale?.isOutletSale ? (
                                        <span className="inline-flex items-center rounded bg-emerald-50 px-1 py-0.5 text-[9px] sm:text-[10px] font-semibold text-emerald-800 border border-emerald-200/80">
                                          Shop{sale.outletName ? ` · ${sale.outletName}` : ''}
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="mt-0.5 block text-[9.5px] sm:text-[11px] text-zinc-500 leading-tight truncate">
                                      {row.dateLabel}
                                      {row.meta ? ` · ${row.meta}` : ''}
                                    </span>
                                  </span>
                                  <span
                                    className={cn(
                                      'text-right tabular-nums whitespace-nowrap text-[10px] sm:text-sm tracking-tight sm:tracking-normal',
                                      isDebit ? 'font-semibold text-zinc-900' : 'text-zinc-300',
                                    )}
                                  >
                                    {isDebit ? money(row.debit) : '—'}
                                  </span>
                                  <span
                                    className={cn(
                                      'text-right tabular-nums whitespace-nowrap text-[10px] sm:text-sm tracking-tight sm:tracking-normal',
                                      !isDebit ? 'font-semibold text-zinc-900' : 'text-zinc-300',
                                    )}
                                  >
                                    {!isDebit ? money(row.credit) : '—'}
                                  </span>
                                  <span
                                    className={cn(
                                      'text-right tabular-nums font-semibold whitespace-nowrap text-[10px] sm:text-sm tracking-tight sm:tracking-normal',
                                      row.balanceAfter > 0.001
                                        ? 'text-zinc-900'
                                        : row.balanceAfter < -0.001
                                          ? 'text-teal-700'
                                          : 'text-zinc-500',
                                    )}
                                  >
                                    {money(row.balanceAfter)}
                                  </span>
                                </button>
                                {open && canExpand ? (
                                  <div className="border-t border-zinc-200/70 bg-zinc-50/70 py-2 sm:py-3 pl-[2rem] sm:pl-[4.5rem] pr-2.5 sm:pr-5">
                                    {sale?.isOutletSale ? (
                                      <div className="mb-2 flex items-center justify-between text-[11px] sm:text-xs">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-800">
                                            Market Shop: {sale.outletName || 'Shop'}
                                          </span>
                                          <span className="text-zinc-500 text-[10px] sm:text-[11px]">
                                            Sale #{sale.saleNumber}
                                          </span>
                                        </div>
                                        <Link
                                          to={`/shop/sales/${sale.saleNumber}`}
                                          className="font-semibold text-emerald-700 hover:underline text-[11px] sm:text-xs flex items-center gap-1 shrink-0"
                                        >
                                          <span>View shop sale</span>
                                          <ExternalLink className="size-3" />
                                        </Link>
                                      </div>
                                    ) : (
                                      <div className="mb-2 flex items-center justify-between text-[11px] sm:text-xs">
                                        <span className="text-zinc-500 text-[10px] sm:text-[11px]">
                                          Factory Sale #{sale?.saleNumber}
                                        </span>
                                        <Link
                                          to={`/sales/${sale?.saleNumber}`}
                                          className="font-semibold text-amber-800 hover:underline text-[11px] sm:text-xs flex items-center gap-1 shrink-0"
                                        >
                                          <span>View invoice</span>
                                          <ExternalLink className="size-3" />
                                        </Link>
                                      </div>
                                    )}
                                    {lines.length === 0 ? (
                                      <p className="text-[10px] sm:text-[11px] text-zinc-500">No line items.</p>
                                    ) : (
                                      <table className="w-full text-left text-[10px] sm:text-[11px]">
                                        <thead className="text-zinc-500 border-b border-zinc-200">
                                          <tr>
                                            <th className="py-1 pr-1.5 sm:py-1.5 sm:pr-2 font-medium">Product</th>
                                            <th className="py-1 px-1.5 sm:py-1.5 sm:px-2 text-right font-medium">Qty</th>
                                            <th className="py-1 px-1.5 sm:py-1.5 sm:px-2 text-right font-medium">Unit Price</th>
                                            <th className="py-1 pl-1.5 sm:py-1.5 sm:pl-2 text-right font-medium">Value</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100">
                                          {lines.map((line) => (
                                            <tr key={line.id}>
                                              <td className="py-1 pr-1.5 sm:py-1.5 sm:pr-2 font-medium text-zinc-900">
                                                {line.productName || line.batchNumber || 'Item'}
                                              </td>
                                              <td className="py-1 px-1.5 sm:py-1.5 sm:px-2 text-right tabular-nums">
                                                {isPieceUom(line.uom)
                                                  ? fmtDozenPcs(line.qty)
                                                  : `${fmt(line.qty)} ${line.uom || ''}`.trim()}
                                              </td>
                                              <td className="py-1 px-1.5 sm:py-1.5 sm:px-2 text-right tabular-nums text-zinc-500">
                                                {money(line.unitPrice)}
                                              </td>
                                              <td className="py-1 pl-1.5 sm:py-1.5 sm:pl-2 text-right font-semibold tabular-nums">
                                                {money(line.lineTotal)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <section className="ml-auto w-full max-w-[14rem] space-y-1 px-3 py-2.5 text-xs sm:px-5 sm:py-4 sm:text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-600">They owe</span>
                      <span className="font-semibold tabular-nums">
                        {money(d.ledger?.owed ?? Math.max(0, (d.ledger?.net ?? c.outstanding) || 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-600">Advance held</span>
                      <span className="font-semibold tabular-nums">
                        {money(advanceBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-zinc-300 pt-1.5">
                      <span className="font-semibold text-zinc-900">Net due</span>
                      <span
                        className={cn(
                          'font-black tabular-nums',
                          (d.ledger?.net ?? c.outstanding) > 0.001
                            ? 'text-red-700'
                            : 'text-teal-800',
                        )}
                      >
                        {money(d.ledger?.net ?? c.outstanding)}
                      </span>
                    </div>
                  </section>
                </article>

              </>
            )}

            {isShop ? (
              <>
                <BookPanel title="Transfers from factory">
                  {d.sales.length === 0 ? (
                    <p className="text-xs text-zinc-500">No stock transfers yet.</p>
                  ) : (
                    d.sales.map((sale) => {
                      const isTransfer =
                        String(sale.saleType || '').toUpperCase() === 'SHOP_TRANSFER' ||
                        String(sale.saleType || '').toUpperCase() === 'TRANSFER' ||
                        !(Number(sale.totalAmount) > 0.001)
                      const open = expandedLedgerId === `xfer-${sale.id}`
                      return (
                        <div
                          key={sale.id}
                          className="border-b border-zinc-100 last:border-0"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLedgerId(open ? null : `xfer-${sale.id}`)
                            }
                            className="flex w-full items-start justify-between gap-2 py-1.5 text-left"
                          >
                            <div className="min-w-0 flex items-start gap-1.5">
                              <ChevronDown
                                className={cn(
                                  'mt-0.5 size-3.5 shrink-0 text-zinc-400 transition-transform',
                                  open && 'rotate-180',
                                )}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-zinc-900">
                                  {formatBusinessDate(sale.businessDate) || 'Transfer'}
                                </p>
                                <p className="mt-0.5 text-[10px] text-zinc-500">
                                  {sale.lines.length} item{sale.lines.length === 1 ? '' : 's'}
                                </p>
                              </div>
                            </div>
                            <StatusChip tone={isTransfer ? 'ok' : 'muted'}>
                              {isTransfer ? 'Transfer' : 'Received'}
                            </StatusChip>
                          </button>
                          {open ? (
                            <div className="mb-1.5 ml-5 space-y-1">
                              {sale.lines.map((l) => (
                                <div
                                  key={l.id}
                                  className="flex items-center justify-between gap-2 text-[11px]"
                                >
                                  <span className="min-w-0 truncate text-zinc-700">
                                    {l.productName || l.batchNumber || 'Item'}
                                  </span>
                                  <span className="shrink-0 tabular-nums text-zinc-900">
                                    {isPieceUom(l.uom)
                                      ? fmtDozenPcs(l.qty)
                                      : `${fmt(l.qty)} ${l.uom || ''}`.trim()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </BookPanel>
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
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <Fact label="Contact" value={d.contactPerson || '—'} />
                      <Fact label="Phone" value={d.phone || '—'} />
                      <Fact label="Region" value={d.region || '—'} />
                      <Fact label="Status" value={d.isActive ? 'Active' : 'Inactive'} />
                      <div className="col-span-2">
                        <Fact label="Address" value={d.address || '—'} />
                      </div>
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
                          onChange={(e) =>
                            setForm((f) => ({ ...f, contactPerson: e.target.value }))
                          }
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
                      <Field label="Status">
                        <select
                          className="dgn-input"
                          value={form.isActive ? '1' : '0'}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, isActive: e.target.value === '1' }))
                          }
                        >
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </Field>
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
              </>
            ) : null}

        {paying && (
          <Dialog title="Record payment" onClose={() => setPaying(null)}>
            <DistributorPaymentForm
              key={paying.map((row) => row.saleNumber).join(',')}
              distributorIdOrCode={d.code || d.id}
              distributorName={d.name}
              totalOutstanding={d.credit?.outstanding || d.ledger?.owed || 0}
              unpaid={paying}
              onSaved={refreshAfterPayment}
            />
          </Dialog>
        )}

        {openingOpen && (
          <Dialog title="Opening balance" onClose={() => setOpeningOpen(false)}>
            <p className="mb-4 text-sm text-zinc-700">
              For distributors you already traded with before this system. Enter what they{' '}
              <strong>already owe</strong> and/or any <strong>advance already held</strong>. You can
              fill one or both.
            </p>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                openingMutation.mutate()
              }}
            >
              <Field label="They already owe (receivable)">
                <NairaAmountInput
                  value={openingForm.receivableAmount}
                  onChange={(value) =>
                    setOpeningForm((f) => ({ ...f, receivableAmount: value }))
                  }
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Creates an unpaid opening invoice you can collect later.
                </p>
              </Field>
              <Field label="Advance already held">
                <NairaAmountInput
                  value={openingForm.advanceAmount}
                  onChange={(value) => setOpeningForm((f) => ({ ...f, advanceAmount: value }))}
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Money they paid ahead — can be used on the next sale.
                </p>
              </Field>
              <Field label="Notes">
                <textarea
                  className="dgn-input"
                  rows={2}
                  value={openingForm.notes}
                  onChange={(e) => setOpeningForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Balance brought forward from old books"
                />
              </Field>
              {error && <p className="text-sm text-red-700">{error}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  className="dgn-btn dgn-btn-primary"
                  disabled={
                    openingMutation.isPending ||
                    (!(Number(openingForm.receivableAmount) > 0) &&
                      !(Number(openingForm.advanceAmount) > 0))
                  }
                >
                  {openingMutation.isPending ? 'Saving…' : 'Save opening balance'}
                </button>
                <button
                  type="button"
                  className="dgn-btn dgn-btn-ghost"
                  onClick={() => setOpeningOpen(false)}
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
