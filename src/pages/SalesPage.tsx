import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Plus,
  DollarSign,
  ShoppingBag,
  Percent,
  AlertCircle,
  Eye,
  CreditCard,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import CustomTable1 from '@/components/CustomTable1'
import { hasPermission } from '@/lib/auth'
import { formatBusinessDate } from '@/lib/dates'
import { useAuthStore } from '@/stores/auth-store'

type SaleRow = {
  id: number
  saleNumber: string
  customerId: number
  customerName: string | null
  customerCode: string | null
  customerType: string | null
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

type ReceivableRow = {
  saleNumber: string
  customerName: string | null
  customerCode: string | null
  customerType: string | null
  saleType: string
  paymentStatus: string
  totalAmount: number
  amountPaid: number
  balanceDue: number
  businessDate: string | null
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function SalesPage() {
  const user = useAuthStore((s) => s.user)
  const canSell = hasPermission(user, 'sales.create')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<'all' | 'receivables' | 'paid'>('all')

  useEffect(() => {
    const d = searchParams.get('distributor') || searchParams.get('customer')
    if (d) {
      navigate(`/sales/new?${searchParams.toString()}`, { replace: true })
    }
  }, [searchParams, navigate])

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
          customerCode: string | null
          customerType: string | null
          saleType: string
          paymentStatus: string
          totalAmount: number
          amountPaid: number
          balanceDue: number
          businessDate: string | null
        }[]
      }
    },
  })

  const totals = overview.data?.totals
  const receivables = overview.data?.receivables ?? []

  const paidSales = useMemo(() => {
    return (sales.data || []).filter(
      (s) => s.paymentStatus === 'PAID' || s.paymentStatus === 'SETTLED'
    )
  }, [sales.data])

  const salesColumns = useMemo<ColumnDef<SaleRow>[]>(
    () => [
      {
        id: 'saleNumber',
        header: 'Sale',
        cell: ({ row }) => {
          const sale = row.original
          return (
            <div>
              <Link
                to={`/sales/${sale.saleNumber}`}
                className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
              >
                {sale.saleNumber}
              </Link>
              <p className="text-[11px] text-zinc-500 capitalize">
                {sale.saleType.toLowerCase()} · {sale.status.replace('_', ' ').toLowerCase()}
              </p>
            </div>
          )
        },
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 tabular-nums">
            {formatBusinessDate(row.original.businessDate)}
          </span>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => {
          const sale = row.original
          return (
            <div>
              {sale.customerType === 'DISTRIBUTOR' && sale.customerCode ? (
                <Link
                  to={`/distributors/${sale.customerCode}`}
                  className="font-medium text-xs text-[var(--accent-strong)] hover:underline"
                >
                  {sale.customerName}
                </Link>
              ) : (
                <span className="font-medium text-xs text-zinc-800">
                  {sale.customerName || '—'}
                </span>
              )}
              {sale.customerType && (
                <p className="text-[11px] text-zinc-400 capitalize">
                  {sale.customerType.toLowerCase()}
                </p>
              )}
            </div>
          )
        },
      },
      {
        id: 'batches',
        header: 'Batches',
        cell: ({ row }) => {
          const bns = row.original.batchNumbers.filter(Boolean)
          if (!bns.length) return <span className="text-zinc-400 text-xs">—</span>
          return (
            <div className="flex flex-wrap gap-1 max-w-xs">
              {bns.map((bn) => (
                <Link
                  key={bn}
                  to={`/batches/${bn}`}
                  className="font-mono text-[11px] font-semibold text-[var(--accent-strong)] hover:underline bg-zinc-100 px-1.5 py-0.5 rounded"
                >
                  {bn}
                </Link>
              ))}
            </div>
          )
        },
      },
      {
        id: 'totalAmount',
        header: 'Invoiced',
        cell: ({ row }) => (
          <span className="font-semibold text-xs tabular-nums text-zinc-900">
            {money(row.original.totalAmount)}
          </span>
        ),
      },
      {
        id: 'paymentStatus',
        header: 'Payment',
        cell: ({ row }) => {
          const sale = row.original
          const isPaid = sale.paymentStatus === 'PAID' || sale.paymentStatus === 'SETTLED'
          const isPartial = sale.paymentStatus === 'PARTIAL'
          return (
            <div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  isPaid
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    : isPartial
                    ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                    : 'bg-red-50 text-red-700 border border-red-200/80'
                }`}
              >
                {sale.paymentStatus}
              </span>
              {sale.balanceDue > 0.01 && (
                <p className="text-[10px] text-red-600 tabular-nums mt-0.5 font-medium">
                  Due: {money(sale.balanceDue)}
                </p>
              )}
            </div>
          )
        },
      },
      {
        id: 'margin',
        header: 'Margin',
        cell: ({ row }) => {
          const pct = row.original.grossMarginPercent
          return (
            <span
              className={`text-xs font-semibold tabular-nums ${
                pct >= 20 ? 'text-emerald-700' : pct >= 10 ? 'text-amber-700' : 'text-zinc-600'
              }`}
            >
              {pct}%
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
            >
              <Link
                to={`/sales/${row.original.saleNumber}`}
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Eye className="size-3.5 shrink-0" />
                <span>View</span>
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const receivablesColumns = useMemo<ColumnDef<ReceivableRow>[]>(
    () => [
      {
        id: 'saleNumber',
        header: 'Sale',
        cell: ({ row }) => (
          <div>
            <Link
              to={`/sales/${row.original.saleNumber}`}
              className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
            >
              {row.original.saleNumber}
            </Link>
            <p className="text-[11px] text-zinc-500 capitalize">
              {(row.original.saleType || '').toLowerCase()}
            </p>
          </div>
        ),
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 tabular-nums">
            {formatBusinessDate(row.original.businessDate)}
          </span>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div>
              {r.customerType === 'DISTRIBUTOR' && r.customerCode ? (
                <Link
                  to={`/distributors/${r.customerCode}`}
                  className="font-medium text-xs text-[var(--accent-strong)] hover:underline"
                >
                  {r.customerName}
                </Link>
              ) : (
                <span className="font-medium text-xs text-zinc-800">{r.customerName || '—'}</span>
              )}
              {r.customerType && (
                <p className="text-[11px] text-zinc-400 capitalize">{r.customerType.toLowerCase()}</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'totalAmount',
        header: 'Invoiced',
        cell: ({ row }) => (
          <span className="font-medium text-xs tabular-nums text-zinc-700">
            {money(row.original.totalAmount)}
          </span>
        ),
      },
      {
        id: 'amountPaid',
        header: 'Paid',
        cell: ({ row }) => (
          <span className="font-medium text-xs tabular-nums text-teal-700">
            {money(row.original.amountPaid)}
          </span>
        ),
      },
      {
        id: 'balanceDue',
        header: 'Still Owed',
        cell: ({ row }) => (
          <span className="font-bold text-xs tabular-nums text-red-700">
            {money(row.original.balanceDue)}
          </span>
        ),
      },
      {
        id: 'paymentStatus',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              row.original.paymentStatus === 'PARTIAL'
                ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                : 'bg-red-50 text-red-700 border border-red-200/80'
            }`}
          >
            {row.original.paymentStatus || 'UNPAID'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Button
              asChild
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
            >
              <Link
                to={`/sales/${row.original.saleNumber}`}
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <CreditCard className="size-3.5 shrink-0" />
                <span>Record payment</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
            >
              <Link
                to={`/sales/${row.original.saleNumber}`}
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Eye className="size-3.5 shrink-0" />
                <span>View</span>
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <PageLayout
      title="Sales & distribution"
      description="Orders, invoices, payments, margins, and receivables"
      actions={
        canSell ? (
          <Button
            asChild
            size="sm"
            className="h-8 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex flex-row items-center"
          >
            <Link to="/sales/new" className="inline-flex flex-row items-center gap-1.5 whitespace-nowrap">
              <Plus className="size-3.5 shrink-0" />
              <span>New sale</span>
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="space-y-5">
        {totals && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            {/* Net Revenue */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Net Revenue
                  </span>
                  <div className="size-5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <DollarSign className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                    {money(totals.revenue)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Invoiced sales
              </p>
            </div>

            {/* Cost of Goods */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Cost of Goods
                  </span>
                  <div className="size-5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                    <ShoppingBag className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                    {money(totals.cost)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Batch materials & cost
              </p>
            </div>

            {/* Gross Margin */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Gross Margin
                  </span>
                  <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${totals.grossMargin >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'}`}>
                    <Percent className="size-3" />
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-1">
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate">
                    {money(totals.grossMargin)}
                  </span>
                  <span className={`text-[9px] font-extrabold rounded px-1 py-0.2 ${totals.grossMargin >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'}`}>
                    {totals.grossMarginPercent}%
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Gross sales profit
              </p>
            </div>

            {/* Receivables */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Receivables
                  </span>
                  <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${totals.receivablesTotal > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400'}`}>
                    <AlertCircle className="size-3" />
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-1">
                  <span className={`text-base sm:text-lg font-black tabular-nums tracking-tight truncate ${totals.receivablesTotal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-white'}`}>
                    {money(totals.receivablesTotal)}
                  </span>
                  {receivables.length > 0 && (
                    <span className="text-[9px] font-extrabold rounded bg-rose-50 dark:bg-rose-950/60 px-1 py-0.2 text-rose-700 dark:text-rose-300">
                      {receivables.length} uncollected
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Outstanding balance
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="w-full sm:w-64">
              <Select
                value={viewMode}
                onValueChange={(val) => setViewMode(val as 'all' | 'receivables' | 'paid')}
              >
                <SelectTrigger className="w-full h-9 text-xs font-semibold">
                  <SelectValue placeholder="Select sales view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Sales ({sales.data?.length ?? 0})
                  </SelectItem>
                  <SelectItem value="receivables">
                    Receivables ({receivables.length})
                  </SelectItem>
                  <SelectItem value="paid">
                    Fully Paid ({paidSales.length})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-zinc-500">
              Showing {viewMode === 'all' ? (sales.data?.length ?? 0) : viewMode === 'receivables' ? receivables.length : paidSales.length} records
            </p>
          </div>

          {viewMode === 'all' && (
            <CustomTable1
              data={sales.data || []}
              columns={salesColumns}
              loading={sales.isLoading}
            />
          )}

          {viewMode === 'receivables' && (
            <CustomTable1
              data={receivables}
              columns={receivablesColumns}
              loading={overview.isLoading}
            />
          )}

          {viewMode === 'paid' && (
            <CustomTable1
              data={paidSales}
              columns={salesColumns}
              loading={sales.isLoading}
            />
          )}
        </div>
      </div>
    </PageLayout>
  )
}
