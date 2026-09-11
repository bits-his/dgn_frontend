import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, StatPill } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { hasPermission } from '@/lib/auth'
import { formatBusinessDate } from '@/lib/dates'
import { useAuthStore } from '@/stores/auth-store'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTable1 from '@/components/CustomTable1'

type QueueBatch = {
  id: number
  batchNumber: string
  batchType: string
  status: string
  qtyRemaining: number
  uom: string
  materialName: string | null
  productName: string | null
  targetWeightPerPiece: number | null
  machineName: string | null
  locationName: string | null
  shiftName: string | null
  businessDate: string | null
  checkType: 'PRODUCTION' | 'MATERIAL'
  checkCount: number
}

type DefectType = {
  id: number
  code: string
  name: string
  severity: string
  appliesTo: string
}

type BlockedBatch = {
  id: number
  batchNumber: string
  batchType: string
  status: string
  qtyRemaining: number
  uom: string
  itemName: string | null
  locationName: string | null
}

type QcCheckRow = {
  id: number
  batchNumber: string | null
  productName: string | null
  decision: string
  qtyAccepted: number
  qtyRejected: number
  qtyRework: number
  uom: string
  defectCount: number
  defectRatePercent: number
  reworkBatchNumber: string | null
  inspectorName: string | null
  businessDate: string | null
  notes: string | null
}

type Decision = 'PASS' | 'FAIL' | 'HOLD'

const DECISION_COPY: Record<Decision, { label: string; help: string }> = {
  PASS: { label: 'Pass', help: 'Release the batch for consumption and sale' },
  FAIL: { label: 'Fail', help: 'Scrap the batch — nothing can be accepted' },
  HOLD: { label: 'Hold', help: 'Freeze the batch until a later decision' },
}

