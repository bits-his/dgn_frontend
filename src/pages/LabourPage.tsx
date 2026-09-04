import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, UserPlus, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
import { hasPermission } from '@/lib/auth'
import { formatDate } from '@/lib/dates'
import { useAuthStore } from '@/stores/auth-store'
import { SIDEBAR_MENU_ACCESS, type MenuAccessItem } from '@/lib/menuAccess'

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
  shiftId: number | null
  shift: Shift | null
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

type EmployeeAccess = {
  userId: number
  email: string
  username: string
  roleCode: string
  menuAccess?: string[]
  isActive: boolean
  createdAt?: string | null
}

type RoleOption = {
  code: string
  label: string
  permissions: string[]
}

type ShiftOption = {
  id: number
  code: string
  name: string
  startTime?: string | null
  endTime?: string | null
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
  defaultShiftId?: number | null
  defaultShiftName?: string | null
  shiftIds?: number[]
  shiftNames?: string[]
  isActive: boolean
  createdAt?: string | null
  access?: EmployeeAccess | null
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
  const canAccess =
    hasPermission(user, 'labour.manage') || hasPermission(user, 'users.manage')
  const [tab, setTab] = useState<'people' | 'sheet'>('people')

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Staff"
        description="Staff directory with shifts and login access, plus attendance taken per shift."
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['people', 'Staff directory'],
              ['sheet', 'Attendance'],
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
        <Workforce canManage={canManage} canAccess={canAccess} />
      )}
    </div>
  )
}

