import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, UserPlus, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

type SheetRow = {
  employeeId: number
  employeeCode: string
  name: string
  department: string | null
  payType: string
  payRate: number
  recorded: boolean
  status: string | null
  hoursWorked: number
  overtimeHours: number
  piecesProduced: number
  shiftId: number | null
}

type Shift = { id: number; code: string; name: string }

type Sheet = {
  businessDate: string
  rows: SheetRow[]
  shifts: Shift[]
  statuses: string[]
  totals: {
    workforce: number
    recorded: number
    notRecorded: number
    present: number
    halfDay: number
    absent: number
    onLeave: number
    totalHours: number
    totalOvertime: number
  }
}

type Employee = {
  id: number
  employeeCode: string
  name: string
  phone: string | null
  department: string | null
  designation: string | null
  employmentType: string
  payType: string
  payRate: number
  overtimeRate: number
  isActive: boolean
}

type LabourSummary = {
  periodLabel: string
  workforce: number
  daysRecorded: number
  manDays: number
  absentDays: number
  attendanceRatePercent: number
  totalHours: number
  totalOvertimeHours: number
  byPayType: Record<string, number>
  byDepartment: { label: string; manDays: number; hours: number; overtime: number }[]
  wageBill: number | null
  costPerManDay: number | null
  payrollRun: { runNumber: string; status: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  HALF_DAY: 'Half day',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
}

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-teal-600 text-white',
  HALF_DAY: 'bg-[var(--accent)] text-[#1a1205]',
  ABSENT: 'bg-red-600 text-white',
  LEAVE: 'bg-slate-600 text-white',
}

const PAY_TYPE_LABEL: Record<string, string> = {
  MONTHLY: 'Monthly salary',
  DAILY: 'Daily wage',
  HOURLY: 'Per hour',
  PIECE_RATE: 'Per piece',
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function LabourPage() {
  const user = useAuthStore((s) => s.user)
  const canManage = hasPermission(user, 'labour.manage')
  const [tab, setTab] = useState<'sheet' | 'people'>('sheet')

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Labour & attendance"
        description="Mark who worked each day. Attendance is what payroll is built from, and wages become part of the factory's cost per kilogram."
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['sheet', 'Daily attendance'],
              ['people', 'Workforce'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                tab === key ? 'bg-[var(--bg-sidebar)] text-white' : 'bg-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'sheet' ? (
        <AttendanceSheet canManage={canManage} />
      ) : (
        <Workforce canManage={canManage} />
      )}
    </div>
  )
}

