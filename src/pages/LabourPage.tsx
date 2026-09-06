import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, UserPlus, Search, Pencil } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import { StatPill } from '@/components/ui'
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
import {
  SIDEBAR_MENU_ACCESS,
  DEPARTMENT_OPTIONS,
  ROLE_OPTIONS,
  ROLE_DEFAULT_MENU_ACCESS,
  type MenuAccessItem,
} from '@/lib/menuAccess'

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
  firstname?: string | null
  lastname?: string | null
  phone: string | null
  department: string | null
  designation: string | null
  roleType?: string | null
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
  PRESENT: 'bg-teal-600 text-white shadow-xs',
  HALF_DAY: 'bg-amber-500 text-white shadow-xs',
  ABSENT: 'bg-red-600 text-white shadow-xs',
  LEAVE: 'bg-slate-600 text-white shadow-xs',
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
  const [addingStaff, setAddingStaff] = useState(false)

  return (
    <PageLayout
      title="Staff & Workforce"
      description="Workforce directory, shift rosters, attendance, and login access"
      actions={
        tab === 'people' && canManage ? (
          <Button
            size="sm"
            className="h-8 px-3 text-xs font-semibold gap-1.5"
            onClick={() => setAddingStaff(true)}
          >
            <UserPlus className="size-3.5" />
            Add staff
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        {/* Navigation select or segmented pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-60">
            <Select value={tab} onValueChange={(val) => setTab(val as 'people' | 'sheet')}>
              <SelectTrigger className="w-full h-8 text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="people">Staff Directory</SelectItem>
                <SelectItem value="sheet">Daily Attendance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {tab === 'sheet' ? (
          <AttendanceSheet canManage={canManage} />
        ) : (
          <Workforce
            canManage={canManage}
            canAccess={canAccess}
            adding={addingStaff}
            setAdding={setAddingStaff}
          />
        )}
      </div>
    </PageLayout>
  )
}

function AttendanceSheet({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(todayIso)
  const [shiftId, setShiftId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Record<number, Partial<SheetRow>>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sheet = useQuery({
    queryKey: ['attendance', date, shiftId],
    queryFn: async () => {
      const { data } = await api.get('/labour/attendance', {
        params: {
          date,
          shiftId: shiftId ?? undefined,
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
  const shiftName = shifts.find((s) => s.id === shiftId)?.name

  const markedCount = Object.keys(draft).length
    ? Object.values(draft).filter((e) => e?.status).length
    : (sheet.data?.totals.recorded ?? 0)

  return (
    <div className="space-y-4">
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatPill label="Staff" value={String(s.workforce)} hint={`${s.daysRecorded} days on record`} />
          <StatPill label={`Man-days · ${s.periodLabel}`} value={fmt(s.manDays)} tone="accent" />
          <StatPill
            label="Attendance rate"
            value={`${fmt(s.attendanceRatePercent)}%`}
            tone={s.attendanceRatePercent >= 90 ? 'success' : s.attendanceRatePercent >= 75 ? 'accent' : 'danger'}
          />
          <StatPill
            label="Wage bill this month"
            value={s.wageBill != null ? money(s.wageBill) : '—'}
            hint={s.payrollRun ? `${s.payrollRun.runNumber} (${s.payrollRun.status.toLowerCase()})` : 'Payroll not run yet'}
          />
        </div>
      )}

      {/* Control bar */}
      <div className="p-4 rounded-xl border border-zinc-200/80 bg-white shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-full sm:w-48">
              <Label className="text-xs mb-1 block">Date</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={date}
                onChange={(e) => pickDate(e.target.value)}
              />
            </div>

            <div className="w-full sm:w-56">
              <Label className="text-xs mb-1 block">Shift</Label>
              <Select
                value={shiftId ? String(shiftId) : ''}
                onValueChange={(val) => pickShift(Number(val))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {canManage && sheet.data && shiftId && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => markAll('PRESENT')}
              >
                Everyone present
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5"
                disabled={saving}
                onClick={save}
              >
                <Save className="size-3.5" />
                {saving ? 'Saving…' : `Save ${markedCount} · ${shiftName || 'shift'}`}
              </Button>
            </div>
          )}
        </div>

        {sheet.data && shiftId && (
          <p className="text-xs text-zinc-500 pt-1 border-t border-zinc-100">
            {shiftName} · {sheet.data.totals.recorded} of {sheet.data.totals.workforce} recorded ·{' '}
            {sheet.data.totals.present} present, {sheet.data.totals.halfDay} half day,{' '}
            {sheet.data.totals.absent} absent, {sheet.data.totals.onLeave} on leave
          </p>
        )}

        {message && (
          <p className="rounded-md bg-emerald-50 p-2.5 text-xs text-emerald-800 border border-emerald-200">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
            {error}
          </p>
        )}
      </div>

      {shiftId && (
        <div className="space-y-2.5">
          {(sheet.data?.rows ?? []).map((row) => {
            const entry = effective(row)
            const working = entry.status === 'PRESENT' || entry.status === 'HALF_DAY'
            return (
              <div
                key={row.employeeId}
                className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-xs transition hover:border-zinc-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-xs text-zinc-900">{row.name}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {row.employeeCode}
                      {row.department ? ` · ${row.department}` : ''} ·{' '}
                      {PAY_TYPE_LABEL[row.payType] ?? row.payType} {money(row.payRate)}
                    </p>
                  </div>
                  {row.recorded && (
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                      Already saved
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {(sheet.data?.statuses ?? []).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={!canManage}
                      onClick={() => setStatus(row, status)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
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
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-3 pt-2 border-t border-zinc-100">
                    <div>
                      <Label className="text-[10px] text-zinc-500 mb-0.5 block">Hours worked</Label>
                      <Input
                        type="number"
                        className="h-7 text-xs"
                        inputMode="decimal"
                        disabled={!canManage}
                        value={String(entry.hoursWorked ?? '')}
                        onChange={(e) => patch(row, { hoursWorked: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-zinc-500 mb-0.5 block">Overtime hours</Label>
                      <Input
                        type="number"
                        className="h-7 text-xs"
                        inputMode="decimal"
                        disabled={!canManage}
                        value={String(entry.overtimeHours ?? '')}
                        onChange={(e) => patch(row, { overtimeHours: Number(e.target.value) })}
                      />
                    </div>
                    {row.payType === 'PIECE_RATE' && (
                      <div>
                        <Label className="text-[10px] text-zinc-500 mb-0.5 block">Pieces made</Label>
                        <Input
                          type="number"
                          className="h-7 text-xs"
                          inputMode="decimal"
                          disabled={!canManage}
                          value={String(entry.piecesProduced ?? '')}
                          onChange={(e) => patch(row, { piecesProduced: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {!sheet.isLoading && sheet.data?.rows.length === 0 && (
            <div className="p-8 text-center rounded-xl border border-dashed border-zinc-200 text-xs text-zinc-500 bg-white">
              No staff assigned to {shiftName || 'this shift'}. Assign shifts on the Staff directory first.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Workforce({
  canManage,
  canAccess,
  adding,
  setAdding,
}: {
  canManage: boolean
  canAccess: boolean
  adding: boolean
  setAdding: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [accessFor, setAccessFor] = useState<Employee | null>(null)
  const [shiftFor, setShiftFor] = useState<Employee | null>(null)
  const [editStaff, setEditStaff] = useState<Employee | null>(null)
  const [search, setSearch] = useState('')

  const employees = useQuery({
    queryKey: ['labour-employees'],
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
    if (keys.length) return `${keys.length} menu items`
    return row.access?.roleCode || 'No access'
  }

  const shiftLabel = (row: Employee) => {
    if (row.shiftNames?.length) return row.shiftNames.join(', ')
    return row.defaultShiftName || 'No shift'
  }

  const filtered = useMemo(() => {
    const list = employees.data?.rows ?? []
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        (e.department && e.department.toLowerCase().includes(q)) ||
        (e.designation && e.designation.toLowerCase().includes(q))
    )
  }, [employees.data?.rows, search])

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Staff Member',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-xs text-zinc-900">{row.original.name}</p>
            <p className="font-mono text-[11px] text-zinc-400 mt-0.5">{row.original.employeeCode}</p>
          </div>
        ),
      },
      {
        accessorKey: 'department',
        header: 'Department / Role',
        cell: ({ row }) => (
          <div>
            <p className="text-xs text-zinc-800">{row.original.department || '—'}</p>
            {row.original.designation && (
              <p className="text-[11px] text-zinc-400">{row.original.designation}</p>
            )}
          </div>
        ),
      },
      {
        id: 'shift',
        header: 'Shift',
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-medium text-zinc-800">{shiftLabel(row.original)}</p>
            {canManage && (
              <button
                type="button"
                className="mt-0.5 text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 hover:underline cursor-pointer"
                onClick={() => setShiftFor(row.original)}
              >
                Change shift
              </button>
            )}
          </div>
        ),
      },
      {
        id: 'pay',
        header: 'Pay / Salary',
        cell: ({ row }) => (
          <div>
            <p className="text-[11px] text-zinc-400">
              {PAY_TYPE_LABEL[row.original.payType] ?? row.original.payType}
            </p>
            <p className="font-semibold text-xs tabular-nums text-zinc-900">
              {money(row.original.payRate)}
              {row.original.payType === 'MONTHLY' ? (
                <span className="text-[10px] font-normal text-zinc-500 ml-1">/mo</span>
              ) : null}
            </p>
          </div>
        ),
      },
      {
        id: 'access',
        header: 'Login Access',
        cell: ({ row }) => {
          const a = row.original.access
          return (
            <div>
              {a ? (
                <>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      a.isActive
                        ? 'bg-teal-50 text-teal-800 border border-teal-200'
                        : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                    }`}
                  >
                    {a.isActive ? 'Login on' : 'Login off'}
                  </span>
                  <p className="mt-0.5 text-[11px] text-zinc-500">{roleLabel(row.original)}</p>
                </>
              ) : (
                <span className="text-[11px] text-zinc-400">No login</span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              row.original.isActive
                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {row.original.isActive ? 'ACTIVE' : 'INACTIVE'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs font-semibold"
                onClick={() => setEditStaff(row.original)}
              >
                <Pencil className="size-3 mr-1" />
                Edit
              </Button>
            )}
            {canAccess && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs font-semibold"
                onClick={() => setAccessFor(row.original)}
              >
                {row.original.access ? 'Edit access' : 'Give access'}
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canManage, canAccess]
  )

  return (
    <div className="space-y-3">
      {/* Search & filters bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
          <Input
            className="pl-8 h-8 text-xs w-full"
            placeholder="Search name, code, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-zinc-500 self-end sm:self-center">
          {filtered.length} staff member{filtered.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* CustomTable1 with card removed around it */}
      <CustomTable1
        columns={columns}
        data={filtered}
        loading={employees.isLoading}
      />

      {/* Add Staff Dialog */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>
              Register a new worker, configure their compensation structure and assign work shifts.
            </DialogDescription>
          </DialogHeader>

          <NewEmployeeForm
            payTypes={employees.data?.payTypes ?? []}
            employmentTypes={employees.data?.employmentTypes ?? []}
            shifts={employees.data?.shifts ?? []}
            onSaved={() => {
              setAdding(false)
              queryClient.invalidateQueries({ queryKey: ['labour-employees'] })
              queryClient.invalidateQueries({ queryKey: ['masters-employees'] })
              queryClient.invalidateQueries({ queryKey: ['attendance'] })
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Access Panel Dialog */}
      {accessFor && (
        <Dialog open={Boolean(accessFor)} onOpenChange={(open) => !open && setAccessFor(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Login access · {accessFor.name}</DialogTitle>
              <DialogDescription>
                Tick the sidebar pages this person can open, then set their login credentials.
              </DialogDescription>
            </DialogHeader>

            <AccessPanelForm
              employee={accessFor}
              menuItems={
                employees.data?.menuAccess?.length
                  ? employees.data.menuAccess
                  : SIDEBAR_MENU_ACCESS
              }
              onClose={() => setAccessFor(null)}
              onSaved={() => {
                setAccessFor(null)
                queryClient.invalidateQueries({ queryKey: ['labour-employees'] })
                queryClient.invalidateQueries({ queryKey: ['masters-employees'] })
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Shift Panel Dialog */}
      {shiftFor && (
        <Dialog open={Boolean(shiftFor)} onOpenChange={(open) => !open && setShiftFor(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Shifts · {shiftFor.name}</DialogTitle>
              <DialogDescription>
                Select which shift(s) this worker is assigned to.
              </DialogDescription>
            </DialogHeader>

            <ShiftPanelForm
              employee={shiftFor}
              shifts={employees.data?.shifts ?? []}
              onClose={() => setShiftFor(null)}
              onSaved={() => {
                setShiftFor(null)
                queryClient.invalidateQueries({ queryKey: ['labour-employees'] })
                queryClient.invalidateQueries({ queryKey: ['masters-employees'] })
                queryClient.invalidateQueries({ queryKey: ['attendance'] })
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Staff Dialog */}
      {editStaff && (
        <Dialog open={Boolean(editStaff)} onOpenChange={(open) => !open && setEditStaff(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit staff member · {editStaff.name}</DialogTitle>
              <DialogDescription>
                Update employee personal details, department, pay type, salary rate, and assigned shifts.
              </DialogDescription>
            </DialogHeader>

            <EditEmployeeForm
              employee={editStaff}
              payTypes={employees.data?.payTypes ?? []}
              employmentTypes={employees.data?.employmentTypes ?? []}
              shifts={employees.data?.shifts ?? []}
              onClose={() => setEditStaff(null)}
              onSaved={() => {
                setEditStaff(null)
                queryClient.invalidateQueries({ queryKey: ['labour-employees'] })
                queryClient.invalidateQueries({ queryKey: ['masters-employees'] })
                queryClient.invalidateQueries({ queryKey: ['attendance'] })
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function AccessPanelForm({
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
  const [department, setDepartment] = useState(employee.department || 'Production')
  const [role, setRole] = useState(employee.access?.roleCode || employee.roleType || 'OPERATOR')
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const key of employee.access?.menuAccess || []) initial[key] = true
    return initial
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const groups = Array.from(new Set(menuItems.map((item) => item.group)))

  const toggle = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleRoleChange = (newRole: string) => {
    setRole(newRole)
    const defaults = ROLE_DEFAULT_MENU_ACCESS[newRole]
    if (defaults && defaults.length > 0) {
      const next: Record<string, boolean> = {}
      for (const key of defaults) next[key] = true
      setSelected(next)
    }
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
        roleCode: role,
        department,
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
    <div className="space-y-4 mt-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs mb-1 block">Department</Label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENT_OPTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Role</Label>
          <Select value={role} onValueChange={handleRoleChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.code} value={r.code}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Login email</Label>
          <Input
            type="email"
            className="h-8 text-xs"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@factory.com"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Username</Label>
          <Input
            className="h-8 text-xs"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Defaults from email"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">
            {employee.access ? 'Update password' : 'Password'}
          </Label>
          <Input
            type="password"
            className="h-8 text-xs"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={employee.access ? 'Update password (leave blank to keep current)' : 'Set login password (min 6 characters)'}
          />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            id="accActive"
            className="rounded border-zinc-300"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <Label htmlFor="accActive" className="text-xs cursor-pointer">
            Login account is active
          </Label>
        </div>
      </div>

      <div className="pt-2 border-t border-zinc-100">
        <p className="text-xs font-semibold text-zinc-900 mb-2">Permitted menu pages</p>
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {groups.map((group) => {
            const items = menuItems.filter((i) => i.group === group)
            const allChecked = items.every((i) => selected[i.key])
            return (
              <div key={group} className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-2.5">
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-zinc-200">
                  <span className="font-semibold text-xs text-zinc-900">{group}</span>
                  <button
                    type="button"
                    onClick={() => setGroup(group, !allChecked)}
                    className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    {allChecked ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[item.key])}
                        onChange={() => toggle(item.key)}
                        className="rounded border-zinc-300"
                      />
                      <span className="text-zinc-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" className="h-8 text-xs font-semibold" disabled={saving} onClick={submit}>
          {saving ? 'Saving…' : 'Save access'}
        </Button>
      </div>
    </div>
  )
}

function ShiftPanelForm({
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
    for (const id of employee.shiftIds || []) initial[id] = true
    return initial
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setSaving(true)
    const shiftIds = Object.keys(selected)
      .filter((k) => selected[Number(k)])
      .map(Number)
    try {
      await api.put(`/labour/employees/${employee.id}/shifts`, { shiftIds })
      onSaved()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      setError(String((body && body.err) || 'Could not save shifts'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 mt-2">
      <div className="grid gap-2">
        {shifts.map((shift) => (
          <label
            key={shift.id}
            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={Boolean(selected[shift.id])}
              onChange={() => setSelected((prev) => ({ ...prev, [shift.id]: !prev[shift.id] }))}
              className="rounded border-zinc-300"
            />
            <div>
              <p className="text-xs font-semibold text-zinc-900">{shift.name}</p>
              {shift.startTime && shift.endTime && (
                <p className="text-[11px] text-zinc-500">
                  {shift.startTime} – {shift.endTime}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" className="h-8 text-xs font-semibold" disabled={saving} onClick={submit}>
          {saving ? 'Saving…' : 'Update shifts'}
        </Button>
      </div>
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
    department: 'Production',
    designation: 'Worker',
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
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
    <form onSubmit={submit} className="space-y-4 mt-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs mb-1 block">Employee code</Label>
          <Input className="h-8 text-xs" required value={form.employeeCode} onChange={set('employeeCode')} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">First name</Label>
          <Input className="h-8 text-xs" required value={form.firstname} onChange={set('firstname')} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Surname</Label>
          <Input className="h-8 text-xs" required value={form.lastname} onChange={set('lastname')} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Phone</Label>
          <Input className="h-8 text-xs" value={form.phone} onChange={set('phone')} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Department</Label>
          <Select
            value={form.department}
            onValueChange={(val) => setForm((prev) => ({ ...prev, department: val }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENT_OPTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Role / Designation</Label>
          <Select
            value={form.designation}
            onValueChange={(val) => setForm((prev) => ({ ...prev, designation: val }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.code} value={r.label}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Employment type</Label>
          <Select
            value={form.employmentType}
            onValueChange={(val) => setForm((prev) => ({ ...prev, employmentType: val }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {employmentTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">How are they paid?</Label>
          <Select
            value={form.payType}
            onValueChange={(val) => setForm((prev) => ({ ...prev, payType: val }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {payTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {PAY_TYPE_LABEL[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">
            {form.payType === 'MONTHLY' ? 'Salary (₦)' : 'Rate (₦)'}
          </Label>
          <Input
            className="h-8 text-xs"
            type="number"
            inputMode="decimal"
            required
            value={form.payRate}
            onChange={set('payRate')}
            placeholder={form.payType === 'MONTHLY' ? 'e.g. 150000' : 'e.g. 3500'}
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Overtime rate (₦/hr)</Label>
          <Input
            className="h-8 text-xs"
            type="number"
            inputMode="decimal"
            value={form.overtimeRate}
            onChange={set('overtimeRate')}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-zinc-100">
        <p className="text-xs font-semibold text-zinc-900 mb-1">Assigned shifts</p>
        <p className="text-[11px] text-zinc-500 mb-2">
          Select one or more shifts (Morning, Evening, Night).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {shifts.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={Boolean(selectedShifts[s.id])}
                onChange={() =>
                  setSelectedShifts((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                }
                className="rounded border-zinc-300"
              />
              <span className="text-xs font-medium text-zinc-800">{s.name}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
        <Button
          type="submit"
          size="sm"
          className="h-8 text-xs font-semibold"
          disabled={
            saving ||
            !form.employeeCode ||
            !form.firstname ||
            !form.lastname ||
            !(Number(form.payRate) > 0)
          }
        >
          {saving ? 'Saving…' : 'Save staff member'}
        </Button>
      </div>
    </form>
  )
}

function EditEmployeeForm({
  employee,
  payTypes,
  employmentTypes,
  shifts,
  onClose,
  onSaved,
}: {
  employee: Employee
  payTypes: string[]
  employmentTypes: string[]
  shifts: ShiftOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const nameParts = (employee.name || '').trim().split(' ')
  const defaultFirst = employee.firstname || nameParts[0] || ''
  const defaultLast = employee.lastname || nameParts.slice(1).join(' ') || ''

  const [form, setForm] = useState({
    firstname: defaultFirst,
    lastname: defaultLast,
    phone: employee.phone || '',
    department: employee.department || 'Production',
    designation: employee.designation || 'Worker',
    employmentType: employee.employmentType || 'PERMANENT',
    payType: employee.payType || 'DAILY',
    payRate: String(employee.payRate ?? ''),
    overtimeRate: String(employee.overtimeRate ?? ''),
    isActive: employee.isActive !== false,
  })

  const [selectedShifts, setSelectedShifts] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {}
    for (const id of employee.shiftIds || []) initial[id] = true
    if (!Object.keys(initial).length && employee.defaultShiftId) {
      initial[employee.defaultShiftId] = true
    }
    return initial
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const shiftIds = Object.keys(selectedShifts)
      .filter((key) => selectedShifts[Number(key)])
      .map(Number)
    try {
      await api.patch(`/labour/employees/${employee.id}`, {
        firstname: form.firstname.trim(),
        lastname: form.lastname.trim(),
        phone: form.phone.trim() || null,
        department: form.department,
        designation: form.designation,
        employmentType: form.employmentType,
        payType: form.payType,
        payRate: Number(form.payRate),
        overtimeRate: Number(form.overtimeRate) || 0,
        isActive: form.isActive,
        shiftIds,
      })
      onSaved()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      if (body && body.errors) {
        setError(Object.values(body.errors as Record<string, string>).join(' · '))
      } else {
        setError(String((body && body.err) || 'Could not update the staff member'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 mt-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs mb-1 block">Employee code</Label>
          <Input className="h-8 text-xs bg-zinc-50 font-mono" disabled value={employee.employeeCode} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">First name</Label>
          <Input className="h-8 text-xs" required value={form.firstname} onChange={set('firstname')} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Surname</Label>
          <Input className="h-8 text-xs" required value={form.lastname} onChange={set('lastname')} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Phone</Label>
          <Input className="h-8 text-xs" value={form.phone} onChange={set('phone')} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Department</Label>
          <Select
            value={form.department}
            onValueChange={(val) => setForm((prev) => ({ ...prev, department: val }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENT_OPTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Role / Designation</Label>
          <Select
            value={form.designation}
            onValueChange={(val) => setForm((prev) => ({ ...prev, designation: val }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.code} value={r.label}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Employment type</Label>
          <Select
            value={form.employmentType}
            onValueChange={(val) => setForm((prev) => ({ ...prev, employmentType: val }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {employmentTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">How are they paid?</Label>
          <Select
            value={form.payType}
            onValueChange={(val) => setForm((prev) => ({ ...prev, payType: val }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {payTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {PAY_TYPE_LABEL[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">
            {form.payType === 'MONTHLY' ? 'Salary (₦)' : 'Rate (₦)'}
          </Label>
          <Input
            className="h-8 text-xs font-semibold"
            type="number"
            inputMode="decimal"
            required
            value={form.payRate}
            onChange={set('payRate')}
            placeholder={form.payType === 'MONTHLY' ? 'e.g. 150000' : 'e.g. 3500'}
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Overtime rate (₦/hr)</Label>
          <Input
            className="h-8 text-xs"
            type="number"
            inputMode="decimal"
            value={form.overtimeRate}
            onChange={set('overtimeRate')}
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            id="editActive"
            className="rounded border-zinc-300"
            checked={form.isActive}
            onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
          />
          <Label htmlFor="editActive" className="text-xs cursor-pointer">
            Employee is active
          </Label>
        </div>
      </div>

      <div className="pt-2 border-t border-zinc-100">
        <p className="text-xs font-semibold text-zinc-900 mb-1">Assigned shifts</p>
        <p className="text-[11px] text-zinc-500 mb-2">
          Select one or more shifts (Morning, Evening, Night).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {shifts.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2 p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={Boolean(selectedShifts[s.id])}
                onChange={() =>
                  setSelectedShifts((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                }
                className="rounded border-zinc-300"
              />
              <span className="text-xs font-medium text-zinc-800">{s.name}</span>
            </label>
          ))}
        </div>
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
          disabled={
            saving ||
            !form.firstname ||
            !form.lastname ||
            !(Number(form.payRate) > 0)
          }
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