function AttendanceSheet({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(todayIso())
  const [shiftId, setShiftId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Record<number, Partial<SheetRow>>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sheet = useQuery({
    queryKey: ['attendance', date, shiftId],
    queryFn: async () => {
      const { data } = await api.get('/labour/attendance', {
        params: {
          date,
          ...(shiftId ? { shiftId } : {}),
        },
      })
      return data.data as Sheet
    },
  })

  const shifts = sheet.data?.shifts ?? []

  useEffect(() => {
    if (shiftId != null) return
    if (!shifts.length) return
    const morning = shifts.find((s) => s.code === 'MORNING') || shifts[0]
    setShiftId(morning.id)
  }, [shiftId, shifts.length, shifts[0]?.id])

  const summary = useQuery({
    queryKey: ['labour-summary'],
    queryFn: async () => {
      const { data } = await api.get('/labour/summary')
      return data.data as LabourSummary
    },
  })

  const effective = (row: SheetRow) => {
    const edit = draft[row.employeeId]
    return {
      status: edit?.status ?? row.status,
      hoursWorked: edit?.hoursWorked ?? row.hoursWorked,
      overtimeHours: edit?.overtimeHours ?? row.overtimeHours,
      piecesProduced: edit?.piecesProduced ?? row.piecesProduced,
      shiftId: shiftId ?? edit?.shiftId ?? row.shiftId,
    }
  }

  const pickDate = (value: string) => {
    setDate(value)
    setDraft({})
    setMessage(null)
    setError(null)
  }

  const pickShift = (id: number) => {
    setShiftId(id)
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
    if (!sheet.data || !shiftId) return
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
        }))

      const { data } = await api.post('/labour/attendance', {
        date,
        shiftId,
        entries,
      })
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
  const shiftName = sheet.data?.shift?.name

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
          {canManage && sheet.data && shiftId && (
            <div className="flex flex-wrap gap-2">
              <button className="dgn-btn dgn-btn-secondary" onClick={() => markAll('PRESENT')}>
                Everyone present
              </button>
              <button className="dgn-btn dgn-btn-primary" disabled={saving} onClick={save}>
                <Save className="h-4 w-4" />
                {saving
                  ? 'Saving…'
                  : `Save ${markedCount} · ${shiftName || 'shift'}`}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">Shift</p>
          <div className="flex flex-wrap gap-2">
            {shifts.map((shift) => (
              <button
                key={shift.id}
                type="button"
                onClick={() => pickShift(shift.id)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  shiftId === shift.id
                    ? 'bg-[var(--bg-sidebar)] text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {shift.name}
              </button>
            ))}
            {!shifts.length && !sheet.isLoading && (
              <p className="text-sm text-[var(--ink-muted)]">No shifts set up yet.</p>
            )}
          </div>
        </div>

        {sheet.data && shiftId && (
          <p className="mt-4 text-sm text-[var(--ink-muted)]">
            {shiftName} · {sheet.data.totals.recorded} of {sheet.data.totals.workforce} already
            recorded · {sheet.data.totals.present} present, {sheet.data.totals.halfDay} half day,{' '}
            {sheet.data.totals.absent} absent, {sheet.data.totals.onLeave} on leave
          </p>
        )}
        {!shiftId && (
          <p className="mt-4 text-sm text-[var(--ink-muted)]">
            Choose Morning, Evening, Night (or another shift), then mark who worked that shift.
          </p>
        )}

        {message && (
          <p className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{message}</p>
        )}
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </Card>

      {shiftId && (
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
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
                          onChange={(e) =>
                            patch(row, { piecesProduced: Number(e.target.value) })
                          }
                        />
                      </Field>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
          {!sheet.isLoading && sheet.data?.rows.length === 0 && (
            <Card>
              <p className="text-sm text-[var(--ink-muted)]">
                No staff assigned to {shiftName || 'this shift'}. Assign shifts on the Staff
                directory first.
              </p>
            </Card>
          )}
        </div>
      )}

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

function Workforce({
  canManage,
  canAccess,
}: {
  canManage: boolean
  canAccess: boolean
}) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [accessFor, setAccessFor] = useState<Employee | null>(null)
  const [shiftFor, setShiftFor] = useState<Employee | null>(null)

  const employees = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data } = await api.get('/labour/employees', {
        params: { activeOnly: 'false' },
      })
      return {
        rows: data.data as Employee[],
        payTypes: data.payTypes as string[],
        employmentTypes: data.employmentTypes as string[],
        roles: (data.roles || []) as RoleOption[],
        shifts: (data.shifts || []) as ShiftOption[],
        menuAccess:
          Array.isArray(data.menuAccess) && data.menuAccess.length
            ? (data.menuAccess as MenuAccessItem[])
            : SIDEBAR_MENU_ACCESS,
      }
    },
  })

  const roleLabel = (row: Employee) => {
    const keys = row.access?.menuAccess || []
    if (keys.length) return `${keys.length} menu item${keys.length === 1 ? '' : 's'}`
    return row.access?.roleCode || 'No access'
  }

  const shiftLabel = (row: Employee) => {
    if (row.shiftNames?.length) return row.shiftNames.join(', ')
    return row.defaultShiftName || 'No shift'
  }

  return (
    <div>
      {canManage && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Staff directory</h2>
              <p className="text-sm text-[var(--ink-muted)]">
                Add people, set their shift(s), then grant login access.
              </p>
            </div>
            <button className="dgn-btn dgn-btn-primary" onClick={() => setAdding((v) => !v)}>
              <UserPlus className="h-4 w-4" /> {adding ? 'Close' : 'Add staff'}
            </button>
          </div>

          {adding && (
            <NewEmployeeForm
              payTypes={employees.data?.payTypes ?? []}
              employmentTypes={employees.data?.employmentTypes ?? []}
              shifts={employees.data?.shifts ?? []}
              onSaved={() => {
                setAdding(false)
                queryClient.invalidateQueries({ queryKey: ['employees'] })
                queryClient.invalidateQueries({ queryKey: ['attendance'] })
              }}
            />
          )}
        </Card>
      )}

      {accessFor && (
        <AccessPanel
          employee={accessFor}
          menuItems={
            employees.data?.menuAccess?.length
              ? employees.data.menuAccess
              : SIDEBAR_MENU_ACCESS
          }
          onClose={() => setAccessFor(null)}
          onSaved={() => {
            setAccessFor(null)
            queryClient.invalidateQueries({ queryKey: ['employees'] })
          }}
        />
      )}

      {shiftFor && (
        <ShiftPanel
          employee={shiftFor}
          shifts={employees.data?.shifts ?? []}
          onClose={() => setShiftFor(null)}
          onSaved={() => {
            setShiftFor(null)
            queryClient.invalidateQueries({ queryKey: ['employees'] })
            queryClient.invalidateQueries({ queryKey: ['attendance'] })
          }}
        />
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Code</th>
                <th className="px-3 py-3 font-semibold">Name</th>
                <th className="px-3 py-3 font-semibold">Department</th>
                <th className="px-3 py-3 font-semibold">Shift</th>
                <th className="px-3 py-3 font-semibold">Access</th>
                <th className="px-3 py-3 font-semibold">Pay</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {employees.isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {(employees.data?.rows ?? []).map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--line)] hover:bg-zinc-50/80"
                >
                  <td className="px-4 py-3 tabular-nums text-[var(--ink-muted)]">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs font-semibold">
                    {row.employeeCode}
                  </td>
                  <td className="px-3 py-3 font-semibold">{row.name}</td>
                  <td className="px-3 py-3">
                    {row.department || '—'}
                    {row.designation ? (
                      <p className="text-xs text-[var(--ink-faint)]">{row.designation}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{shiftLabel(row)}</p>
                    {canManage && (
                      <button
                        type="button"
                        className="mt-1 text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                        onClick={() => setShiftFor(row)}
                      >
                        Change shift
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {row.access ? (
                      <>
                        <span
                          className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                            row.access.isActive
                              ? 'bg-teal-50 text-teal-800'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {row.access.isActive ? 'Login on' : 'Login off'}
                        </span>
                        <p className="mt-1 text-xs text-[var(--ink-muted)]">{roleLabel(row)}</p>
                        <p className="text-xs text-[var(--ink-faint)]">{row.access.email}</p>
                      </>
                    ) : (
                      <span className="text-[var(--ink-faint)]">No login</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-xs text-[var(--ink-muted)]">
                      {PAY_TYPE_LABEL[row.payType] ?? row.payType}
                    </p>
                    <p className="font-semibold tabular-nums">{money(row.payRate)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                        row.isActive ? 'bg-teal-50 text-teal-800' : 'bg-zinc-100'
                      }`}
                    >
                      {row.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canAccess && (
                      <button
                        type="button"
                        className="text-sm font-semibold text-[var(--accent-strong)] hover:underline"
                        onClick={() => setAccessFor(row)}
                      >
                        {row.access ? 'Edit access' : 'Give access'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!employees.isLoading && employees.data?.rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    <span className="inline-flex items-center gap-3">
                      <Users className="h-5 w-5" />
                      No staff on record yet.
                    </span>
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

function AccessPanel({
  employee,
  menuItems = SIDEBAR_MENU_ACCESS,
  onClose,
  onSaved,
}: {
  employee: Employee
  menuItems?: MenuAccessItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const [email, setEmail] = useState(employee.access?.email || '')
  const [username, setUsername] = useState(employee.access?.username || '')
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(employee.access?.isActive !== false)
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const key of employee.access?.menuAccess || []) initial[key] = true
    return initial
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const hasLogin = Boolean(employee.access)
  const groups = Array.from(new Set(menuItems.map((item) => item.group)))

  const toggle = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const setGroup = (group: string, on: boolean) => {
    setSelected((prev) => {
      const next = { ...prev }
      for (const item of menuItems) {
        if (item.group === group) next[item.key] = on
      }
      return next
    })
  }

  const submit = async () => {
    setError(null)
    setSaving(true)
    const menuAccess = Object.keys(selected).filter((key) => selected[key])
    try {
      await api.put(`/labour/employees/${employee.id}/access`, {
        email,
        username: username || undefined,
        password: password || undefined,
        isActive,
        menuAccess,
      })
      onSaved()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not save access'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-4 border-[var(--accent)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Access · {employee.name}</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Tick the sidebar pages this person can open, then set their login.
          </p>
        </div>
        <button type="button" className="dgn-btn dgn-btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Login email">
          <input
            className="dgn-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@factory.com"
          />
        </Field>
        <Field label="Username" hint="Defaults from email if blank">
          <input
            className="dgn-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field
          label={hasLogin ? 'New password' : 'Password'}
          hint={hasLogin ? 'Leave blank to keep current password' : 'At least 6 characters'}
        >
          <input
            className="dgn-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Login status">
          <select
            className="dgn-input"
            value={isActive ? '1' : '0'}
            onChange={(e) => setIsActive(e.target.value === '1')}
          >
            <option value="1">Active — can sign in</option>
            <option value="0">Inactive — blocked</option>
          </select>
        </Field>
      </div>

      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Sidebar access</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs font-semibold text-[var(--accent-strong)]"
              onClick={() =>
                setSelected(
                  Object.fromEntries(menuItems.map((item) => [item.key, true])),
                )
              }
            >
              Select all
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-[var(--ink-muted)]"
              onClick={() => setSelected({})}
            >
              Clear
            </button>
          </div>
        </div>

        {groups.map((group) => {
          const items = menuItems.filter((item) => item.group === group)
          const allOn = items.every((item) => selected[item.key])
          return (
            <div key={group} className="rounded-xl ring-1 ring-[var(--line)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-zinc-50 px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  {group}
                </p>
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--ink-muted)]">
                  <input
                    type="checkbox"
                    checked={allOn && items.length > 0}
                    onChange={(e) => setGroup(group, e.target.checked)}
                  />
                  All
                </label>
              </div>
              <div className="grid gap-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-zinc-50"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(selected[item.key])}
                      onChange={() => toggle(item.key)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4">
        <button
          type="button"
          className="dgn-btn dgn-btn-primary"
          disabled={saving}
          onClick={submit}
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save access'}
        </button>
      </div>
    </Card>
  )
}

function ShiftPanel({
  employee,
  shifts,
  onClose,
  onSaved,
}: {
  employee: Employee
  shifts: ShiftOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [selected, setSelected] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {}
    const ids = employee.shiftIds?.length
      ? employee.shiftIds
      : employee.defaultShiftId
        ? [employee.defaultShiftId]
        : []
    for (const id of ids) initial[id] = true
    return initial
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const toggle = (id: number) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const submit = async () => {
    setError(null)
    setSaving(true)
    const shiftIds = Object.keys(selected)
      .filter((key) => selected[Number(key)])
      .map(Number)
    try {
      await api.patch(`/labour/employees/${employee.id}`, { shiftIds })
      onSaved()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown>; status?: number } })
        .response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not update shift'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-4 border-[var(--accent)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Shift · {employee.name}</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Tick one or more shifts this person works (Morning, Evening, Night, etc.).
          </p>
        </div>
        <button type="button" className="dgn-btn dgn-btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>

      <ShiftCheckboxGrid shifts={shifts} selected={selected} onToggle={toggle} />

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="dgn-btn dgn-btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="dgn-btn dgn-btn-primary"
          disabled={saving}
          onClick={submit}
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save shifts'}
        </button>
      </div>
    </Card>
  )
}

function ShiftCheckboxGrid({
  shifts,
  selected,
  onToggle,
}: {
  shifts: ShiftOption[]
  selected: Record<number, boolean>
  onToggle: (id: number) => void
}) {
  if (!shifts.length) {
    return (
      <p className="mt-4 text-sm text-[var(--ink-muted)]">
        No shifts set up yet. Add Morning / Evening / Night under Masters.
      </p>
    )
  }

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {shifts.map((shift) => (
        <label
          key={shift.id}
          className="flex cursor-pointer items-start gap-2 rounded-xl px-3 py-3 text-sm ring-1 ring-[var(--line)] hover:bg-zinc-50"
        >
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(selected[shift.id])}
            onChange={() => onToggle(shift.id)}
          />
          <span>
            <span className="font-semibold">{shift.name}</span>
            {(shift.startTime || shift.endTime) && (
              <span className="mt-0.5 block text-xs text-[var(--ink-faint)]">
                {[shift.startTime, shift.endTime].filter(Boolean).join(' – ')}
              </span>
            )}
          </span>
        </label>
      ))}
    </div>
  )
}

function NewEmployeeForm({
  payTypes,
  employmentTypes,
  shifts,
  onSaved,
}: {
  payTypes: string[]
  employmentTypes: string[]
  shifts: ShiftOption[]
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
  const [selectedShifts, setSelectedShifts] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const submit = async () => {
    setError(null)
    setSaving(true)
    const shiftIds = Object.keys(selectedShifts)
      .filter((key) => selectedShifts[Number(key)])
      .map(Number)
    try {
      await api.post('/labour/employees', {
        ...form,
        payRate: Number(form.payRate),
        overtimeRate: Number(form.overtimeRate) || 0,
        shiftIds,
      })
      onSaved()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not save the staff member'))
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

      <div className="mt-5">
        <p className="text-sm font-semibold">Shifts</p>
        <p className="text-xs text-[var(--ink-muted)]">
          Select one or more — Morning, Evening, Night, or any combination.
        </p>
        <ShiftCheckboxGrid
          shifts={shifts}
          selected={selectedShifts}
          onToggle={(id) =>
            setSelectedShifts((prev) => ({ ...prev, [id]: !prev[id] }))
          }
        />
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