function AttendanceSheet({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(todayIso())
  const [draft, setDraft] = useState<Record<number, Partial<SheetRow>>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sheet = useQuery({
    queryKey: ['attendance', date],
    queryFn: async () => {
      const { data } = await api.get('/labour/attendance', { params: { date } })
      return data.data as Sheet
    },
  })

  const summary = useQuery({
    queryKey: ['labour-summary'],
    queryFn: async () => {
      const { data } = await api.get('/labour/summary')
      return data.data as LabourSummary
    },
  })

  // `draft` holds only what has been touched on screen. Anything untouched
  // falls back to what is already saved for that day.
  const effective = (row: SheetRow) => {
    const edit = draft[row.employeeId]
    return {
      status: edit?.status ?? row.status,
      hoursWorked: edit?.hoursWorked ?? row.hoursWorked,
      overtimeHours: edit?.overtimeHours ?? row.overtimeHours,
      piecesProduced: edit?.piecesProduced ?? row.piecesProduced,
      shiftId: edit?.shiftId ?? row.shiftId,
    }
  }

  const pickDate = (value: string) => {
    setDate(value)
    setDraft({})
    setMessage(null)
    setError(null)
  }

  const patch = (row: SheetRow, changes: Partial<SheetRow>) => {
    setDraft((prev) => ({
      ...prev,
      [row.employeeId]: { ...effective(row), ...prev[row.employeeId], ...changes },
    }))
  }

  const setStatus = (row: SheetRow, status: string) => {
    const current = effective(row)
    const working = status === 'PRESENT' || status === 'HALF_DAY'
    patch(row, {
      status,
      hoursWorked: working
        ? Number(current.hoursWorked) > 0
          ? current.hoursWorked
          : status === 'HALF_DAY'
            ? 4
            : 8
        : 0,
      overtimeHours: working ? current.overtimeHours ?? 0 : 0,
      piecesProduced: working ? current.piecesProduced ?? 0 : 0,
    })
  }

  const markAll = (status: string) => {
    if (!sheet.data) return
    for (const row of sheet.data.rows) setStatus(row, status)
  }

  const save = async () => {
    if (!sheet.data) return
    setError(null)
    setMessage(null)
    setSaving(true)
    try {
      const entries = sheet.data.rows
        .map((row) => ({ row, entry: effective(row) }))
        .filter(({ entry }) => entry.status)
        .map(({ row, entry }) => ({
          employeeId: row.employeeId,
          status: entry.status,
          hoursWorked: Number(entry.hoursWorked ?? 0),
          overtimeHours: Number(entry.overtimeHours ?? 0),
          piecesProduced: Number(entry.piecesProduced ?? 0),
          shiftId: entry.shiftId ?? undefined,
        }))

      const { data } = await api.post('/labour/attendance', { date, entries })
      setDraft({})
      setMessage(data.message)
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      queryClient.invalidateQueries({ queryKey: ['labour-summary'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-preview'] })
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not save attendance'))
      }
    } finally {
      setSaving(false)
    }
  }

  const s = summary.data
  const markedCount = sheet.data
    ? sheet.data.rows.filter((row) => effective(row).status).length
    : 0

  return (
    <div>
      {s && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatPill label={`Workforce · ${s.periodLabel}`} value={String(s.workforce)} tone="accent" />
          <StatPill label="Man-days worked" value={fmt(s.manDays)} />
          <StatPill
            label="Attendance rate"
            value={`${s.attendanceRatePercent}%`}
            tone={s.attendanceRatePercent >= 90 ? 'success' : 'danger'}
          />
          <StatPill
            label="Wage bill"
            value={s.wageBill != null ? money(s.wageBill) : 'Not run yet'}
          />
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full sm:w-56">
            <Field label="Attendance for">
              <input
                className="dgn-input"
                type="date"
                value={date}
                onChange={(e) => pickDate(e.target.value)}
              />
            </Field>
          </div>
          {canManage && sheet.data && (
            <div className="flex flex-wrap gap-2">
              <button className="dgn-btn dgn-btn-secondary" onClick={() => markAll('PRESENT')}>
                Everyone present
              </button>
              <button className="dgn-btn dgn-btn-primary" disabled={saving} onClick={save}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : `Save ${markedCount} worker${markedCount === 1 ? '' : 's'}`}
              </button>
            </div>
          )}
        </div>

        {sheet.data && (
          <p className="mt-4 text-sm text-[var(--ink-muted)]">
            {sheet.data.totals.recorded} of {sheet.data.totals.workforce} already recorded for this
            day · {sheet.data.totals.present} present, {sheet.data.totals.halfDay} half day,{' '}
            {sheet.data.totals.absent} absent, {sheet.data.totals.onLeave} on leave
          </p>
        )}

        {message && (
          <p className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{message}</p>
        )}
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </Card>

      <div className="space-y-3">
        {(sheet.data?.rows ?? []).map((row) => {
          const entry = effective(row)
          const working = entry.status === 'PRESENT' || entry.status === 'HALF_DAY'
          return (
            <Card key={row.employeeId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-[var(--ink-faint)]">
                    {row.employeeCode}
                    {row.department ? ` · ${row.department}` : ''} ·{' '}
                    {PAY_TYPE_LABEL[row.payType] ?? row.payType} {money(row.payRate)}
                  </p>
                </div>
                {row.recorded && (
                  <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-semibold">
                    already saved
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(sheet.data?.statuses ?? []).map((status) => (
                  <button
                    key={status}
                    disabled={!canManage}
                    onClick={() => setStatus(row, status)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                      entry.status === status
                        ? STATUS_STYLE[status]
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    {STATUS_LABEL[status] ?? status}
                  </button>
                ))}
              </div>

              {working && (
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <Field label="Hours">
                    <input
                      className="dgn-input"
                      type="number"
                      inputMode="decimal"
                      disabled={!canManage}
                      value={String(entry.hoursWorked ?? '')}
                      onChange={(e) => patch(row, { hoursWorked: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Overtime hours">
                    <input
                      className="dgn-input"
                      type="number"
                      inputMode="decimal"
                      disabled={!canManage}
                      value={String(entry.overtimeHours ?? '')}
                      onChange={(e) => patch(row, { overtimeHours: Number(e.target.value) })}
                    />
                  </Field>
                  {row.payType === 'PIECE_RATE' && (
                    <Field label="Pieces made" hint="This is what their pay is based on">
                      <input
                        className="dgn-input"
                        type="number"
                        inputMode="decimal"
                        disabled={!canManage}
                        value={String(entry.piecesProduced ?? '')}
                        onChange={(e) => patch(row, { piecesProduced: Number(e.target.value) })}
                      />
                    </Field>
                  )}
                  <Field label="Shift">
                    <select
                      className="dgn-input"
                      disabled={!canManage}
                      value={String(entry.shiftId ?? '')}
                      onChange={(e) =>
                        patch(row, { shiftId: e.target.value ? Number(e.target.value) : null })
                      }
                    >
                      <option value="">Not set</option>
                      {(sheet.data?.shifts ?? []).map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {s && s.byDepartment.length > 0 && (
        <Card className="mt-6">
          <h2 className="text-base font-semibold">Man-days by department · {s.periodLabel}</h2>
          <div className="mt-4 space-y-3">
            {s.byDepartment.map((row) => {
              const biggest = s.byDepartment[0].manDays || 1
              return (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-[var(--ink-muted)]">
                      {fmt(row.manDays)} days · {fmt(row.hours)} hrs
                      {row.overtime > 0 ? ` · ${fmt(row.overtime)} ot` : ''}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${(row.manDays / biggest) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {s.costPerManDay != null && (
            <p className="mt-4 text-sm text-[var(--ink-muted)]">
              Labour is costing {money(s.costPerManDay)} per man-day this month.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}

function Workforce({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)

  const employees = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data } = await api.get('/labour/employees')
      return {
        rows: data.data as Employee[],
        payTypes: data.payTypes as string[],
        employmentTypes: data.employmentTypes as string[],
      }
    },
  })

  return (
    <div>
      {canManage && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Workforce</h2>
              <p className="text-sm text-[var(--ink-muted)]">
                Each person's pay basis decides how their wages are worked out.
              </p>
            </div>
            <button className="dgn-btn dgn-btn-primary" onClick={() => setAdding((v) => !v)}>
              <UserPlus className="h-4 w-4" /> {adding ? 'Close' : 'Add worker'}
            </button>
          </div>

          {adding && (
            <NewEmployeeForm
              payTypes={employees.data?.payTypes ?? []}
              employmentTypes={employees.data?.employmentTypes ?? []}
              onSaved={() => {
                setAdding(false)
                queryClient.invalidateQueries({ queryKey: ['employees'] })
                queryClient.invalidateQueries({ queryKey: ['attendance'] })
              }}
            />
          )}
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(employees.data?.rows ?? []).map((row) => (
          <Card key={row.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.name}</p>
                <p className="text-xs text-[var(--ink-faint)]">
                  {row.employeeCode}
                  {row.designation ? ` · ${row.designation}` : ''}
                  {row.department ? ` · ${row.department}` : ''}
                </p>
                <p className="mt-2 text-sm">
                  {PAY_TYPE_LABEL[row.payType] ?? row.payType}:{' '}
                  <span className="font-semibold">{money(row.payRate)}</span>
                  {row.overtimeRate > 0 && (
                    <span className="text-[var(--ink-muted)]">
                      {' '}
                      · overtime {money(row.overtimeRate)}/hr
                    </span>
                  )}
                </p>
                {row.overtimeRate <= 0 && row.payType !== 'HOURLY' && (
                  <p className="mt-1 text-xs text-amber-700">
                    No overtime rate set — any overtime logged for this worker is unpaid.
                  </p>
                )}
              </div>
              <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-semibold">
                {row.employmentType}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {employees.data && employees.data.rows.length === 0 && (
        <Card>
          <div className="flex items-center gap-3 text-sm text-[var(--ink-muted)]">
            <Users className="h-5 w-5" />
            No workers on record yet.
          </div>
        </Card>
      )}
    </div>
  )
}

function NewEmployeeForm({
  payTypes,
  employmentTypes,
  onSaved,
}: {
  payTypes: string[]
  employmentTypes: string[]
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    employeeCode: '',
    firstname: '',
    lastname: '',
    phone: '',
    department: '',
    designation: '',
    employmentType: 'PERMANENT',
    payType: 'DAILY',
    payRate: '',
    overtimeRate: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      await api.post('/labour/employees', {
        ...form,
        payRate: Number(form.payRate),
        overtimeRate: Number(form.overtimeRate) || 0,
      })
      onSaved()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not save the worker'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-5 border-t border-[var(--line)] pt-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Employee code">
          <input className="dgn-input" value={form.employeeCode} onChange={set('employeeCode')} />
        </Field>
        <Field label="First name">
          <input className="dgn-input" value={form.firstname} onChange={set('firstname')} />
        </Field>
        <Field label="Surname">
          <input className="dgn-input" value={form.lastname} onChange={set('lastname')} />
        </Field>
        <Field label="Phone">
          <input className="dgn-input" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Department">
          <input className="dgn-input" value={form.department} onChange={set('department')} />
        </Field>
        <Field label="Job title">
          <input className="dgn-input" value={form.designation} onChange={set('designation')} />
        </Field>
        <Field label="Employment type">
          <select className="dgn-input" value={form.employmentType} onChange={set('employmentType')}>
            {employmentTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How are they paid?">
          <select className="dgn-input" value={form.payType} onChange={set('payType')}>
            {payTypes.map((t) => (
              <option key={t} value={t}>
                {PAY_TYPE_LABEL[t] ?? t}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Rate (₦)"
          hint={
            form.payType === 'MONTHLY'
              ? 'Full monthly salary'
              : form.payType === 'DAILY'
                ? 'Per day worked'
                : form.payType === 'HOURLY'
                  ? 'Per hour'
                  : 'Per piece produced'
          }
        >
          <input
            className="dgn-input"
            type="number"
            inputMode="decimal"
            value={form.payRate}
            onChange={set('payRate')}
          />
        </Field>
        <Field label="Overtime rate (₦/hr)" hint="Leave blank if overtime is not paid">
          <input
            className="dgn-input"
            type="number"
            inputMode="decimal"
            value={form.overtimeRate}
            onChange={set('overtimeRate')}
          />
        </Field>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        className="dgn-btn dgn-btn-primary mt-4"
        disabled={
          saving ||
          !form.employeeCode ||
          !form.firstname ||
          !form.lastname ||
          !(Number(form.payRate) > 0)
        }
        onClick={submit}
      >
        {saving ? 'Saving…' : 'Save worker'}
      </button>
    </div>
  )
}
