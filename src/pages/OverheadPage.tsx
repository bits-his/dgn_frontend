import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

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

type Allocation = {
  id: number
  allocationNumber: string
  periodLabel: string
  status: string
  expensePool: number
  payrollPool: number
  directLabourOffset: number
  totalPool: number
  basisKg: number
  ratePerKg: number
  batchCount: number
  allocatedBy: string | null
  reversedBy: string | null
  notes: string | null
}

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function OverheadPage() {
  const user = useAuthStore((s) => s.user)
  const canAllocate = hasPermission(user, 'overhead.allocate')
  const queryClient = useQueryClient()
  const [periodKey, setPeriodKey] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const periods = useQuery({
    queryKey: ['overhead-periods'],
    queryFn: async () => {
      const { data } = await api.get('/overhead/periods')
      return data.data as { periodKey: string; label: string; allocated: boolean }[]
    },
  })

  const preview = useQuery({
    queryKey: ['overhead-preview', periodKey],
    queryFn: async () => {
      const { data } = await api.get('/overhead/preview', {
        params: periodKey ? { periodKey } : {},
      })
      return data.data as Preview
    },
  })

  const history = useQuery({
    queryKey: ['overhead-history'],
    queryFn: async () => {
      const { data } = await api.get('/overhead')
      return data.data as Allocation[]
    },
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['overhead-preview'] })
    queryClient.invalidateQueries({ queryKey: ['overhead-history'] })
    queryClient.invalidateQueries({ queryKey: ['overhead-periods'] })
    queryClient.invalidateQueries({ queryKey: ['cost-overview'] })
    queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
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
    <div>
      <PageHeader
        eyebrow="Cost intelligence"
        title="Factory overhead"
        description="Rent, diesel, electricity and wages are not caused by any single batch. This spreads them across everything the factory produced in the month, so the cost per kilogram is the real one."
      />

      <Card className="mb-6">
        <div className="w-full sm:w-72">
          <Field label="Month">
            <select
              className="dgn-input"
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
            >
              <option value="">This month</option>
              {(periods.data ?? []).map((row) => (
                <option key={row.periodKey} value={row.periodKey}>
                  {row.label}
                  {row.allocated ? ' (allocated)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      {p && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatPill label="Factory expenses" value={money(p.expensePool)} />
            <StatPill label="Wages in the pool" value={money(p.payrollPool)} />
            <StatPill label="Total to spread" value={money(p.totalPool)} tone="accent" />
            <StatPill
              label="Overhead per kg"
              value={p.ratePerKg > 0 ? `${money(p.ratePerKg)}/kg` : 'nothing to spread'}
              tone={p.ratePerKg > 0 ? 'success' : 'default'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-6">
              <Card>
                <h2 className="text-base font-semibold">How the pool is built</h2>
                <div className="mt-4 space-y-2 text-sm">
                  <Row
                    label={`Approved factory expenses (${p.expenseCount})`}
                    value={money(p.expensePool)}
                  />
                  <Row
                    label={`Approved wages (${p.payrollRunCount} run${p.payrollRunCount === 1 ? '' : 's'})`}
                    value={money(p.payrollGross)}
                  />
                  <Row
                    label="Less labour already charged to batches"
                    value={`− ${money(p.directLabourOffset)}`}
                    tone="bad"
                  />
                  <div className="border-t border-[var(--line)] pt-2">
                    <Row label="Total pool" value={money(p.totalPool)} strong />
                  </div>
                  <Row
                    label="Dried material produced"
                    value={`${fmt(p.basisKg)} kg across ${p.batchCount} batch${p.batchCount === 1 ? '' : 'es'}`}
                  />
                  <div className="border-t border-[var(--line)] pt-2">
                    <Row
                      label="Overhead rate"
                      value={`${money(p.ratePerKg)} per kg`}
                      strong
                      tone="good"
                    />
                  </div>
                </div>

                {p.directLabourOffset > 0 && (
                  <p className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-[var(--ink-muted)]">
                    {money(p.directLabourOffset)} of labour was already typed onto process and
                    production sheets for this month. It is taken off the wage bill here so no
                    worker's pay is counted twice.
                  </p>
                )}
              </Card>

              {p.expenseBreakdown.length > 0 && (
                <Card>
                  <h2 className="text-base font-semibold">What is in the expense pool</h2>
                  <div className="mt-4 space-y-3">
                    {p.expenseBreakdown.map((row) => {
                      const biggest = p.expenseBreakdown[0].amount || 1
                      return (
                        <div key={row.label}>
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="font-medium">{row.label}</span>
                            <span>{money(row.amount)}</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-[var(--accent)]"
                              style={{ width: `${(row.amount / biggest) * 100}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {p.basisBatches.length > 0 && (
                <Card>
                  <h2 className="text-base font-semibold">
                    {p.alreadyAllocated ? 'Batches carrying the overhead' : 'Batches that would carry it'}
                  </h2>
                  <div className="mt-4 -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--ink-faint)]">
                          <th className="py-2 pr-4">Batch</th>
                          <th className="py-2 pr-4 text-right">Output</th>
                          <th className="py-2 pr-4 text-right">Share</th>
                          <th className="py-2 pr-4 text-right">Overhead</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.basisBatches.map((row) => (
                          <tr
                            key={row.batchNumber}
                            className="border-b border-[var(--line)] last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <Link
                                to={`/batches/${row.batchNumber}`}
                                className="font-mono text-xs font-semibold text-[var(--accent-strong)] hover:underline"
                              >
                                {row.batchNumber}
                              </Link>
                              {row.materialName && (
                                <p className="text-xs text-[var(--ink-faint)]">
                                  {row.materialName}
                                </p>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-right">{fmt(row.qtyOut)} kg</td>
                            <td className="py-3 pr-4 text-right">
                              {(row.share * 100).toFixed(1)}%
                            </td>
                            <td className="py-3 pr-4 text-right font-semibold">
                              {money(row.overheadAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card className="lg:sticky lg:top-6">
                <h2 className="text-base font-semibold">Close the month</h2>

                {p.alreadyAllocated ? (
                  <p className="mt-3 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">
                    {p.periodLabel} is closed. Overhead was allocated as{' '}
                    <span className="font-mono font-semibold">{p.allocationNumber}</span>. To change
                    any expense, wage or attendance record for that month, reverse the allocation
                    below first.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-[var(--ink-muted)]">
                      Allocating locks {p.periodLabel} so its expenses, wages and attendance cannot
                      drift after the cost per kilogram has been set. It can be reversed if a late
                      invoice turns up.
                    </p>
                    <div className="mt-4">
                      <Field label="Notes">
                        <input
                          className="dgn-input"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="September month-end close"
                        />
                      </Field>
                    </div>
                    {p.basisKg <= 0 && (
                      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                        No dried material was produced in {p.periodLabel}, so there is nothing to
                        spread these costs over. Overhead for a month with no output has to stay
                        unallocated.
                      </p>
                    )}
                    <button
                      className="dgn-btn dgn-btn-primary mt-4 w-full"
                      disabled={canAllocate ? busy || p.totalPool <= 0 || p.basisKg <= 0 : true}
                      onClick={allocate}
                    >
                      <Layers className="h-4 w-4" />
                      {busy ? 'Allocating…' : `Allocate ${money(p.totalPool)}`}
                    </button>
                    {!canAllocate && (
                      <p className="mt-2 text-center text-xs text-[var(--ink-faint)]">
                        You can see the figures but not close the month.
                      </p>
                    )}
                  </>
                )}

                {message && (
                  <p className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-800">{message}</p>
                )}
                {error && (
                  <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <Card className="mt-6 !p-0 overflow-hidden">
        <h2 className="px-4 pt-4 text-base font-semibold sm:px-6 sm:pt-6">Allocation history</h2>
        {history.data && history.data.length === 0 && (
          <p className="px-4 pb-4 pt-3 text-sm text-[var(--ink-muted)] sm:px-6 sm:pb-6">
            No month has been closed yet, so cost per kilogram currently covers materials and
            direct costs only.
          </p>
        )}
        {history.data && history.data.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-3 py-3 font-semibold">Allocation #</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold text-right">Basis kg</th>
                  <th className="px-3 py-3 font-semibold text-right">Rate / kg</th>
                  <th className="px-3 py-3 font-semibold text-right">Batches</th>
                  <th className="px-3 py-3 font-semibold text-right">Expenses</th>
                  <th className="px-3 py-3 font-semibold text-right">Wages</th>
                  <th className="px-3 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
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
          </div>
        )}
      </Card>
    </div>
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
      <tr className="border-b border-[var(--line)] hover:bg-zinc-50/80">
        <td className="px-4 py-3">
          <span className="font-medium">{row.periodLabel}</span>
          {row.allocatedBy && (
            <p className="text-xs text-[var(--ink-faint)]">by {row.allocatedBy}</p>
          )}
          {row.reversedBy && (
            <p className="text-xs text-red-700">Reversed by {row.reversedBy}</p>
          )}
          {row.notes && <p className="text-xs text-[var(--ink-muted)]">{row.notes}</p>}
        </td>
        <td className="px-3 py-3 font-mono text-xs font-semibold">{row.allocationNumber}</td>
        <td className="px-3 py-3">
          <span
            className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
              row.status === 'ALLOCATED' ? 'bg-teal-50 text-teal-800' : 'bg-zinc-100'
            }`}
          >
            {row.status}
          </span>
        </td>
        <td className="px-3 py-3 text-right tabular-nums">{fmt(row.basisKg)}</td>
        <td className="px-3 py-3 text-right font-semibold tabular-nums">
          {money(row.ratePerKg)}
        </td>
        <td className="px-3 py-3 text-right tabular-nums">{row.batchCount}</td>
        <td className="px-3 py-3 text-right tabular-nums">{money(row.expensePool)}</td>
        <td className="px-3 py-3 text-right tabular-nums">{money(row.payrollPool)}</td>
        <td className="px-3 py-3 text-right font-semibold tabular-nums">
          {money(row.totalPool)}
        </td>
        <td className="px-4 py-3 text-right">
          {canAllocate && row.status === 'ALLOCATED' ? (
            <button
              className="dgn-btn dgn-btn-secondary"
              onClick={() => setReversing((v) => !v)}
            >
              <RotateCcw className="h-4 w-4" /> Reverse
            </button>
          ) : (
            '—'
          )}
        </td>
      </tr>
      {(reversing || error) && (
        <tr className="border-b border-[var(--line)]">
          <td colSpan={10} className="px-4 py-3">
            {reversing && (
              <div className="max-w-xl rounded-xl bg-zinc-50 p-3">
                <Field
                  label="Why are you reversing it?"
                  hint="Required — this removes the overhead from every batch it touched"
                >
                  <input
                    className="dgn-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Late diesel invoice arrived"
                  />
                </Field>
                <button
                  className="dgn-btn dgn-btn-secondary mt-3"
                  disabled={busy || reason.trim().length < 5}
                  onClick={reverse}
                >
                  Confirm reversal
                </button>
              </div>
            )}
            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </td>
        </tr>
      )}
    </>
  )
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'good' | 'bad'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span
        className={
          (strong ? 'font-semibold ' : '') +
          (tone === 'good' ? 'text-teal-700' : tone === 'bad' ? 'text-red-700' : '')
        }
      >
        {value}
      </span>
    </div>
  )
}
