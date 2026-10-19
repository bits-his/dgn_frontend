import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Eye, CreditCard, ArrowRightLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import CustomTable1 from '@/components/CustomTable1'
import { hasPermission } from '@/lib/auth'
import { formatBusinessDate } from '@/lib/dates'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

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
  amountPaid: number
  balanceDue: number
  paymentStatus: string
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

type MainTab = 'sales' | 'transfers'
type SalesFilter = 'all' | 'unpaid' | 'paid'

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function saleTypeKey(saleType?: string | null) {
  return String(saleType || '').toUpperCase()
}

function isShopTransfer(saleType?: string | null) {
  const t = saleTypeKey(saleType)
  return t === 'SHOP_TRANSFER' || t === 'TRANSFER'
}

function isCommercialSale(saleType?: string | null) {
  const t = saleTypeKey(saleType)
  return t !== 'SHOP_TRANSFER' && t !== 'TRANSFER' && t !== 'OPENING_BALANCE'
}

function saleTypeLabel(saleType?: string | null) {
  const t = saleTypeKey(saleType)
  if (t === 'OPENING_BALANCE') return 'Opening'
  if (t === 'CASH') return 'Cash'
  if (t === 'CREDIT') return 'Credit'
  return (saleType || 'Sale').toLowerCase()
}

function paymentTone(status: string) {
  const s = String(status || '').toUpperCase()
  if (s === 'PAID' || s === 'SETTLED') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
  }
  if (s === 'PARTIAL') return 'bg-amber-50 text-amber-800 border-amber-200/80'
  return 'bg-red-50 text-red-700 border-red-200/80'
}

