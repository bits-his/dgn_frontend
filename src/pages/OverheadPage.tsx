import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Layers,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Fuel,
  DollarSign,
  Calendar,
  ExternalLink,
  RefreshCw,
  Lock,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

type Preview = {
  periodKey: string
  periodLabel: string
  expensePool: number
  expenseCount: number
  expenseBreakdown: { label: string; amount: number }[]
  payrollGross: number
  directLabourOffset: number
  payrollPool: number
  payrollRunCount: number
  totalPool: number
  basisKg: number
  ratePerKg: number
  batchCount: number
  basisBatches: {
    batchNumber: string
    materialName: string | null
    qtyOut: number
    share: number
    overheadAmount: number
  }[]
  alreadyAllocated: boolean
  allocationNumber: string | null
}

type PeriodRow = {
  periodKey: string
  label: string
  allocated: boolean
}

type Allocation = {
  id: number
  allocationNumber: string
  periodKey: string
  periodLabel: string
  basisKg: number
  expensePool: number
  payrollPool: number
  totalPool: number
  ratePerKg: number
  batchCount: number
  status: 'ALLOCATED' | 'REVERSED'
  notes?: string
  allocatedBy?: string
  reversedBy?: string
  reversedAt?: string
  createdAt: string
}

function fmt(n: number | null | undefined) {
  if (n == null) return '0'
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function money(n: number | null | undefined) {
  if (n == null) return '₦0'
  return `₦${Math.round(n).toLocaleString()}`
}

export function OverheadPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canAllocate = hasPermission(user, 'overhead.allocate') || user?.roleCode === 'SUPER_ADMIN' || user?.roleCode === 'FACTORY_MANAGER'

  const [periodKey, setPeriodKey] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const periods = useQuery({
    queryKey: ['overhead-periods'],
    queryFn: async () => {
      const { data } = await api.get('/overhead/periods')
      return data.data as PeriodRow[]
    },
  })

  const preview = useQuery({
    queryKey: ['overhead-preview', periodKey],
    queryFn: async () => {
      const url = periodKey ? `/overhead/preview?periodKey=${encodeURIComponent(periodKey)}` : '/overhead/preview'
      const { data } = await api.get(url)
      return data.data as Preview
    },
  })

  const history = useQuery({
    queryKey: ['overhead-history'],
    queryFn: async () => {
      const { data } = await api.get('/overhead/history')
      return data.data as Allocation[]
    },
  })

  const refresh = () => {
    preview.refetch()
    history.refetch()
    periods.refetch()
    queryClient.invalidateQueries({ queryKey: ['costs-overview'] })
    queryClient.invalidateQueries({ queryKey: ['costs-recycled'] })
  }

  const allocate = async () => {
    if (!preview.data) return
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const { data } = await api.post('/overhead/allocate', {
        periodKey: preview.data.periodKey,
        notes,
      })
      setMessage(data.message)
      refresh()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not allocate overhead'))
      }
    } finally {
      setBusy(false)
    }
  }

  const p = preview.data

  return (
    <PageLayout
      title={
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <span className="truncate">Factory Overhead Absorption</span>
          {p?.alreadyAllocated ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-950/60 dark:border-teal-800 dark:text-teal-300 shrink-0">
              <CheckCircle2 className="size-3.5 text-teal-600 shrink-0" />
              <span>{p.periodLabel} Closed</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300 shrink-0">
              <span className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>Month Open</span>
            </span>
          )}
        </div>
      }
      description="Calculate absorption of shared factory bills, diesel utilities, and indirect wages into finished output cost per kg."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 inline-flex items-center justify-center"
            onClick={refresh}
            disabled={preview.isFetching}
          >
            <RefreshCw className={cn('size-3.5 shrink-0', preview.isFetching && 'animate-spin')} />
            <span>Refresh</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Period Selector Bar */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
              <Calendar className="size-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-white">Select Monthly Accounting Period</p>
              <p className="text-[11px] text-zinc-500">Choose the monthly cycle to calculate absorption rates for.</p>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <Select
              value={periodKey || 'CURRENT'}
              onValueChange={(val) => setPeriodKey(val === 'CURRENT' ? '' : val)}
            >
              <SelectTrigger className="h-9 text-xs font-bold">
                <SelectValue placeholder="Current Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CURRENT">Current Month</SelectItem>
                {(periods.data ?? []).map((row) => (
                  <SelectItem key={row.periodKey} value={row.periodKey}>
                    {row.label} {row.allocated ? '✓ (Allocated)' : '· (Open)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {p && (
          <>
            {/* 4 Hero KPI Cards: Compact 2 per row on mobile, 4 on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
              {/* Factory Expenses */}
              <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                      Factory Expenses
                    </span>
                    <div className="size-5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <Fuel className="size-3" />
                    </div>
                  </div>
                  <div className="mt-1">
                    <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                      {money(p.expensePool)}
                    </span>
                  </div>
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                  {p.expenseCount} approved plant bills
                </p>
              </div>

              {/* Net Indirect Wages */}
              <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                      Indirect Payroll Pool
                    </span>
                    <div className="size-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Users className="size-3" />
                    </div>
                  </div>
                  <div className="mt-1">
                    <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                      {money(p.payrollPool)}
                    </span>
                  </div>
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                  {money(p.payrollGross)} gross less {money(p.directLabourOffset)} direct
                </p>
              </div>

              {/* Total Pool */}
              <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                      Total Pool to Absorb
                    </span>
                    <div className="size-5 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 flex items-center justify-center shrink-0">
                      <Building2 className="size-3" />
                    </div>
                  </div>
                  <div className="mt-1">
                    <span className="text-base sm:text-lg font-black text-violet-700 dark:text-violet-400 tabular-nums tracking-tight truncate block">
                      {money(p.totalPool)}
                    </span>
                  </div>
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                  Combined monthly overhead
                </p>
              </div>

              {/* Rate per kg */}
              <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                      Overhead Rate / Kg
                    </span>
                    <div className="size-5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <DollarSign className="size-3" />
                    </div>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums tracking-tight truncate">
                      {p.ratePerKg > 0 ? money(p.ratePerKg) : '₦0'}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium">/ kg</span>
                  </div>
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                  Over {fmt(p.basisKg)} kg across {p.batchCount} batch{p.batchCount === 1 ? '' : 'es'}
                </p>
              </div>
            </div>

            {/* Main Interactive Workspace */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
              {/* Left Column: Waterfall & Batches Table */}
              <div className="space-y-6">
                {/* Pool Construction Waterfall Card */}
                <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
                  <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Absorption Calculation Waterfall
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Step-by-step mathematical model deriving the overhead rate per kilogram.
                    </p>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <span className="size-5 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-[11px]">
                          +
                        </span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          Approved Factory Expenses ({p.expenseCount} items)
                        </span>
                      </div>
                      <span className="font-bold tabular-nums text-zinc-900 dark:text-white">
                        {money(p.expensePool)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <span className="size-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[11px]">
                          +
                        </span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          Gross Factory Payroll ({p.payrollRunCount} run{p.payrollRunCount === 1 ? '' : 's'})
                        </span>
                      </div>
                      <span className="font-bold tabular-nums text-zinc-900 dark:text-white">
                        {money(p.payrollGross)}
                      </span>
                    </div>

                    {p.directLabourOffset > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
                        <div className="flex items-center gap-2">
                          <span className="size-5 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[11px]">
                            −
                          </span>
                          <span className="font-semibold text-amber-900 dark:text-amber-200">
                            Less Direct Labour Already Charged to Lots
                          </span>
                        </div>
                        <span className="font-bold tabular-nums text-amber-900 dark:text-amber-300">
                          − {money(p.directLabourOffset)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900/60">
                      <span className="font-bold text-violet-950 dark:text-violet-200">
                        Net Factory Overhead Pool (=)
                      </span>
                      <span className="font-black text-sm tabular-nums text-violet-900 dark:text-violet-300">
                        {money(p.totalPool)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80">
                      <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                        Divided by Usable Dried Output (÷)
                      </span>
                      <span className="font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
                        {fmt(p.basisKg)} kg
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800">
                      <span className="font-bold text-emerald-950 dark:text-emerald-200">
                        Final Overhead Rate per Kg (=)
                      </span>
                      <span className="font-black text-base tabular-nums text-emerald-800 dark:text-emerald-300">
                        {money(p.ratePerKg)} / kg
                      </span>
                    </div>
                  </div>

                  {p.directLabourOffset > 0 && (
                    <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 p-3 text-[11px] text-zinc-500 border border-zinc-100 dark:border-zinc-800">
                      <strong>Automatic Deduplication:</strong> {money(p.directLabourOffset)} of labour was already logged onto daily production & process run logs. It is automatically subtracted from the wage bill here so workers' compensation is never counted twice.
                    </div>
                  )}
                </div>

                {/* Expense Breakdown Categories */}
                {p.expenseBreakdown.length > 0 && (
                  <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-3">
                    <div className="pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                        Expenses in this Period's Pool
                      </h4>
                      <p className="text-xs text-zinc-500">Category breakdown of approved factory bills.</p>
                    </div>

                    <div className="space-y-3 pt-1">
                      {p.expenseBreakdown.map((row) => {
                        const biggest = p.expenseBreakdown[0].amount || 1
                        const share = Math.round((row.amount / p.expensePool) * 100)
                        return (
                          <div key={row.label} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{row.label}</span>
                              <div className="text-right">
                                <span className="font-bold text-zinc-900 dark:text-white tabular-nums">
                                  {money(row.amount)}
                                </span>
                                <span className="text-[11px] text-zinc-400 ml-1.5">({share}%)</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-rose-500"
                                style={{ width: `${(row.amount / biggest) * 100}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Batches Carrying Overhead */}
                {p.basisBatches.length > 0 && (
                  <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-3">
                    <div className="pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                        {p.alreadyAllocated ? 'Batches Absorbing Overhead' : 'Eligible Batches (Dry Lots)'}
                      </h4>
                      <p className="text-xs text-zinc-500">
                        Batches that receive their proportional share based on output kilograms.
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                            <th className="py-2.5 pr-4">Batch Number</th>
                            <th className="py-2.5 pr-4 text-right">Output (kg)</th>
                            <th className="py-2.5 pr-4 text-right">Share (%)</th>
                            <th className="py-2.5 text-right">Overhead Absorbed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                          {p.basisBatches.map((row) => (
                            <tr key={row.batchNumber} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                              <td className="py-3 pr-4">
                                <Link
                                  to={`/batches/${row.batchNumber}`}
                                  className="font-mono text-xs font-bold text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
                                >
                                  <span>{row.batchNumber}</span>
                                  <ExternalLink className="size-3 text-zinc-400" />
                                </Link>
                                {row.materialName && (
                                  <p className="text-[11px] text-zinc-400">{row.materialName}</p>
                                )}
                              </td>
                              <td className="py-3 pr-4 text-right font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                                {fmt(row.qtyOut)} kg
                              </td>
                              <td className="py-3 pr-4 text-right font-bold tabular-nums text-zinc-500">
                                {(row.share * 100).toFixed(1)}%
                              </td>
                              <td className="py-3 text-right font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                                {money(row.overheadAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Month-End Close Console */}
              <div className="space-y-4 lg:sticky lg:top-6">
                <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
                  <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                    <Lock className="size-4 text-zinc-600 dark:text-zinc-400" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Month-End Accounting Close</h3>
                  </div>

                  {p.alreadyAllocated ? (
                    <div className="space-y-3">
                      <div className="rounded-xl bg-teal-50 dark:bg-teal-950/50 p-3.5 border border-teal-200 dark:border-teal-800 space-y-2">
                        <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200 font-bold text-xs">
                          <CheckCircle2 className="size-4 text-teal-600" />
                          <span>{p.periodLabel} is Closed & Locked</span>
                        </div>
                        <p className="text-xs text-teal-800/80 dark:text-teal-300/80 leading-relaxed">
                          Overhead was allocated as{' '}
                          <span className="font-mono font-bold">{p.allocationNumber}</span>. Batches carrying this overhead reflect true fully loaded cost per kg.
                        </p>
                      </div>

                      <p className="text-[11px] text-zinc-400">
                        To adjust any expense, invoice, or attendance record for this month, reverse the allocation below first.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Closing {p.periodLabel} permanently stamps this overhead rate onto all dried output batches for this month, locking the cost per kilogram.
                      </p>

                      <div>
                        <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1.5">
                          Close Notes & Authorization
                        </label>
                        <Input
                          className="h-9 text-xs"
                          placeholder="e.g. September month-end close approved"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>

                      {p.basisKg <= 0 && (
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                          <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>
                            No dried material output was produced in {p.periodLabel}. Overhead cannot be distributed without production output.
                          </span>
                        </div>
                      )}

                      <Button
                        className="w-full h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs"
                        disabled={canAllocate ? busy || p.totalPool <= 0 || p.basisKg <= 0 : true}
                        onClick={allocate}
                      >
                        <Layers className="size-4" />
                        {busy ? 'Processing Allocation…' : `Close Month & Allocate ${money(p.totalPool)}`}
                      </Button>

                      {!canAllocate && (
                        <p className="text-center text-[11px] text-zinc-400">
                          You have view permissions. Manager authorization required to close period.
                        </p>
                      )}
                    </div>
                  )}

                  {message && (
                    <div className="rounded-xl bg-teal-50 p-3 text-xs font-semibold text-teal-800 border border-teal-200 flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-teal-600 shrink-0" />
                      <span>{message}</span>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200 flex items-center gap-2">
                      <AlertCircle className="size-4 text-red-600 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Historical Allocation Ledger */}
        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Historical Absorption Ledger</h3>
            <p className="text-xs text-zinc-500">Record of closed monthly periods, allocation IDs, and reversal logs.</p>
          </div>

          <div className="overflow-x-auto">
            {history.data && history.data.length > 0 ? (
              <table className="w-full text-left text-xs min-w-[960px]">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-2.5 pr-4">Period</th>
                    <th className="py-2.5 pr-4">Allocation #</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4 text-right">Basis Output</th>
                    <th className="py-2.5 pr-4 text-right">Overhead Rate</th>
                    <th className="py-2.5 pr-4 text-right">Lots</th>
                    <th className="py-2.5 pr-4 text-right">Expenses</th>
                    <th className="py-2.5 pr-4 text-right">Wages</th>
                    <th className="py-2.5 pr-4 text-right">Total Pool</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {history.data.map((row) => (
                    <AllocationRow
                      key={row.id}
                      row={row}
                      canAllocate={canAllocate}
                      onChanged={refresh}
                    />
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-8 text-center text-xs text-zinc-400">
                No months have been closed yet. Material costs currently reflect direct line costs only.
              </p>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}

function AllocationRow({
  row,
  canAllocate,
  onChanged,
}: {
  row: Allocation
  canAllocate: boolean
  onChanged: () => void
}) {
  const [reversing, setReversing] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reverse = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.post(`/overhead/${row.allocationNumber}/reverse`, { reason })
      setReversing(false)
      onChanged()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not reverse the allocation'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <tr className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
        <td className="py-3 pr-4">
          <span className="font-bold text-zinc-900 dark:text-zinc-100">{row.periodLabel}</span>
          {row.allocatedBy && (
            <p className="text-[11px] text-zinc-400">by {row.allocatedBy}</p>
          )}
          {row.reversedBy && (
            <p className="text-[11px] text-red-600 font-medium">Reversed by {row.reversedBy}</p>
          )}
          {row.notes && <p className="text-[11px] text-zinc-500">{row.notes}</p>}
        </td>
        <td className="py-3 pr-4 font-mono font-bold text-xs text-zinc-700 dark:text-zinc-300">
          {row.allocationNumber}
        </td>
        <td className="py-3 pr-4">
          <span
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border',
              row.status === 'ALLOCATED'
                ? 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
            )}
          >
            {row.status}
          </span>
        </td>
        <td className="py-3 pr-4 text-right tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
          {fmt(row.basisKg)} kg
        </td>
        <td className="py-3 pr-4 text-right font-black tabular-nums text-emerald-700 dark:text-emerald-400">
          {money(row.ratePerKg)}/kg
        </td>
        <td className="py-3 pr-4 text-right tabular-nums text-zinc-500 font-medium">
          {row.batchCount}
        </td>
        <td className="py-3 pr-4 text-right tabular-nums text-zinc-500">
          {money(row.expensePool)}
        </td>
        <td className="py-3 pr-4 text-right tabular-nums text-zinc-500">
          {money(row.payrollPool)}
        </td>
        <td className="py-3 pr-4 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {money(row.totalPool)}
        </td>
        <td className="py-3 text-right">
          {row.status === 'ALLOCATED' && canAllocate && !reversing && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/50 inline-flex items-center justify-center gap-1"
              onClick={() => setReversing(true)}
            >
              <RotateCcw className="size-3 shrink-0" />
              <span>Reverse</span>
            </Button>
          )}
        </td>
      </tr>

      {/* Reversal Inline Form */}
      {reversing && (
        <tr className="bg-red-50/50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/60">
          <td colSpan={10} className="p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex-1 space-y-1">
                <p className="font-bold text-red-800 dark:text-red-200">
                  Reverse Allocation {row.allocationNumber}
                </p>
                <p className="text-[11px] text-red-700/80 dark:text-red-300/80">
                  Reversing unlocks {row.periodLabel} and removes overhead amounts from all its batches.
                </p>
                <Input
                  className="h-8 text-xs bg-white dark:bg-zinc-900 mt-1"
                  placeholder="Reason for reversal (e.g. late utility invoice received)…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setReversing(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
                  disabled={busy || !reason.trim()}
                  onClick={reverse}
                >
                  {busy ? 'Reversing…' : 'Confirm Reversal'}
                </Button>
              </div>
            </div>
            {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
          </td>
        </tr>
      )}
    </>
  )
}
