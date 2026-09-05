import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, Check, Play } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
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
    <div>
      <PageHeader
        eyebrow="People"
        title="Payroll"
      />

      {canRun && <PayrollPreview onCreated={() => runs.refetch()} />}

      <Card className="mt-6 !p-0 overflow-hidden">
        <h2 className="px-4 pt-4 text-base font-semibold sm:px-6 sm:pt-6">Payroll runs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-3 py-3 font-semibold">Run #</th>
                <th className="px-3 py-3 font-semibold text-right">Workers</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold text-right">Net total</th>
                <th className="px-3 py-3 font-semibold text-right">Outstanding</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {runs.isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {(runs.data ?? []).map((run) => (
                <tr
                  key={run.id}
                  className="cursor-pointer border-b border-[var(--line)] hover:bg-zinc-50/80"
                  onClick={() => setOpenRun(run.runNumber)}
                >
                  <td className="px-4 py-3 font-medium">{run.periodLabel}</td>
                  <td className="px-3 py-3 font-mono text-xs font-semibold">{run.runNumber}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{run.employeeCount}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                        run.status === 'PAID'
                          ? 'bg-teal-50 text-teal-800'
                          : run.status === 'APPROVED'
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                            : 'bg-zinc-100'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">
                    {money(run.totalNet)}
                  </td>
                  <td
                    className={`px-3 py-3 text-right tabular-nums ${
                      run.outstanding > 0 ? 'text-red-700' : 'text-teal-700'
                    }`}
                  >
                    {money(run.outstanding)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--accent-strong)] hover:underline"
                      onClick={() => setOpenRun(run.runNumber)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {!runs.isLoading && runs.data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    No payroll has been run yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
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

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full sm:w-64">
          <Field label="Work out wages for">
            <select
              className="dgn-input"
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
            >
              <option value="">This month</option>
              {(periods.data ?? []).map((row) => (
                <option key={row.periodKey} value={row.periodKey}>
                  {row.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {p && !p.existingRun && p.lines.length > 0 && (
          <button className="dgn-btn dgn-btn-primary" disabled={saving} onClick={create}>
            <Play className="h-4 w-4" />
            {saving ? 'Creating…' : `Create payroll for ${p.periodLabel}`}
          </button>
        )}
      </div>

      {p && p.existingRun && (
        <p className="mt-4 rounded-xl bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent-strong)]">
          {p.periodLabel} is already covered by {p.existingRun.runNumber} (
          {p.existingRun.status.toLowerCase()}). Open it below to approve or pay.
        </p>
      )}

      {p && p.lines.length === 0 && (
        <p className="mt-4 text-sm text-[var(--ink-muted)]">
          No attendance has been recorded for {p.periodLabel}, so there is nothing to pay yet.
        </p>
      )}

      {p && p.lines.length > 0 && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatPill label="Workers" value={String(p.totals.employeeCount)} tone="accent" />
            <StatPill label="Basic pay" value={money(p.totals.totalBase)} />
            <StatPill label="Overtime" value={money(p.totals.totalOvertime)} />
            <StatPill label="Wage bill" value={money(p.totals.totalNet)} tone="success" />
          </div>

          {p.totals.unpaidOvertimeCount > 0 && (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {p.totals.unpaidOvertimeCount} worker
              {p.totals.unpaidOvertimeCount === 1 ? ' has' : 's have'} overtime hours logged but no
              overtime rate set, so those hours are not being paid. Set a rate on the workforce page
              if they should be.
            </p>
          )}

          <div className="mt-5 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--ink-faint)]">
                  <th className="py-2 pr-4">Worker</th>
                  <th className="py-2 pr-4">Basis</th>
                  <th className="py-2 pr-4 text-right">Days</th>
                  <th className="py-2 pr-4 text-right">Hours</th>
                  <th className="py-2 pr-4 text-right">Overtime</th>
                  <th className="py-2 pr-4 text-right">Pieces</th>
                  <th className="py-2 pr-4 text-right">Pay</th>
                </tr>
              </thead>
              <tbody>
                {p.lines.map((line) => (
                  <tr key={line.employeeId} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{line.name}</p>
                      {line.department && (
                        <p className="text-xs text-[var(--ink-faint)]">{line.department}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {PAY_TYPE_LABEL[line.payType] ?? line.payType}
                      <p className="text-[var(--ink-faint)]">{money(line.payRate)}</p>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {fmt(line.daysWorked)}
                      {line.daysAbsent > 0 && (
                        <p className="text-xs text-red-700">{fmt(line.daysAbsent)} absent</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right">{fmt(line.hoursWorked)}</td>
                    <td className="py-3 pr-4 text-right">
                      {fmt(line.overtimeHours)}
                      {line.overtimeUnpaid && (
                        <p className="text-xs text-amber-700">unpaid</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {line.piecesProduced > 0 ? fmt(line.piecesProduced) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold">{money(line.netPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!p.existingRun && (
            <div className="mt-4">
              <Field label="Notes on this payroll">
                <input className="dgn-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </Card>
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

  if (!run.data) {
    return <p className="text-sm text-[var(--ink-muted)]">Loading payroll…</p>
  }

  const r = run.data

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-lg font-semibold tracking-tight">{r.runNumber}</p>
        <div className="flex flex-wrap gap-2">
            <button className="dgn-btn dgn-btn-ghost" onClick={onBack}>
              All runs
            </button>
            {canApprove && r.status === 'DRAFT' && (
              <button className="dgn-btn dgn-btn-primary" disabled={busy} onClick={approve}>
                <Check className="h-4 w-4" /> Approve payroll
              </button>
            )}
            {canRun && r.status === 'DRAFT' && (
              <button
                className="dgn-btn dgn-btn-secondary"
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
                    const body = (err as { response?: { data?: Record<string, unknown> } }).response
                      ?.data
                    setError(String((body && body.err) || 'Could not discard the draft'))
                    setBusy(false)
                  }
                }}
              >
                Discard draft
              </button>
            )}
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatPill label="Gross" value={money(r.totalGross)} />
        <StatPill label="Deductions" value={money(r.totalDeductions)} />
        <StatPill label="Net wage bill" value={money(r.totalNet)} tone="accent" />
        <StatPill
          label={r.outstanding > 0 ? 'Still to pay' : 'Paid'}
          value={r.outstanding > 0 ? money(r.outstanding) : money(r.totalPaid)}
          tone={r.outstanding > 0 ? 'danger' : 'success'}
        />
      </div>

      {r.status === 'DRAFT' && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <p className="text-sm text-amber-900">
            This run is still a draft. It has to be approved by someone other than whoever prepared
            it before anyone can be paid, and before it counts towards factory overhead.
          </p>
        </Card>
      )}

      {error && (
        <p className="mb-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <Card>
        <h2 className="text-base font-semibold">Wage register</h2>
        <div className="mt-4 space-y-3">
          {r.lines.map((line) => (
            <div key={line.id} className="rounded-2xl border border-[var(--line)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{line.name}</p>
                  <p className="text-xs text-[var(--ink-faint)]">
                    {line.employeeCode}
                    {line.department ? ` · ${line.department}` : ''} ·{' '}
                    {PAY_TYPE_LABEL[line.payType] ?? line.payType} {money(line.payRate)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--ink-muted)]">
                    {fmt(line.daysWorked)} days
                    {line.daysAbsent > 0 ? `, ${fmt(line.daysAbsent)} absent` : ''} ·{' '}
                    {fmt(line.hoursWorked)} hrs
                    {line.overtimeHours > 0 ? ` · ${fmt(line.overtimeHours)} overtime` : ''}
                    {line.piecesProduced > 0 ? ` · ${fmt(line.piecesProduced)} pieces` : ''}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    Base {money(line.basePay)}
                    {line.overtimePay > 0 ? ` + overtime ${money(line.overtimePay)}` : ''}
                    {line.bonus > 0 ? ` + bonus ${money(line.bonus)}` : ''}
                    {line.deductions > 0 ? ` − deductions ${money(line.deductions)}` : ''}
                  </p>
                  {line.notes && (
                    <p className="mt-1 text-xs text-[var(--ink-faint)]">{line.notes}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{money(line.netPay)}</p>
                  <span
                    className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                      line.paymentStatus === 'PAID'
                        ? 'bg-teal-50 text-teal-800'
                        : line.paymentStatus === 'PARTIAL'
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'
                          : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {line.paymentStatus}
                  </span>
                  {line.outstanding > 0 && canRun && r.status !== 'DRAFT' && (
                    <button
                      className="dgn-btn dgn-btn-secondary mt-2"
                      onClick={() => setPaying(line)}
                    >
                      <Banknote className="h-4 w-4" /> Pay {money(line.outstanding)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

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

  const submit = async () => {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6">
      <div className="dgn-card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">Pay {line.name}</h2>
          <button className="dgn-btn dgn-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          {money(line.outstanding)} outstanding of {money(line.netPay)} earned.
        </p>
        <div className="mt-4 grid gap-4">
          <Field label="Amount (₦)">
            <input
              className="dgn-input"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="How was it paid?">
            <select
              className="dgn-input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {['CASH', 'TRANSFER', 'POS', 'CHEQUE'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note">
            <input className="dgn-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          className="dgn-btn dgn-btn-primary mt-5 w-full"
          disabled={saving || !(Number(amount) > 0)}
          onClick={submit}
        >
          {saving ? 'Saving…' : 'Record payment'}
        </button>
      </div>
    </div>
  )
}
