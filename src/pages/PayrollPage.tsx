import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Check, Play, Trash2, Users, Clock, CheckCircle2, AlertTriangle, Wallet, ArrowDownRight } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import CustomTable1 from '@/components/CustomTable1'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

type PreviewLine = {
  employeeId: number
  name: string
  department: string | null
  payType: string
  payRate: number
  daysWorked: number
  daysAbsent: number
  hoursWorked: number
  overtimeHours: number
  piecesProduced: number
  basePay: number
  overtimePay: number
  netPay: number
  attendanceDays: number
  overtimeUnpaid: boolean
}

type Preview = {
  periodKey: string
  periodLabel: string
  lines: PreviewLine[]
  totals: {
    employeeCount: number
    totalBase: number
    totalOvertime: number
    totalGross: number
    totalNet: number
    noAttendanceCount: number
    unpaidOvertimeCount: number
  }
  existingRun: { runNumber: string; status: string } | null
}

type RunRow = {
  id: number
  runNumber: string
  periodLabel: string
  status: string
  employeeCount: number
  totalGross: number
  totalDeductions: number
  totalNet: number
  totalPaid: number
  outstanding: number
  preparedBy: string | null
  approvedBy: string | null
}

type RunLine = {
  id: number
  name: string | null
  employeeCode: string | null
  department: string | null
  payType: string
  payRate: number
  daysWorked: number
  daysAbsent: number
  hoursWorked: number
  overtimeHours: number
  piecesProduced: number
  basePay: number
  overtimePay: number
  bonus: number
  deductions: number
  netPay: number
  amountPaid: number
  outstanding: number
  paymentStatus: string
  notes: string | null
}

type RunDetail = RunRow & { notes: string | null; lines: RunLine[] }

