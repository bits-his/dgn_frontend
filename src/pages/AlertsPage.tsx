import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

type AlertRow = {
  id: number
  ruleCode: string
  category: string
  severity: string
  status: string
  title: string
  message: string
  entityLabel: string | null
  linkPath: string | null
  metricValue: number | null
  thresholdValue: number | null
  unit: string | null
  occurrenceCount: number
  firstSeenAt: string
  lastSeenAt: string
  acknowledgedBy: string | null
  acknowledgeNote: string | null
  resolutionNote: string | null
}

type Summary = {
  total: number
  unacknowledged: number
  bySeverity: Record<string, number>
  byCategory: Record<string, number>
}

type Threshold = {
  key: string
  label: string
  value: number
  defaultValue: number
  isCustom: boolean
}

const SEV: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  WARNING: 'bg-amber-500 text-[#1a1205]',
  INFO: 'bg-slate-600 text-white',
}

export function AlertsPage() {
  const user = useAuthStore((s) => s.user)
  const canManage = hasPermission(user, 'alert.manage')
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [tuning, setTuning] = useState(false)
  const [evaluating, setEvaluating] = useState(false)

  const alerts = useQuery({
    queryKey: ['alerts', status, severity],
    queryFn: async () => {
      const { data } = await api.get('/alerts', {
        params: {
          status: status || undefined,
          severity: severity || undefined,
        },
      })
      return {
        rows: data.data as AlertRow[],
        summary: data.summary as Summary,
        categories: data.categories as string[],
      }
    },
    refetchInterval: 30_000,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
    queryClient.invalidateQueries({ queryKey: ['alerts-summary'] })
    queryClient.invalidateQueries({ queryKey: ['executive-dashboard'] })
  }

  const evaluate = async () => {
    setEvaluating(true)
    try {
      await api.post('/alerts/evaluate')
      refresh()
    } finally {
      setEvaluating(false)
    }
  }

  const s = alerts.data?.summary

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence"
        title="Alerts"
        description="Problems the factory already knows about. Acknowledging one says you have seen it. It only leaves this list when the underlying condition actually clears."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <button className="dgn-btn dgn-btn-ghost" onClick={() => setTuning((v) => !v)}>
                <SlidersHorizontal className="h-4 w-4" /> Thresholds
              </button>
            )}
            <button className="dgn-btn dgn-btn-secondary" disabled={evaluating} onClick={evaluate}>
              <RefreshCw className="h-4 w-4" />
              {evaluating ? 'Checking…' : 'Check now'}
            </button>
          </div>
        }
      />

      {s && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatPill label="Open now" value={String(s.total)} tone="accent" />
          <StatPill
            label="Cannot wait"
            value={String(s.bySeverity.CRITICAL || 0)}
            tone={(s.bySeverity.CRITICAL || 0) > 0 ? 'danger' : 'default'}
          />
          <StatPill label="Warnings" value={String(s.bySeverity.WARNING || 0)} />
          <StatPill
            label="Not yet acknowledged"
            value={String(s.unacknowledged)}
            tone={s.unacknowledged > 0 ? 'danger' : 'success'}
          />
        </div>
      )}

      {tuning && <ThresholdsCard onChanged={refresh} />}

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          {[
            ['', 'Open'],
            ['OPEN', 'Unacknowledged'],
            ['ACKNOWLEDGED', 'Being dealt with'],
            ['RESOLVED', 'Closed'],
          ].map(([value, label]) => (
            <button
              key={value || 'open'}
              onClick={() => setStatus(value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                status === value ? 'bg-[var(--bg-sidebar)] text-white' : 'bg-zinc-100'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="mx-1 w-px bg-[var(--line)]" />
          {['', 'CRITICAL', 'WARNING', 'INFO'].map((value) => (
            <button
              key={value || 'all-sev'}
              onClick={() => setSeverity(value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                severity === value ? 'bg-[var(--bg-sidebar)] text-white' : 'bg-zinc-100'
              }`}
            >
              {value || 'All levels'}
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        {(alerts.data?.rows ?? []).map((row) => (
          <AlertCard key={row.id} row={row} canManage={canManage} onChanged={refresh} />
        ))}
        {alerts.data && alerts.data.rows.length === 0 && (
          <Card>
            <div className="flex items-center gap-3 text-sm text-[var(--ink-muted)]">
              <Bell className="h-5 w-5" />
              {status === 'RESOLVED'
                ? 'Nothing has been closed yet.'
                : 'Nothing is wrong right now that the factory knows how to detect.'}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function AlertCard({
  row,
  canManage,
  onChanged,
}: {
  row: AlertRow
  canManage: boolean
  onChanged: () => void
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ack = async () => {
    setError(null)
    setBusy(true)
    try {
      await api.post(`/alerts/${row.id}/acknowledge`, { note })
      onChanged()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      setError(String((body && body.err) || 'Could not acknowledge'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${SEV[row.severity]}`}>
              {row.severity}
            </span>
            <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold">
              {row.category}
            </span>
            <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold">
              {row.status}
            </span>
            {row.entityLabel && (
              <span className="font-mono text-[11px] text-[var(--ink-faint)]">{row.entityLabel}</span>
            )}
          </div>
          <p className="mt-2 font-semibold">{row.title}</p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">{row.message}</p>
          <p className="mt-2 text-xs text-[var(--ink-faint)]">
            Seen {row.occurrenceCount} time{row.occurrenceCount === 1 ? '' : 's'}
            {row.metricValue != null &&
              ` · ${row.metricValue}${row.unit ? ` ${row.unit}` : ''}${
                row.thresholdValue != null ? ` against ${row.thresholdValue}` : ''
              }`}
            {row.acknowledgedBy ? ` · acknowledged by ${row.acknowledgedBy}` : ''}
          </p>
          {row.acknowledgeNote && (
            <p className="mt-2 text-xs text-[var(--ink-muted)]">Note: {row.acknowledgeNote}</p>
          )}
          {row.resolutionNote && (
            <p className="mt-2 text-xs text-teal-700">{row.resolutionNote}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {row.linkPath && (
            <Link to={row.linkPath} className="dgn-btn dgn-btn-secondary">
              Go there
            </Link>
          )}
        </div>
      </div>

      {canManage && row.status === 'OPEN' && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-4">
          <div className="min-w-[200px] flex-1">
            <Field label="What are you doing about it?" hint="Optional">
              <input className="dgn-input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <button className="dgn-btn dgn-btn-primary" disabled={busy} onClick={ack}>
            {busy ? 'Saving…' : 'I am dealing with this'}
          </button>
        </div>
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </Card>
  )
}

function ThresholdsCard({ onChanged }: { onChanged: () => void }) {
  const thresholds = useQuery({
    queryKey: ['alert-thresholds'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/thresholds')
      return data.data as Threshold[]
    },
  })

  return (
    <Card className="mb-6">
      <h2 className="text-base font-semibold">What counts as a problem</h2>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        Changing a number re-runs every rule immediately, so you can see the effect.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(thresholds.data ?? []).map((row) => (
          <ThresholdRow key={row.key} row={row} onChanged={onChanged} />
        ))}
      </div>
    </Card>
  )
}

function ThresholdRow({ row, onChanged }: { row: Threshold; onChanged: () => void }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(String(row.value))
  const [busy, setBusy] = useState(false)
  const dirty = Number(value) !== row.value

  const save = async () => {
    setBusy(true)
    try {
      await api.patch('/alerts/thresholds', { key: row.key, value: Number(value) })
      queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Field label={row.label} hint={row.isCustom ? `default ${row.defaultValue}` : 'factory default'}>
        <div className="flex gap-2">
          <input
            className="dgn-input"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="dgn-btn dgn-btn-secondary" disabled={!dirty || busy} onClick={save}>
            Save
          </button>
        </div>
      </Field>
    </div>
  )
}