export function SalesPage() {
  const user = useAuthStore((s) => s.user)
  const canSell = hasPermission(user, 'sales.create')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [mainTab, setMainTab] = useState<MainTab>('sales')
  const [salesFilter, setSalesFilter] = useState<SalesFilter>('all')

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
          receivablesTotal: number
        }
        receivables: ReceivableRow[]
      }
    },
  })

  const totals = overview.data?.totals
  const receivables = overview.data?.receivables ?? []

  const commercialSales = useMemo(
    () =>
      (sales.data || []).filter(
        (s) => isCommercialSale(s.saleType) || saleTypeKey(s.saleType) === 'OPENING_BALANCE',
      ),
    [sales.data],
  )

  const transfers = useMemo(
    () => (sales.data || []).filter((s) => isShopTransfer(s.saleType)),
    [sales.data],
  )

  const paidSales = useMemo(
    () =>
      commercialSales.filter(
        (s) => s.paymentStatus === 'PAID' || s.paymentStatus === 'SETTLED',
      ),
    [commercialSales],
  )

  const salesTableData = useMemo(() => {
    if (salesFilter === 'unpaid') return receivables as unknown as SaleRow[]
    if (salesFilter === 'paid') return paidSales
    return commercialSales
  }, [salesFilter, receivables, paidSales, commercialSales])

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
                className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
              >
                {sale.saleNumber}
              </Link>
              <p className="text-[11px] text-zinc-500">
                {saleTypeLabel(sale.saleType)}
                {sale.soldBy ? ` · ${sale.soldBy}` : ''}
              </p>
            </div>
          )
        },
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-600">
            {formatBusinessDate(row.original.businessDate)}
          </span>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => {
          const sale = row.original
          return sale.customerCode ? (
            <Link
              to={`/distributors/${sale.customerCode}`}
              className="text-xs font-medium text-[var(--accent-strong)] hover:underline"
            >
              {sale.customerName}
            </Link>
          ) : (
            <span className="text-xs font-medium text-zinc-800">{sale.customerName || '—'}</span>
          )
        },
      },
      {
        id: 'totalAmount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="text-xs font-semibold tabular-nums text-zinc-900">
            {money(row.original.totalAmount)}
          </span>
        ),
      },
      {
        id: 'paymentStatus',
        header: 'Payment',
        cell: ({ row }) => {
          const sale = row.original
          return (
            <div>
              <span
                className={cn(
                  'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold',
                  paymentTone(sale.paymentStatus),
                )}
              >
                {sale.paymentStatus || 'UNPAID'}
              </span>
              {sale.balanceDue > 0.01 ? (
                <p className="mt-0.5 text-[10px] font-medium tabular-nums text-red-600">
                  Due {money(sale.balanceDue)}
                </p>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const due = Number(row.original.balanceDue || 0) > 0.01
          return (
            <Button
              asChild
              size="sm"
              variant={due ? 'default' : 'outline'}
              className="h-7 px-2 text-xs font-semibold"
            >
              <Link to={`/sales/${row.original.saleNumber}`}>
                {due ? <CreditCard className="size-3.5" /> : <Eye className="size-3.5" />}
                <span className="ml-1">{due ? 'Collect' : 'View'}</span>
              </Link>
            </Button>
          )
        },
      },
    ],
    [],
  )

  const receivablesColumns = useMemo<ColumnDef<ReceivableRow>[]>(
    () => [
      {
        id: 'saleNumber',
        header: 'Sale',
        cell: ({ row }) => (
          <Link
            to={`/sales/${row.original.saleNumber}`}
            className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
          >
            {row.original.saleNumber}
          </Link>
        ),
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-600">
            {formatBusinessDate(row.original.businessDate)}
          </span>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        cell: ({ row }) => {
          const r = row.original
          return r.customerCode ? (
            <Link
              to={`/distributors/${r.customerCode}`}
              className="text-xs font-medium text-[var(--accent-strong)] hover:underline"
            >
              {r.customerName}
            </Link>
          ) : (
            <span className="text-xs font-medium text-zinc-800">{r.customerName || '—'}</span>
          )
        },
      },
      {
        id: 'balanceDue',
        header: 'Still owed',
        cell: ({ row }) => (
          <span className="text-xs font-bold tabular-nums text-red-700">
            {money(row.original.balanceDue)}
          </span>
        ),
      },
      {
        id: 'paid',
        header: 'Paid / invoice',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-600">
            {money(row.original.amountPaid)}
            <span className="text-zinc-400"> / {money(row.original.totalAmount)}</span>
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button asChild size="sm" className="h-7 px-2 text-xs font-semibold">
            <Link to={`/sales/${row.original.saleNumber}`}>
              <CreditCard className="size-3.5" />
              <span className="ml-1">Collect</span>
            </Link>
          </Button>
        ),
      },
    ],
    [],
  )

  const transferColumns = useMemo<ColumnDef<SaleRow>[]>(
    () => [
      {
        id: 'saleNumber',
        header: 'Transfer',
        cell: ({ row }) => (
          <div>
            <Link
              to={`/sales/${row.original.saleNumber}`}
              className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
            >
              {row.original.saleNumber}
            </Link>
            <p className="text-[11px] text-zinc-500">Factory → shop</p>
          </div>
        ),
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-600">
            {formatBusinessDate(row.original.businessDate)}
          </span>
        ),
      },
      {
        id: 'shop',
        header: 'Shop',
        cell: ({ row }) => {
          const sale = row.original
          return sale.customerCode ? (
            <Link
              to={`/distributors/${sale.customerCode}`}
              className="text-xs font-medium text-[var(--accent-strong)] hover:underline"
            >
              {sale.customerName}
            </Link>
          ) : (
            <span className="text-xs font-medium text-zinc-800">{sale.customerName || '—'}</span>
          )
        },
      },
      {
        id: 'note',
        header: '',
        cell: () => (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700">
            <ArrowRightLeft className="size-3" />
            Stock issue · not a sale
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs font-semibold">
            <Link to={`/sales/${row.original.saleNumber}`}>
              <Eye className="size-3.5" />
              <span className="ml-1">View</span>
            </Link>
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <PageLayout
      title="Sales & distribution"
      description="Invoices and shop stock issues"
      actions={
        canSell ? (
          <Button asChild size="sm" className="h-8 gap-1.5 px-3 text-xs font-semibold">
            <Link to="/sales/new">
              <Plus className="size-3.5" />
              New sale
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="space-y-3">
        {totals ? (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
            <div className="rounded-lg border border-zinc-200/90 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Revenue
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
                {money(totals.revenue)}
              </p>
              <p className="text-[10px] text-zinc-400">{commercialSales.length} sales</p>
            </div>
            <div className="rounded-lg border border-zinc-200/90 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Unpaid
              </p>
              <p
                className={cn(
                  'mt-0.5 text-sm font-bold tabular-nums',
                  totals.receivablesTotal > 0.001
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-zinc-900 dark:text-white',
                )}
              >
                {money(totals.receivablesTotal)}
              </p>
              <p className="text-[10px] text-zinc-400">{receivables.length} invoices</p>
            </div>
            <div className="col-span-2 rounded-lg border border-zinc-200/90 bg-white px-2.5 py-2 sm:col-span-1 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Paid
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
                {paidSales.length}
              </p>
              <p className="text-[10px] text-zinc-400">Fully settled</p>
            </div>
          </div>
        ) : null}

        {/* Simple 2-tab underline switch */}
        <div className="flex items-end gap-4 border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setMainTab('sales')}
            className={cn(
              '-mb-px border-b-2 pb-2 text-sm font-semibold transition-colors',
              mainTab === 'sales'
                ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-700',
            )}
          >
            Sales
            <span className="ml-1.5 text-xs font-medium tabular-nums text-zinc-400">
              {commercialSales.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMainTab('transfers')}
            className={cn(
              '-mb-px border-b-2 pb-2 text-sm font-semibold transition-colors',
              mainTab === 'transfers'
                ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-700',
            )}
          >
            Shop transfers
            <span className="ml-1.5 text-xs font-medium tabular-nums text-zinc-400">
              {transfers.length}
            </span>
          </button>
        </div>

        {mainTab === 'sales' ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All', count: commercialSales.length },
                  { id: 'unpaid', label: 'Unpaid', count: receivables.length },
                  { id: 'paid', label: 'Paid', count: paidSales.length },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSalesFilter(f.id)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    salesFilter === f.id
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
                  )}
                >
                  {f.label} {f.count}
                </button>
              ))}
            </div>

            {salesFilter === 'unpaid' ? (
              <CustomTable1
                data={receivables}
                columns={receivablesColumns}
                loading={overview.isLoading}
                card
              />
            ) : (
              <CustomTable1
                data={salesTableData}
                columns={salesColumns}
                loading={sales.isLoading}
                card
              />
            )}
          </>
        ) : (
          <CustomTable1
            data={transfers}
            columns={transferColumns}
            loading={sales.isLoading}
            card
          />
        )}
      </div>
    </PageLayout>
  )
}