const PAY_TYPE_LABEL: Record<string, string> = {
  MONTHLY: 'Monthly',
  DAILY: 'Daily',
  HOURLY: 'Hourly',
  PIECE_RATE: 'Per piece',
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function PayrollPage() {
  const user = useAuthStore((s) => s.user)
  const canRun = hasPermission(user, 'payroll.run')
  const canApprove = hasPermission(user, 'expense.approve')
  const [openRun, setOpenRun] = useState<string | null>(null)

  const runs = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: async () => {
      const { data } = await api.get('/payroll')
      return data.data as RunRow[]
    },
  })

  const runColumns = useMemo<ColumnDef<RunRow>[]>(
    () => [
      {
        accessorKey: 'periodLabel',
        header: 'Period & Run',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-xs text-zinc-900">{row.original.periodLabel}</p>
            <p className="font-mono text-[11px] text-zinc-400 mt-0.5">{row.original.runNumber}</p>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                s === 'PAID'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : s === 'APPROVED'
                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                    : s === 'DRAFT'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {s}
            </span>
          )
        },
      },
      {
        accessorKey: 'employeeCount',
        header: 'Workers',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-zinc-700">
            {row.original.employeeCount}
          </span>
        ),
      },
      {
        accessorKey: 'totalGross',
        header: 'Gross Wage',
        cell: ({ row }) => (
          <span className="text-xs font-semibold tabular-nums text-zinc-900">
            {money(row.original.totalGross)}
          </span>
        ),
      },
      {
        accessorKey: 'totalNet',
        header: 'Net Wage Bill',
        cell: ({ row }) => (
          <span className="text-xs font-semibold tabular-nums text-teal-700">
            {money(row.original.totalNet)}
          </span>
        ),
      },
      {
        id: 'settled',
        header: 'Paid / Due',
        cell: ({ row }) => {
          const r = row.original
          return (
            <div>
              <p className="text-xs font-medium tabular-nums text-zinc-800">
                Paid: {money(r.totalPaid)}
              </p>
              {r.outstanding > 0 ? (
                <p className="text-[11px] font-semibold tabular-nums text-red-700">
                  Due: {money(r.outstanding)}
                </p>
              ) : (
                <p className="text-[11px] text-teal-700">All settled</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-semibold"
              onClick={() => setOpenRun(row.original.runNumber)}
            >
              Open run
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const runTotals = useMemo(() => {
    if (!runs.data || runs.data.length === 0) return null
    return runs.data.reduce(
      (acc, r) => ({
        gross: acc.gross + (Number(r.totalGross) || 0),
        net: acc.net + (Number(r.totalNet) || 0),
        paid: acc.paid + (Number(r.totalPaid) || 0),
        due: acc.due + (Number(r.outstanding) || 0),
        workers: Math.max(acc.workers, Number(r.employeeCount) || 0),
      }),
      { gross: 0, net: 0, paid: 0, due: 0, workers: 0 }
    )
  }, [runs.data])

  if (openRun) {
    return (
      <RunDetailView
        runNumber={openRun}
        canRun={canRun}
        canApprove={canApprove}
        onBack={() => setOpenRun(null)}
      />
    )
  }

  return (
    <PageLayout
      title="Payroll"
      description="Monthly salary runs, attendance-linked wages, and disbursement registry"
    >
      <div className="space-y-6">
        {runTotals && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            {/* Net Wage Bill */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Total Net Wage Bill
                  </span>
                  <div className="size-5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <Wallet className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-teal-700 dark:text-teal-400 tabular-nums tracking-tight truncate block">
                    {money(runTotals.net)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Gross wages {money(runTotals.gross)}
              </p>
            </div>

            {/* Total Disbursed */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Disbursed & Paid
                  </span>
                  <div className="size-5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                    {money(runTotals.paid)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Paid across {runs.data?.length} runs
              </p>
            </div>

            {/* Outstanding Due */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Pending / Due
                  </span>
                  <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${runTotals.due > 0 ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    <AlertTriangle className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className={`text-base sm:text-lg font-black tabular-nums tracking-tight truncate block ${runTotals.due > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-900 dark:text-white'}`}>
                    {money(runTotals.due)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                {runTotals.due > 0 ? 'Unpaid salary balance' : 'All payroll runs settled'}
              </p>
            </div>

            {/* Workforce Reach */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Payroll Runs
                  </span>
                  <div className="size-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Users className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                    {runs.data?.length ?? 0}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Peak {runTotals.workers} workers
              </p>
            </div>
          </div>
        )}

        {canRun && <PayrollPreview onCreated={() => runs.refetch()} />}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Payroll Runs History</h2>
            <span className="text-xs text-zinc-500">
              {runs.data?.length ?? 0} run{runs.data?.length === 1 ? '' : 's'} recorded
            </span>
          </div>

          <CustomTable1
            columns={runColumns}
            data={runs.data ?? []}
            loading={runs.isLoading}
          />
        </div>
      </div>
    </PageLayout>
  )
}

function PayrollPreview({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient()
  const [periodKey, setPeriodKey] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const periods = useQuery({
    queryKey: ['overhead-periods'],
    queryFn: async () => {
      const { data } = await api.get('/overhead/periods')
      return data.data as { periodKey: string; label: string }[]
    },
  })

  const preview = useQuery({
    queryKey: ['payroll-preview', periodKey],
    queryFn: async () => {
      const { data } = await api.get('/payroll/preview', {
        params: periodKey ? { periodKey } : {},
      })
      return data.data as Preview
    },
  })

  const create = async () => {
    if (!preview.data) return
    setError(null)
    setSaving(true)
    try {
      await api.post('/payroll', { periodKey: preview.data.periodKey, notes })
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-preview'] })
      onCreated()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not create the payroll run'))
      }
    } finally {
      setSaving(false)
    }
  }

  const p = preview.data

  const previewColumns = useMemo<ColumnDef<PreviewLine>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Worker',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-xs text-zinc-900">{row.original.name}</p>
            {row.original.department && (
              <p className="text-[11px] text-zinc-400">{row.original.department}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'payType',
        header: 'Basis',
        cell: ({ row }) => (
          <div>
            <p className="text-xs text-zinc-700">{PAY_TYPE_LABEL[row.original.payType] ?? row.original.payType}</p>
            <p className="text-[11px] text-zinc-400">{money(row.original.payRate)}</p>
          </div>
        ),
      },
      {
        accessorKey: 'daysWorked',
        header: 'Days',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs text-zinc-800">
            {fmt(row.original.daysWorked)}
            {row.original.daysAbsent > 0 ? ` (${fmt(row.original.daysAbsent)} abs)` : ''}
          </span>
        ),
      },
      {
        accessorKey: 'hoursWorked',
        header: 'Hours',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs text-zinc-800">
            {fmt(row.original.hoursWorked)}
          </span>
        ),
      },
      {
        accessorKey: 'overtimeHours',
        header: 'Overtime',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs text-zinc-800">
            {row.original.overtimeHours > 0 ? `${fmt(row.original.overtimeHours)} hrs` : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'piecesProduced',
        header: 'Pieces',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs text-zinc-800">
            {row.original.piecesProduced > 0 ? fmt(row.original.piecesProduced) : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'netPay',
        header: 'Est. Pay',
        cell: ({ row }) => (
          <span className="font-semibold text-xs tabular-nums text-teal-700">
            {money(row.original.netPay)}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <div className=" rounded-xl border-zinc-200/80 bg-white shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="w-full sm:w-64">
          <Label className="text-xs mb-1 block">Work out wages for</Label>
          <Select
            value={periodKey || "CURRENT"}
            onValueChange={(val) => setPeriodKey(val === "CURRENT" ? "" : val)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="This month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CURRENT">This month</SelectItem>
              {(periods.data ?? []).map((row) => (
                <SelectItem key={row.periodKey} value={row.periodKey}>
                  {row.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {p && !p.existingRun && p.lines.length > 0 && (
          <Button
            size="sm"
            className="h-8 px-3 text-xs font-semibold gap-1.5 self-end sm:self-auto"
            disabled={saving}
            onClick={create}
          >
            <Play className="size-3.5" />
            {saving ? 'Creating…' : `Create payroll for ${p.periodLabel}`}
          </Button>
        )}
      </div>

      {p && p.existingRun && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
          {p.periodLabel} is already covered by {p.existingRun.runNumber} ({p.existingRun.status.toLowerCase()}).
          Open it below to review, approve, or disburse payments.
        </div>
      )}

      {p && p.lines.length === 0 && (
        <p className="text-xs text-zinc-500 py-2">
          No attendance has been recorded for {p.periodLabel}, so there is nothing to pay yet.
        </p>
      )}

      {p && p.lines.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            {/* Workers */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Workers
                  </span>
                  <div className="size-5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Users className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                    {p.totals.employeeCount}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                {p.totals.noAttendanceCount > 0 ? `${p.totals.noAttendanceCount} missing attendance` : 'On attendance roll'}
              </p>
            </div>

            {/* Basic Pay */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Basic Pay
                  </span>
                  <div className="size-5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                    <Banknote className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                    {money(p.totals.totalBase)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Base salary amount
              </p>
            </div>

            {/* Overtime */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Overtime
                  </span>
                  <div className="size-5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Clock className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                    {money(p.totals.totalOvertime)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                {p.totals.unpaidOvertimeCount > 0 ? `${p.totals.unpaidOvertimeCount} unrated hours` : 'Approved OT hours'}
              </p>
            </div>

            {/* Wage Bill */}
            <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                    Wage Bill
                  </span>
                  <div className="size-5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="size-3" />
                  </div>
                </div>
                <div className="mt-1">
                  <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums tracking-tight truncate block">
                    {money(p.totals.totalNet)}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                Net preview total
              </p>
            </div>
          </div>

          {p.totals.unpaidOvertimeCount > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 text-xs text-amber-900 border border-amber-200">
              {p.totals.unpaidOvertimeCount} worker{p.totals.unpaidOvertimeCount === 1 ? ' has' : 's have'}{' '}
              overtime hours logged without an overtime pay rate set.
            </div>
          )}

          <div className="pt-2">
            <p className="text-xs font-semibold text-zinc-900 mb-2">Wage Calculation Preview</p>
            <CustomTable1
              columns={previewColumns}
              data={p.lines}
              loading={preview.isLoading}
            />
          </div>

          {!p.existingRun && (
            <div>
              <Label className="text-xs mb-1 block">Notes on this payroll run</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Optional notes for audit or bookkeeping"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="p-3 rounded-lg bg-red-50 text-xs text-red-700 border border-red-200">{error}</p>
      )}
    </div>
  )
}

function RunDetailView({
  runNumber,
  canRun,
  canApprove,
  onBack,
}: {
  runNumber: string
  canRun: boolean
  canApprove: boolean
  onBack: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [paying, setPaying] = useState<RunLine | null>(null)

  const run = useQuery({
    queryKey: ['payroll-run', runNumber],
    queryFn: async () => {
      const { data } = await api.get(`/payroll/${runNumber}`)
      return data.data as RunDetail
    },
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll-run', runNumber] })
    queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
    queryClient.invalidateQueries({ queryKey: ['overhead-preview'] })
  }

  const approve = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.post(`/payroll/${runNumber}/approve`)
      refresh()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      setError(String((body && body.err) || 'Could not approve the run'))
    } finally {
      setBusy(false)
    }
  }

  const r = run.data

  const lineColumns = useMemo<ColumnDef<RunLine>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Worker',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-xs text-zinc-900">{row.original.name}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {row.original.employeeCode}
              {row.original.department ? ` · ${row.original.department}` : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'work',
        header: 'Work summary',
        cell: ({ row }) => {
          const l = row.original
          return (
            <div className="text-xs text-zinc-700">
              <p>
                {fmt(l.daysWorked)} days{l.daysAbsent > 0 ? `, ${fmt(l.daysAbsent)} absent` : ''} · {fmt(l.hoursWorked)} hrs
              </p>
              {l.overtimeHours > 0 && (
                <p className="text-[11px] text-zinc-500">OT: {fmt(l.overtimeHours)} hrs</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'breakdown',
        header: 'Pay breakdown',
        cell: ({ row }) => {
          const l = row.original
          return (
            <div className="text-xs text-zinc-600">
              <span>Base {money(l.basePay)}</span>
              {l.overtimePay > 0 && <span> + OT {money(l.overtimePay)}</span>}
              {l.bonus > 0 && <span> + Bonus {money(l.bonus)}</span>}
              {l.deductions > 0 && <span> − Ded {money(l.deductions)}</span>}
            </div>
          )
        },
      },
      {
        accessorKey: 'netPay',
        header: 'Net Pay',
        cell: ({ row }) => (
          <span className="font-semibold text-xs tabular-nums text-zinc-900">
            {money(row.original.netPay)}
          </span>
        ),
      },
      {
        accessorKey: 'paymentStatus',
        header: 'Status',
        cell: ({ row }) => {
          const st = row.original.paymentStatus
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                st === 'PAID'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : st === 'PARTIAL'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {st}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const l = row.original
          return (
            <div className="flex items-center justify-end">
              {l.outstanding > 0 && canRun && r?.status !== 'DRAFT' && (
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs font-semibold gap-1.5"
                  onClick={() => setPaying(l)}
                >
                  <Banknote className="size-3.5" />
                  <span>Pay {money(l.outstanding)}</span>
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [canRun, r?.status]
  )

  if (!r) {
    return <p className="text-xs text-zinc-500 py-6 text-center">Loading payroll details…</p>
  }

  return (
    <PageLayout
      title={`Payroll: ${r.runNumber}`}
      description={`${r.periodLabel} · ${r.status} · ${r.employeeCount} workers`}
      back={true}
      backLabel="All runs"
      onBack={onBack}
      actions={
        <div className="flex items-center gap-2">
          {canApprove && r.status === 'DRAFT' && (
            <Button
              size="sm"
              className="h-8 px-3 text-xs font-semibold gap-1.5"
              disabled={busy}
              onClick={approve}
            >
              <Check className="size-3.5" /> Approve payroll
            </Button>
          )}
          {canRun && r.status === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-semibold gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={busy}
              onClick={async () => {
                setError(null)
                setBusy(true)
                try {
                  await api.delete(`/payroll/${runNumber}`)
                  queryClient.invalidateQueries({ queryKey: ['payroll-runs'] })
                  queryClient.invalidateQueries({ queryKey: ['payroll-preview'] })
                  onBack()
                } catch (err: unknown) {
                  const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
                  setError(String((body && body.err) || 'Could not discard the draft'))
                  setBusy(false)
                }
              }}
            >
              <Trash2 className="size-3.5" /> Discard draft
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {/* Gross */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Gross Pay
                </span>
                <div className="size-5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0">
                  <Banknote className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                  {money(r.totalGross)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              {r.employeeCount} staff on payroll
            </p>
          </div>

          {/* Deductions */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Deductions
                </span>
                <div className="size-5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ArrowDownRight className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tabular-nums tracking-tight truncate block">
                  {money(r.totalDeductions)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Withholdings & deductions
            </p>
          </div>

          {/* Net Wage Bill */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  Net Wage Bill
                </span>
                <div className="size-5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Wallet className="size-3" />
                </div>
              </div>
              <div className="mt-1">
                <span className="text-base sm:text-lg font-black text-teal-700 dark:text-teal-400 tabular-nums tracking-tight truncate block">
                  {money(r.totalNet)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              Total payable to staff
            </p>
          </div>

          {/* Outstanding / Paid */}
          <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 sm:p-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
                  {r.outstanding > 0 ? 'Still to Pay' : 'Paid'}
                </span>
                <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${r.outstanding > 0 ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'}`}>
                  {r.outstanding > 0 ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />}
                </div>
              </div>
              <div className="mt-1">
                <span className={`text-base sm:text-lg font-black tabular-nums tracking-tight truncate block ${r.outstanding > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {r.outstanding > 0 ? money(r.outstanding) : money(r.totalPaid)}
                </span>
              </div>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
              {r.outstanding > 0 ? `Paid: ${money(r.totalPaid)}` : '100% disbursed'}
            </p>
          </div>
        </div>

        {r.status === 'DRAFT' && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
            This run is currently a draft. It must be approved before disbursements can be logged.
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Wage Register</h2>
            <span className="text-xs text-zinc-500">{r.lines.length} lines</span>
          </div>

          <CustomTable1
            columns={lineColumns}
            data={r.lines}
            loading={false}
          />
        </div>

        {paying && (
          <PayDialog
            line={paying}
            onClose={() => setPaying(null)}
            onSaved={() => {
              setPaying(null)
              refresh()
            }}
          />
        )}
      </div>
    </PageLayout>
  )
}

function PayDialog({
  line,
  onClose,
  onSaved,
}: {
  line: RunLine
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(String(line.outstanding))
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.post('/payroll/payments', {
        payrollLineId: line.id,
        amount: Number(amount),
        paymentMethod,
        notes,
      })
      onSaved()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not record the payment'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Disburse pay · {line.name}</DialogTitle>
          <DialogDescription>
            {money(line.outstanding)} outstanding of {money(line.netPay)} net wage earned.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3 mt-2">
          <div>
            <Label className="text-xs mb-1 block">Amount (₦)</Label>
            <Input
              type="number"
              inputMode="decimal"
              className="h-8 text-xs font-semibold"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs mb-1 block">Payment method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['CASH', 'TRANSFER', 'POS', 'CHEQUE'].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1 block">Notes / Reference</Label>
            <Input
              className="h-8 text-xs"
              placeholder="e.g. Bank transfer ref or cash voucher #"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs font-semibold"
              disabled={saving || !(Number(amount) > 0)}
            >
              {saving ? 'Saving…' : 'Record payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