function fmt(n: number) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function statusTone(status: string): 'default' | 'accent' | 'success' | 'danger' {
  if (status === 'ACCEPTED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'QC_HOLD') return 'accent'
  return 'default'
}

export function QcPage() {
  const user = useAuthStore((s) => s.user)
  const canInspect = hasPermission(user, 'qc.inspect')
  const [selected, setSelected] = useState<QueueBatch | null>(null)

  const queue = useQuery({
    queryKey: ['qc-queue'],
    queryFn: async () => {
      const { data } = await api.get('/qc/queue')
      const items = (data.data as QueueBatch[]) || []
      return items.filter(
        (b) => !(b.batchType === 'PROD' && (b.status === 'IN_PROGRESS' || b.status === 'PENDING'))
      )
    },
  })

  const blocked = useQuery({
    queryKey: ['qc-blocked'],
    queryFn: async () => {
      const { data } = await api.get('/qc/blocked')
      return data.data as BlockedBatch[]
    },
  })

  const checks = useQuery({
    queryKey: ['qc-checks'],
    queryFn: async () => {
      const { data } = await api.get('/qc/checks')
      return data.data as QcCheckRow[]
    },
  })

  const queueColumns = useMemo<ColumnDef<QueueBatch>[]>(
    () => [
      {
        id: 'batchNumber',
        header: 'Batch',
        cell: ({ row }) => {
          const batch = row.original
          return (
            <div>
              <Link
                to={`/batches/${batch.batchNumber}`}
                className="font-mono text-xs font-semibold text-zinc-900 hover:underline"
              >
                {batch.batchNumber}
              </Link>
              {batch.status === 'QC_HOLD' && (
                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  On hold
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 tabular-nums">
            {formatBusinessDate(row.original.businessDate)}
          </span>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
            {row.original.batchType}
          </span>
        ),
      },
      {
        id: 'item',
        header: 'Item',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-zinc-800">
            {row.original.productName || row.original.materialName || '—'}
          </span>
        ),
      },
      {
        id: 'qty',
        header: 'Quantity',
        cell: ({ row }) => (
          <span className="text-xs font-semibold tabular-nums text-zinc-900">
            {fmt(row.original.qtyRemaining)} {row.original.uom}
          </span>
        ),
      },
      {
        id: 'location',
        header: 'Location / Machine',
        cell: ({ row }) => {
          const b = row.original
          return (
            <div>
              <span className="text-xs text-zinc-800">{b.locationName || b.machineName || '—'}</span>
              {b.locationName && b.machineName && (
                <p className="text-[11px] text-zinc-400">{b.machineName}</p>
              )}
              {b.shiftName && (
                <p className="text-[11px] text-zinc-400">{b.shiftName}</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'inspections',
        header: 'Inspections',
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-zinc-600">
            {row.original.checkCount}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            {canInspect ? (
              <Button
                size="sm"
                className="h-8 px-3 text-xs font-semibold gap-1 whitespace-nowrap inline-flex items-center"
                onClick={() => setSelected(row.original)}
              >
                <span>Inspect</span>
              </Button>
            ) : (
              <span className="text-xs text-zinc-400">—</span>
            )}
          </div>
        ),
      },
    ],
    [canInspect]
  )

  const checksColumns = useMemo<ColumnDef<QcCheckRow>[]>(
    () => [
      {
        id: 'batchNumber',
        header: 'Batch',
        cell: ({ row }) => (
          row.original.batchNumber ? (
            <Link
              to={`/batches/${row.original.batchNumber}`}
              className="font-mono text-xs font-semibold text-zinc-900 hover:underline"
            >
              {row.original.batchNumber}
            </Link>
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          )
        ),
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 tabular-nums">
            {formatBusinessDate(row.original.businessDate)}
          </span>
        ),
      },
      {
        id: 'decision',
        header: 'Decision',
        cell: ({ row }) => {
          const d = row.original.decision
          const badgeClass =
            d === 'PASS'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : d === 'FAIL'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}`}
            >
              {d}
            </span>
          )
        },
      },
      {
        id: 'accepted',
        header: 'Accepted',
        cell: ({ row }) => (
          <span className="text-xs font-medium tabular-nums text-emerald-700">
            {fmt(row.original.qtyAccepted)}
          </span>
        ),
      },
      {
        id: 'waste',
        header: 'Waste',
        cell: ({ row }) => (
          <span className="text-xs font-medium tabular-nums text-red-700">
            {fmt(row.original.qtyRejected)}
          </span>
        ),
      },
      {
        id: 'rework',
        header: 'Rework',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs tabular-nums text-zinc-700">
            <span>{fmt(row.original.qtyRework)}</span>
            {row.original.reworkBatchNumber && (
              <Link
                to={`/batches/${row.original.reworkBatchNumber}`}
                className="font-mono text-[11px] text-[var(--accent-strong)] hover:underline"
              >
                ({row.original.reworkBatchNumber})
              </Link>
            )}
          </div>
        ),
      },
      {
        id: 'defectRate',
        header: 'Defect Rate',
        cell: ({ row }) => (
          <span className={`text-xs font-semibold tabular-nums ${row.original.defectRatePercent > 0 ? 'text-amber-700' : 'text-zinc-600'}`}>
            {row.original.defectRatePercent}%
          </span>
        ),
      },
      {
        id: 'inspector',
        header: 'Inspector',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-700">
            {row.original.inspectorName || '—'}
          </span>
        ),
      },
    ],
    []
  )

  if (selected) {
    return <InspectionForm batch={selected} onBack={() => setSelected(null)} />
  }

  return (
    <PageLayout
      title="Inspection queue"
      description="Quality control · Inspect finished production and drying batches"
      actions={
        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1.5" asChild>
          <Link to="/qc/trends">
            <ShieldCheck className="size-3.5" />
            Defect trends
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">

      {!canInspect && (
        <Card className="mb-4 border-amber-200 bg-amber-50 text-amber-950">
          You can view inspections but not record them. Ask for the QC officer role to make
          decisions.
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">
            Awaiting inspection
          </h2>
          <span className="text-xs text-zinc-500">
            {queue.data?.length ?? 0} batches waiting
          </span>
        </div>
        <CustomTable1
          data={queue.data || []}
          columns={queueColumns}
          loading={queue.isLoading}
          card
        />
      </div>

      {blocked.data && blocked.data.length > 0 && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-800">
            <Ban className="size-5" />
            <h2 className="text-lg font-semibold tracking-tight">Blocked from use</h2>
          </div>
          <p className="mt-2 text-sm text-red-800">
            These batches cannot be consumed, produced from or sold until quality control releases
            them.
          </p>
          <div className="mt-3 space-y-2 text-sm text-red-900">
            {blocked.data.map((batch) => (
              <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/batches/${batch.batchNumber}`} className="font-semibold hover:underline">
                  {batch.batchNumber}
                </Link>
                <span>
                  {batch.itemName || batch.batchType} · {fmt(batch.qtyRemaining)} {batch.uom} ·{' '}
                  {batch.status === 'QC_HOLD' ? 'on hold' : 'scrapped'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">
            Recent inspections
          </h2>
          <span className="text-xs text-zinc-500">
            {checks.data?.length ?? 0} inspections recorded
          </span>
        </div>
        <CustomTable1
          data={checks.data || []}
          columns={checksColumns}
          loading={checks.isLoading}
          card
        />
      </div>
      </div>
    </PageLayout>
  )
}

function InspectionForm({ batch, onBack }: { batch: QueueBatch; onBack: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [decision, setDecision] = useState<Decision>('PASS')
  const [sampleSize, setSampleSize] = useState('')
  const [weightPerPiece, setWeightPerPiece] = useState('')
  const [dimensionOk, setDimensionOk] = useState(true)
  const [colourOk, setColourOk] = useState(true)
  const [contaminationPercent, setContaminationPercent] = useState('')
  const [moisturePercent, setMoisturePercent] = useState('')
  const [qtyRejected, setQtyRejected] = useState('0')
  const [qtyRework, setQtyRework] = useState('0')
  const [scrapCost, setScrapCost] = useState('')
  const [notes, setNotes] = useState('')
  const [defectCounts, setDefectCounts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [warning, setWarning] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{
    batchStatus: string
    qtyAccepted: number
    reworkBatchNumber: string | null
    defectRatePercent: number
  } | null>(null)

  const defectTypes = useQuery({
    queryKey: ['defect-types'],
    queryFn: async () => {
      const { data } = await api.get('/masters/defect-types')
      return data.data as DefectType[]
    },
  })

  const relevantDefects = useMemo(
    () => defectTypes.data?.filter((d) => d.appliesTo === batch.checkType) ?? [],
    [defectTypes.data, batch.checkType],
  )

  useEffect(() => {
    if (decision === 'HOLD') {
      setQtyRejected('0')
      setQtyRework('0')
    }
    if (decision === 'FAIL' && Number(qtyRejected) + Number(qtyRework) === 0) {
      setQtyRejected(String(batch.qtyRemaining))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision])

  const rejected = Number(qtyRejected || 0)
  const rework = Number(qtyRework || 0)
  const accepted = decision === 'HOLD' ? 0 : Number((batch.qtyRemaining - rejected - rework).toFixed(3))
  const defectTotal = Object.values(defectCounts).reduce((s, v) => s + Number(v || 0), 0)
  const sample = Number(sampleSize || 0)
  const defectRate = sample > 0 ? Number(((defectTotal / sample) * 100).toFixed(2)) : 0
  const variance =
    batch.targetWeightPerPiece && weightPerPiece
      ? Number(
          (((Number(weightPerPiece) - batch.targetWeightPerPiece) / batch.targetWeightPerPiece) *
            100).toFixed(2),
        )
      : null

  const submit = async (confirmUnusualCheck: boolean) => {
    setError('')
    setWarning(null)
    setSaving(true)
    try {
      const defects = Object.entries(defectCounts)
        .filter(([, count]) => Number(count) > 0)
        .map(([code, count]) => ({ code, count: Number(count) }))

      const { data } = await api.post('/qc/checks', {
        batchNumber: batch.batchNumber,
        decision,
        sampleSize: sample,
        qtyAccepted: decision === 'HOLD' ? 0 : accepted,
        qtyRejected: rejected,
        qtyRework: rework,
        weightPerPiece: weightPerPiece ? Number(weightPerPiece) : null,
        dimensionOk,
        colourOk,
        contaminationPercent: contaminationPercent ? Number(contaminationPercent) : null,
        moisturePercent: moisturePercent ? Number(moisturePercent) : null,
        defects,
        scrapCost: scrapCost ? Number(scrapCost) : 0,
        notes,
        confirmUnusualCheck,
      })

      setResult({
        batchStatus: data.calculated.batchStatus,
        qtyAccepted: data.calculated.qtyAccepted,
        reworkBatchNumber: data.reworkBatchNumber,
        defectRatePercent: data.calculated.defectRatePercent,
      })
      queryClient.invalidateQueries({ queryKey: ['qc-queue'] })
      queryClient.invalidateQueries({ queryKey: ['qc-blocked'] })
      queryClient.invalidateQueries({ queryKey: ['qc-checks'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-overview'] })
    } catch (err: unknown) {
      const res = (
        err as {
          response?: {
            status?: number
            data?: {
              warning?: boolean
              message?: string
              err?: string
              errors?: Record<string, string>
            }
          }
        }
      ).response
      if (res?.status === 422 && res.data?.warning) {
        setWarning(res.data.message || 'Readings look unusual. Confirm to proceed.')
      } else if (res?.data?.errors) {
        setError(Object.values(res.data.errors).join(' · '))
      } else {
        setError(res?.data?.err || 'Could not save this inspection')
      }
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    return (
      <PageLayout
        title={`Inspect Batch: ${batch.batchNumber}`}
        description="Inspection recorded successfully"
        back={true}
        backLabel="Back to queue"
        onBack={onBack}
      >
        <Card className="text-center !p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            Inspection recorded
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{batch.batchNumber}</p>
          <div className="mx-auto mt-5 grid max-w-xl gap-3 sm:grid-cols-3">
            <StatPill label="New status" value={result.batchStatus} tone={statusTone(result.batchStatus)} />
            <StatPill label="Accepted" value={`${fmt(result.qtyAccepted)} ${batch.uom}`} tone="success" />
            <StatPill label="Defect rate" value={`${result.defectRatePercent}%`} tone="accent" />
          </div>
          {result.reworkBatchNumber && (
            <p className="mt-4 text-sm text-[var(--ink-muted)]">
              Rework regrind created as{' '}
              <Link
                to={`/batches/${result.reworkBatchNumber}`}
                className="font-semibold text-[var(--accent-strong)] hover:underline"
              >
                {result.reworkBatchNumber}
              </Link>
              , ready to re-enter crushing.
            </p>
          )}
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              className="dgn-btn dgn-btn-primary"
              onClick={() => navigate(`/batches/${batch.batchNumber}`)}
            >
              Open Batch 360°
            </button>
            <button type="button" className="dgn-btn dgn-btn-secondary" onClick={onBack}>
              Back to queue
            </button>
          </div>
        </Card>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={`Inspect Batch: ${batch.batchNumber}`}
      description={`${batch.productName || batch.materialName || batch.batchType} · ${fmt(batch.qtyRemaining)} ${batch.uom} awaiting inspection`}
      back={true}
      backLabel="Back to queue"
      onBack={onBack}
    >
      <div className="space-y-4">
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Decision</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(Object.keys(DECISION_COPY) as Decision[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDecision(key)}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  decision === key
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] bg-white hover:bg-zinc-50'
                }`}
              >
                <p className="font-semibold tracking-tight">{DECISION_COPY[key].label}</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">{DECISION_COPY[key].help}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Measurements</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={`Sample size (${batch.uom})`}>
              <input
                inputMode="decimal"
                className="dgn-input"
                value={sampleSize}
                onChange={(e) => setSampleSize(e.target.value)}
              />
            </Field>
            {batch.checkType === 'PRODUCTION' ? (
              <>
                <Field
                  label="Weight per piece (kg)"
                  hint={
                    batch.targetWeightPerPiece
                      ? `Target ${batch.targetWeightPerPiece} kg`
                      : 'No product standard set'
                  }
                >
                  <input
                    inputMode="decimal"
                    className="dgn-input"
                    value={weightPerPiece}
                    onChange={(e) => setWeightPerPiece(e.target.value)}
                  />
                </Field>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={dimensionOk}
                      onChange={(e) => setDimensionOk(e.target.checked)}
                    />
                    Dimensions OK
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={colourOk}
                      onChange={(e) => setColourOk(e.target.checked)}
                    />
                    Colour OK
                  </label>
                </div>
              </>
            ) : (
              <>
                <Field label="Contamination %">
                  <input
                    inputMode="decimal"
                    className="dgn-input"
                    value={contaminationPercent}
                    onChange={(e) => setContaminationPercent(e.target.value)}
                  />
                </Field>
                <Field label="Moisture %">
                  <input
                    inputMode="decimal"
                    className="dgn-input"
                    value={moisturePercent}
                    onChange={(e) => setMoisturePercent(e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>

          {variance != null && (
            <div className="mt-4 max-w-xs">
              <StatPill
                label="Weight variance vs standard"
                value={`${variance}%`}
                tone={Math.abs(variance) > 10 ? 'danger' : 'success'}
              />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Defects found in the sample</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relevantDefects.map((defect) => (
              <Field
                key={defect.id}
                label={defect.name}
                hint={defect.severity.toLowerCase()}
              >
                <input
                  inputMode="numeric"
                  className="dgn-input"
                  placeholder="0"
                  value={defectCounts[defect.code] ?? ''}
                  onChange={(e) =>
                    setDefectCounts((prev) => ({ ...prev, [defect.code]: e.target.value }))
                  }
                />
              </Field>
            ))}
            {!relevantDefects.length && (
              <p className="text-sm text-[var(--ink-muted)]">
                No defect types configured for this check.
              </p>
            )}
          </div>
          {sample > 0 && (
            <div className="mt-4 max-w-xs">
              <StatPill
                label="Defect rate in sample"
                value={`${defectRate}%`}
                tone={defectRate > 10 ? 'danger' : 'success'}
              />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Disposition</h2>
          {decision === 'HOLD' ? (
            <p className="mt-3 text-sm text-[var(--ink-muted)]">
              Nothing is split while a batch is on hold. All {fmt(batch.qtyRemaining)}{' '}
              {batch.uom} stay frozen in place until you pass or fail it later.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label={`Waste (${batch.uom})`}>
                  <input
                    inputMode="decimal"
                    className="dgn-input"
                    value={qtyRejected}
                    onChange={(e) => setQtyRejected(e.target.value)}
                  />
                </Field>
                <Field
                  label={`Send to rework (${batch.uom})`}
                  hint="Becomes a regrind batch that re-enters crushing"
                >
                  <input
                    inputMode="decimal"
                    className="dgn-input"
                    value={qtyRework}
                    onChange={(e) => setQtyRework(e.target.value)}
                  />
                </Field>
                <Field label="Scrap cost ₦" hint="Optional, charged to this batch">
                  <input
                    inputMode="decimal"
                    className="dgn-input"
                    value={scrapCost}
                    onChange={(e) => setScrapCost(e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatPill
                  label="Accepted"
                  value={`${fmt(accepted)} ${batch.uom}`}
                  tone={accepted < 0 ? 'danger' : 'success'}
                />
                <StatPill label="Waste" value={`${fmt(rejected)} ${batch.uom}`} tone="danger" />
                <StatPill label="To rework" value={`${fmt(rework)} ${batch.uom}`} tone="accent" />
              </div>
              {accepted < 0 && (
                <p className="mt-3 text-sm text-red-600">
                  Waste plus rework is more than the {fmt(batch.qtyRemaining)} {batch.uom} on hand.
                </p>
              )}
            </>
          )}
        </Card>

        <Card>
          <Field label="What did you observe?" hint="Required, minimum 5 characters">
            <textarea
              className="dgn-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </Card>

        {error && <Card className="border-red-200 bg-red-50 text-red-700">{error}</Card>}

        {warning && (
          <Card className="border-amber-200 bg-amber-50 text-amber-950">
            <p className="text-sm">{warning}</p>
            <button
              type="button"
              className="dgn-btn dgn-btn-primary mt-3"
              disabled={saving}
              onClick={() => submit(true)}
            >
              Confirm and record anyway
            </button>
          </Card>
        )}

        <button
          type="button"
          className="dgn-btn dgn-btn-primary w-full sm:w-auto"
          disabled={saving || accepted < 0}
          onClick={() => submit(false)}
        >
          {saving ? 'Saving…' : `Record ${DECISION_COPY[decision].label.toLowerCase()} decision`}
        </button>
      </div>
      
    </PageLayout>
  )
}
