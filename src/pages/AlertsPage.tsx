import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, SlidersHorizontal, ExternalLink } from 'lucide-react'
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
import { formatDateTime } from '@/lib/dates'
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

const SEV_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border border-red-200',
  WARNING: 'bg-amber-50 text-amber-800 border border-amber-200',
  INFO: 'bg-blue-50 text-blue-700 border border-blue-200',
}

export function AlertsPage() {
  const user = useAuthStore((s) => s.user)
  const canManage = hasPermission(user, 'alert.manage')
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('OPEN_ALL')
  const [severity, setSeverity] = useState('ALL')
  const [tuning, setTuning] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [ackAlert, setAckAlert] = useState<AlertRow | null>(null)
  const [ackNote, setAckNote] = useState('')
  const [ackBusy, setAckBusy] = useState(false)
  const [ackError, setAckError] = useState<string | null>(null)

  const alerts = useQuery({
    queryKey: ['alerts', status, severity],
    queryFn: async () => {
      const { data } = await api.get('/alerts', {
        params: {
          status: status === 'OPEN_ALL' ? undefined : status,
          severity: severity === 'ALL' ? undefined : severity,
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

  const handleConfirmAck = async () => {
    if (!ackAlert) return
    setAckError(null)
    setAckBusy(true)
    try {
      await api.post(`/alerts/${ackAlert.id}/acknowledge`, { note: ackNote })
      setAckAlert(null)
      setAckNote('')
      refresh()
    } catch (err: unknown) {
      const body = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      setAckError(String((body && body.err) || 'Could not acknowledge alert'))
    } finally {
      setAckBusy(false)
    }
  }

  const s = alerts.data?.summary

  const columns = useMemo<ColumnDef<AlertRow>[]>(
    () => [
      {
        accessorKey: 'lastSeenAt',
        header: 'Last Seen',
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-medium text-zinc-900 tabular-nums">
              {formatDateTime(row.original.lastSeenAt)}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {row.original.occurrenceCount} event{row.original.occurrenceCount === 1 ? '' : 's'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
              SEV_BADGE[row.original.severity] ?? 'bg-zinc-100 text-zinc-700'
            }`}
          >
            {row.original.severity}
          </span>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category / Entity',
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-semibold text-zinc-900">{row.original.category}</p>
            {row.original.entityLabel && (
              <p className="font-mono text-[11px] text-zinc-500 mt-0.5">{row.original.entityLabel}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Issue / Details',
        cell: ({ row }) => (
          <div className="max-w-md">
            <p className="font-semibold text-xs text-zinc-900">{row.original.title}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{row.original.message}</p>
            {row.original.metricValue != null && (
              <p className="text-[11px] text-zinc-400 mt-1">
                Value: <span className="font-semibold text-zinc-700">{row.original.metricValue}{row.original.unit ? ` ${row.original.unit}` : ''}</span>
                {row.original.thresholdValue != null ? ` (threshold: ${row.original.thresholdValue})` : ''}
              </p>
            )}
            {row.original.acknowledgeNote && (
              <p className="text-[11px] text-amber-800 mt-1 bg-amber-50 px-2 py-0.5 rounded inline-block">
                Action: {row.original.acknowledgeNote}
              </p>
            )}
            {row.original.resolutionNote && (
              <p className="text-[11px] text-emerald-800 mt-1 bg-emerald-50 px-2 py-0.5 rounded inline-block">
                Resolution: {row.original.resolutionNote}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                row.original.status === 'OPEN'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : row.original.status === 'ACKNOWLEDGED'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {row.original.status}
            </span>
            {row.original.acknowledgedBy && (
              <p className="text-[10px] text-zinc-400 mt-0.5">by {row.original.acknowledgedBy}</p>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            {row.original.linkPath && (
              <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs font-medium gap-1">
                <Link to={row.original.linkPath}>
                  <span>Inspect</span>
                  <ExternalLink className="size-3" />
                </Link>
              </Button>
            )}
            {canManage && row.original.status === 'OPEN' && (
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs font-semibold gap-1"
                onClick={() => {
                  setAckAlert(row.original)
                  setAckNote('')
                  setAckError(null)
                }}
              >
                <span>Handle</span>
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canManage]
  )

  return (
    <PageLayout
      title="Alerts & Thresholds"
      description="Factory intelligence, real-time threshold monitoring, and incident mitigation"
      actions={
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-semibold gap-1.5"
              onClick={() => setTuning(true)}
            >
              <SlidersHorizontal className="size-3.5" />
              Thresholds
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs font-semibold gap-1.5"
            disabled={evaluating}
            onClick={evaluate}
          >
            <RefreshCw className={`size-3.5 ${evaluating ? 'animate-spin' : ''}`} />
            {evaluating ? 'Checking…' : 'Check now'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {s && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatPill label="Active alerts" value={String(s.total)} tone="accent" />
            <StatPill
              label="Critical"
              value={String(s.bySeverity.CRITICAL || 0)}
              tone={(s.bySeverity.CRITICAL || 0) > 0 ? 'danger' : 'default'}
            />
            <StatPill label="Warnings" value={String(s.bySeverity.WARNING || 0)} />
            <StatPill
              label="Need attention"
              value={String(s.unacknowledged)}
              tone={s.unacknowledged > 0 ? 'danger' : 'success'}
            />
          </div>
        )}

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <div className="w-full sm:w-48">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs font-semibold">
                  <SelectValue placeholder="Alert status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN_ALL">Open alerts</SelectItem>
                  <SelectItem value="OPEN">Unacknowledged</SelectItem>
                  <SelectItem value="ACKNOWLEDGED">Being handled</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-48">
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="h-8 text-xs font-semibold">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical only</SelectItem>
                  <SelectItem value="WARNING">Warnings</SelectItem>
                  <SelectItem value="INFO">Informational</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-zinc-500 self-end sm:self-center">
            {alerts.data?.rows.length ?? 0} alert{alerts.data?.rows.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* CustomTable1 with card removed around it */}
        <CustomTable1
          columns={columns}
          data={alerts.data?.rows ?? []}
          loading={alerts.isLoading}
        />

        {/* Thresholds Modal Dialog */}
        <Dialog open={tuning} onOpenChange={setTuning}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Alert Thresholds Configuration</DialogTitle>
              <DialogDescription>
                Customize triggers and warning margins. Changing a value immediately re-evaluates all factory rules.
              </DialogDescription>
            </DialogHeader>

            <ThresholdsModalList onChanged={refresh} />
          </DialogContent>
        </Dialog>

        {/* Acknowledge Action Modal Dialog */}
        {ackAlert && (
          <Dialog open={Boolean(ackAlert)} onOpenChange={(open) => !open && setAckAlert(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Handle Alert</DialogTitle>
                <DialogDescription>
                  Mark {ackAlert.title} as acknowledged so other operators know it is being dealt with.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 mt-2">
                <div>
                  <Label className="text-xs mb-1 block">What action are you taking? (Optional)</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="e.g. Inspecting sensor, informing technician"
                    value={ackNote}
                    onChange={(e) => setAckNote(e.target.value)}
                  />
                </div>

                {ackError && <p className="text-xs text-red-600 font-medium">{ackError}</p>}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setAckAlert(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    disabled={ackBusy}
                    onClick={handleConfirmAck}
                  >
                    {ackBusy ? 'Saving…' : 'Confirm handling'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </PageLayout>
  )
}

function ThresholdsModalList({ onChanged }: { onChanged: () => void }) {
  const thresholds = useQuery({
    queryKey: ['alert-thresholds'],
    queryFn: async () => {
      const { data } = await api.get('/alerts/thresholds')
      return data.data as Threshold[]
    },
  })

  return (
    <div className="space-y-3 mt-2">
      {thresholds.isLoading ? (
        <p className="text-xs text-zinc-500 py-4 text-center">Loading thresholds…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(thresholds.data ?? []).map((row) => (
            <ThresholdRowItem key={row.key} row={row} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  )
}

function ThresholdRowItem({ row, onChanged }: { row: Threshold; onChanged: () => void }) {
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
    <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/50 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-900">{row.label}</span>
        <span className="text-[10px] text-zinc-400">
          {row.isCustom ? `Default: ${row.defaultValue}` : 'Standard default'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className="h-8 text-xs bg-white"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs font-semibold"
          disabled={!dirty || busy}
          onClick={save}
        >
          {busy ? '…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
