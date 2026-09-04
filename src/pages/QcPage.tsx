import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
import { hasPermission } from '@/lib/auth'
import { formatBusinessDate } from '@/lib/dates'
import { useAuthStore } from '@/stores/auth-store'

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
      return data.data as QueueBatch[]
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

  if (selected) {
    return <InspectionForm batch={selected} onBack={() => setSelected(null)} />
  }

  return (
    <div>
      <PageHeader
        eyebrow="Quality control"
        title="Inspection queue"
        description="Inspect finished production and dried recycled material. A decision here controls whether a batch can be used, sold, or must go back for rework."
        actions={
          <Link to="/qc/trends" className="dgn-btn dgn-btn-secondary">
            <ShieldCheck className="size-4" />
            Defect trends
          </Link>
        }
      />

      {!canInspect && (
        <Card className="mb-4 border-amber-200 bg-amber-50 text-amber-950">
          You can view inspections but not record them. Ask for the QC officer role to make
          decisions.
        </Card>
      )}

      <Card className="mb-4 !p-0 overflow-hidden">
        <h2 className="px-4 pt-4 text-lg font-semibold tracking-tight sm:px-6 sm:pt-6">
          Awaiting inspection
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Type</th>
                <th className="px-3 py-3 font-semibold">Item</th>
                <th className="px-3 py-3 font-semibold text-right">Qty</th>
                <th className="px-3 py-3 font-semibold">Location / machine</th>
                <th className="px-3 py-3 font-semibold text-right">Inspections</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {queue.data?.map((batch) => (
                <tr
                  key={batch.id}
                  className="border-b border-[var(--line)] hover:bg-zinc-50/80"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/batches/${batch.batchNumber}`}
                      className="font-semibold text-[var(--accent-strong)] hover:underline"
                    >
                      {batch.batchNumber}
                    </Link>
                    {batch.status === 'QC_HOLD' && (
                      <p className="mt-0.5 text-xs font-semibold text-[var(--accent-strong)]">
                        On hold
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[var(--ink-muted)] tabular-nums">
                    {formatBusinessDate(batch.businessDate)}
                  </td>
                  <td className="px-3 py-3">{batch.batchType}</td>
                  <td className="px-3 py-3">
                    {batch.productName || batch.materialName || '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">
                    {fmt(batch.qtyRemaining)} {batch.uom}
                  </td>
                  <td className="px-3 py-3">
                    {batch.locationName || batch.machineName || '—'}
                    {batch.locationName && batch.machineName && (
                      <p className="text-xs text-[var(--ink-faint)]">{batch.machineName}</p>
                    )}
                    {batch.shiftName && (
                      <p className="text-xs text-[var(--ink-faint)]">{batch.shiftName}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{batch.checkCount}</td>
                  <td className="px-4 py-3 text-right">
                    {canInspect ? (
                      <button
                        type="button"
                        className="dgn-btn dgn-btn-primary"
                        onClick={() => setSelected(batch)}
                      >
                        Inspect
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
              {!queue.isLoading && !queue.data?.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    Nothing waiting. Finished production and drying batches appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Recent inspections</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--ink-muted)]">
                <th className="py-3 pr-4 font-semibold">Batch</th>
                <th className="py-3 pr-4 font-semibold">Date</th>
                <th className="py-3 pr-4 font-semibold">Decision</th>
                <th className="py-3 pr-4 font-semibold">Accepted</th>
                <th className="py-3 pr-4 font-semibold">Waste</th>
                <th className="py-3 pr-4 font-semibold">Rework</th>
                <th className="py-3 pr-4 font-semibold">Defect rate</th>
                <th className="py-3 font-semibold">Inspector</th>
              </tr>
            </thead>
            <tbody>
              {checks.data?.map((check) => (
                <tr key={check.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-4">
                    {check.batchNumber ? (
                      <Link
                        to={`/batches/${check.batchNumber}`}
                        className="font-semibold text-[var(--accent-strong)] hover:underline"
                      >
                        {check.batchNumber}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 pr-4 text-[var(--ink-muted)] tabular-nums">
                    {formatBusinessDate(check.businessDate)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        check.decision === 'PASS'
                          ? 'font-semibold text-teal-700'
                          : check.decision === 'FAIL'
                            ? 'font-semibold text-red-600'
                            : 'font-semibold text-[var(--accent-strong)]'
                      }
                    >
                      {check.decision}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{fmt(check.qtyAccepted)}</td>
                  <td className="py-3 pr-4">{fmt(check.qtyRejected)}</td>
                  <td className="py-3 pr-4">
                    {fmt(check.qtyRework)}
                    {check.reworkBatchNumber && (
                      <Link
                        to={`/batches/${check.reworkBatchNumber}`}
                        className="ml-2 text-xs text-[var(--accent-strong)] hover:underline"
                      >
                        {check.reworkBatchNumber}
                      </Link>
                    )}
                  </td>
                  <td className="py-3 pr-4">{check.defectRatePercent}%</td>
                  <td className="py-3">{check.inspectorName || '—'}</td>
                </tr>
              ))}
              {!checks.isLoading && !checks.data?.length && (
                <tr>
                  <td colSpan={8} className="py-6 text-[var(--ink-muted)]">
                    No inspections recorded yet.
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
      <Card className="text-center">
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
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow={`Inspecting ${batch.checkType === 'PRODUCTION' ? 'finished product' : 'recycled material'}`}
        title={batch.batchNumber}
        description={`${batch.productName || batch.materialName || batch.batchType} · ${fmt(batch.qtyRemaining)} ${batch.uom} on hand${batch.machineName ? ` · ${batch.machineName}` : ''}`}
        actions={
          <button type="button" className="dgn-btn dgn-btn-secondary" onClick={onBack}>
            Back to queue
          </button>
        }
      />

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
    </div>
  )
}
