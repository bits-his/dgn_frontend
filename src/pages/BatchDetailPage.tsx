import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, PageHeader } from '@/components/ui'
import { SORT_COLORS } from '@/lib/sortColors'
import { formatBusinessDate, formatDateTime } from '@/lib/dates'

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `₦${Number(n).toLocaleString()}`
}

function kg(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `${Number(n).toLocaleString()} kg`
}

function parseColorBreakdown(raw?: string | null) {
  if (!raw) return [] as Array<{ color: string; qtyKg: number; batchNumber?: string }>
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function colorLabel(code: string) {
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

const TYPE_LABEL: Record<string, string> = {
  SCRAP: 'Scrap',
  SORT: 'Sorted',
  CRUSH: 'Crushed',
  WASH: 'Washed',
  DRY: 'Dried',
  PROD: 'Finished goods',
  RECYCLE: 'Recycle',
  LOT: 'In process',
}

const STAGE_LABEL: Record<string, string> = {
  SORTING: 'Sorting',
  CRUSHING: 'Crushing',
  WASHING: 'Washing',
  DRYING: 'Drying',
}

const COST_CLASS_LABEL: Record<string, string> = {
  PURCHASE: 'Buy scrap',
  LOGISTICS: 'Transport / load',
  LABOUR: 'Labour',
  PROCESSING: 'Chemical / process',
  UTILITIES: 'Energy / utilities',
  MAINTENANCE: 'Maintenance',
  OVERHEAD: 'Factory overhead',
  OTHER: 'Other',
}

type CostSummary = {
  directTotal: number
  inheritedTotal: number
  accumulatedTotal: number
  directByClass: Record<string, number>
  inheritedByClass: Record<string, number>
  accumulatedByClass: Record<string, number>
  costPerKg: number | null
  trueRecycledCostPerKg: number | null
  remainingCostValue: number | null
  lineageAllocations: Array<{
    fromBatchNumber: string
    fromBatchType: string
    qtyConsumed: number
    parentQtyIn: number
    allocationRatio: number
    allocatedAmount: number
  }>
  costScope: string
  overheadIncluded: boolean
  stageBreakdown?: Array<{
    key: string
    stage: string
    label: string
    qtyKg: number
    qtyReject?: number
    amount: number
    perKg: number | null
    runningTotal: number
    runningPerKg: number | null
    lines: Array<{ label: string; amount: number }>
    extras: Array<{ label: string; text: string }>
  }>
}

type ProcessRunRow = {
  id: number
  stage: string
  yieldPercent: number
  rejectPercent: number
  qtyInput: number
  qtyUsable: number
  qtyReject: number
  qtyWaste: number
  colorBreakdown?: string | null
  machineName?: string | null
  operatorName?: string | null
  teamName?: string | null
  labourCost?: number | null
  energyCost?: number | null
  waterQty?: number | null
  chemicalCost?: number | null
  detergentCost?: number | null
  moistureReading?: number | null
  downtimeMinutes?: number | null
  downtimeReason?: string | null
  notes?: string | null
}

export function BatchDetailPage() {
  const { batchNumber = '' } = useParams()

  const detail = useQuery({
    queryKey: ['batch', batchNumber],
    queryFn: async () => {
      const { data } = await api.get(`/batches/${batchNumber}`)
      return data as {
        data: {
          batchNumber: string
          batchType: string
          status: string
          qtyIn: number
          qtyOut: number
          qtyRemaining: number
          qtyReject: number
          qtyWaste: number
          uom: string
          sortColor?: string | null
          notes?: string | null
          material?: { name: string }
          location?: { name: string }
          createdBy?: { firstname: string; lastname: string }
          scrapReceipt?: {
            netWeight: number
            pricePerKg: number
            purchaseCost: number
            transportCost: number
            loadingCost: number
            unloadingCost: number
            otherCost?: number
            inboundForm?: string
            supplier?: { name: string }
          }
          processRuns?: ProcessRunRow[]
          productionRun?: {
            qtyProduced: number
            qtyGood: number
            qtyReject: number
            rejectPercent: number
            qualityPercent: number
            availabilityPercent: number
            performancePercent: number
            oeePercent: number
            outputPerHour: number
            materialPerUnit: number
            materialConsumed: number
            operatorName?: string
            downtimeMinutes: number
            downtimeReason?: string
            machine?: { name: string }
            product?: { name: string }
            inputBatch?: { batchNumber: string }
          }
          qcChecks?: Array<{
            id: number
            checkType: string
            decision: string
            sampleSize: number
            qtyAccepted: number
            qtyRejected: number
            qtyRework: number
            uom: string
            defectCount: number
            defectRatePercent: number
            criticalDefectCount: number
            weightPerPiece: number | null
            weightVariancePercent: number | null
            contaminationPercent: number | null
            moisturePercent: number | null
            inspectorName: string | null
            businessDate: string | null
            notes: string | null
            reworkBatch?: { batchNumber: string } | null
            defects?: Array<{ defectCode: string; severity: string; count: number }>
          }>
          costEntries?: Array<{
            id: number
            description: string
            costClass: string
            amount: number
            businessDate?: string | null
            createdAt?: string
          }>
          inventoryTransactions?: Array<{
            id: number
            direction: string
            reason: string
            qty: number
            uom: string
            businessDate?: string | null
            createdAt?: string
          }>
          inputs?: Array<{
            id: number
            qtyConsumed: number
            fromBatch?: { batchNumber: string; batchType: string }
          }>
          outputs?: Array<{
            id: number
            qtyConsumed: number
            toBatch?: { batchNumber: string; batchType: string }
          }>
        }
        summary: {
          directCost: number
          totalCost: number
          inheritedCost: number
          costPerKg: number | null
          trueRecycledCostPerKg: number | null
          yieldPercent: number | null
          rejectPercent: number | null
          oeePercent: number | null
          qcDecision: string | null
          qcBlocked: boolean
        }
        costSummary: CostSummary | null
        auditLogs: Array<{ id: number; action: string; createdAt: string }>
      }
    },
    enabled: Boolean(batchNumber),
  })

  if (detail.isLoading) return <p className="text-sm text-[var(--ink-muted)]">Loading…</p>

  if (detail.isError || !detail.data) {
    return (
      <Card className="!p-4">
        <p className="text-red-600">Batch not found.</p>
        <Link to="/batches" className="mt-2 inline-block text-sm font-medium text-[var(--accent-strong)]">
          Back
        </Link>
      </Card>
    )
  }

  const batch = detail.data.data
  const receipt = batch.scrapReceipt
  const processRuns = batch.processRuns || []
  const productionRun = batch.productionRun
  const summary = detail.data.summary
  const costSummary = detail.data.costSummary
  const isDry = batch.batchType === 'DRY' || batch.batchType === 'RECYCLE'
  const costPerKg = isDry ? summary.trueRecycledCostPerKg : summary.costPerKg
  const typeLabel = TYPE_LABEL[batch.batchType] || batch.batchType
  const stageRows = costSummary?.stageBreakdown || []

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="Batch"
        title={batch.batchNumber}
        description={[
          typeLabel,
          batch.sortColor ? colorLabel(batch.sortColor) : null,
          batch.material?.name || null,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      <Card className="!p-4">
        <h2 className="text-base font-semibold">Basic info</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact label="Qty in" value={kg(batch.qtyIn)} strong />
          <Fact label="Qty available" value={`${batch.qtyRemaining} ${batch.uom}`} strong />
          <Fact label="Total cost" value={money(summary.totalCost)} />
          <Fact label="Cost / kg" value={costPerKg != null ? `${money(costPerKg)}/kg` : '—'} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--ink-muted)]">
          {batch.sortColor && <span>Colour: {colorLabel(batch.sortColor)}</span>}
          {batch.location?.name && <span>Location: {batch.location.name}</span>}
          <span>Stage: {typeLabel}</span>
        </div>
      </Card>

      {summary.qcBlocked && (
        <Card className="!border-red-200 !bg-red-50 !p-4 text-red-800">
          <h2 className="text-base font-semibold">QC hold</h2>
          <p className="mt-1 text-sm">
            Status {batch.status}. Do not use, produce or sell until QC clears it.
          </p>
        </Card>
      )}

      {receipt && (
        <Card className="!p-4">
          <h2 className="text-base font-semibold">Buy / receiving</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Fact label="Supplier" value={receipt.supplier?.name || '—'} />
            <Fact
              label="Bought as"
              value={receipt.inboundForm === 'CRUSHED' ? 'Already crushed' : 'Raw scrap'}
            />
            <Fact label="Weight" value={kg(receipt.netWeight)} />
            <Fact label="Price / kg" value={money(receipt.pricePerKg)} />
          </div>
        </Card>
      )}

      {(batch.inputs?.length || batch.outputs?.length) ? (
        <Card className="!p-4">
          <h2 className="text-base font-semibold">Linked batches</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                Came from
              </p>
              <ul className="mt-1 space-y-1">
                {(batch.inputs || []).map((link) => (
                  <li key={link.id} className="text-sm">
                    <Link
                      className="font-medium text-[var(--accent-strong)] hover:underline"
                      to={`/batches/${link.fromBatch?.batchNumber}`}
                    >
                      {link.fromBatch?.batchNumber}
                    </Link>
                    <span className="text-[var(--ink-muted)]">
                      {' '}
                      · {TYPE_LABEL[link.fromBatch?.batchType || ''] || link.fromBatch?.batchType} · {link.qtyConsumed} kg
                    </span>
                  </li>
                ))}
                {!batch.inputs?.length && (
                  <li className="text-sm text-[var(--ink-muted)]">None</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                Went to
              </p>
              <ul className="mt-1 space-y-1">
                {(batch.outputs || []).map((link) => (
                  <li key={link.id} className="text-sm">
                    <Link
                      className="font-medium text-[var(--accent-strong)] hover:underline"
                      to={`/batches/${link.toBatch?.batchNumber}`}
                    >
                      {link.toBatch?.batchNumber}
                    </Link>
                    <span className="text-[var(--ink-muted)]">
                      {' '}
                      · {TYPE_LABEL[link.toBatch?.batchType || ''] || link.toBatch?.batchType} · {link.qtyConsumed} kg
                    </span>
                  </li>
                ))}
                {!batch.outputs?.length && (
                  <li className="text-sm text-[var(--ink-muted)]">None</li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      {(processRuns.length > 0 || stageRows.length > 0) && (
        <Card className="!p-4">
          <h2 className="text-base font-semibold">Process stages</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Fact
              label="Expenses total"
              value={money(stageRows.reduce((sum, row) => sum + Number(row.amount || 0), 0))}
              strong
            />
            <Fact
              label="Total waste"
              value={kg(
                stageRows.reduce((sum, row) => sum + Number(row.qtyReject || 0), 0) ||
                  processRuns.reduce((sum, run) => sum + Number(run.qtyReject || 0), 0),
              )}
              strong
            />
          </div>
          <div className="mt-3 space-y-3">
            {stageRows.length > 0
              ? stageRows.map((row) => {
                  const run = processRuns.find((r) => r.stage === row.stage)
                  return <StageBlock key={row.key} run={run} cost={row} />
                })
              : processRuns.map((run) => {
                  const naira =
                    Number(run.labourCost || 0) +
                    Number(run.chemicalCost || 0) +
                    Number(run.detergentCost || 0) +
                    (run.stage === 'WASHING' ? 0 : Number(run.energyCost || 0))
                  const qtyKg = Number(run.qtyUsable || run.qtyInput || 0)
                  return (
                    <StageBlock
                      key={run.id}
                      run={run}
                      cost={{
                        key: String(run.id),
                        stage: run.stage,
                        label: STAGE_LABEL[run.stage] || run.stage,
                        qtyKg,
                        qtyReject: Number(run.qtyReject || 0),
                        amount: naira,
                        perKg: qtyKg > 0 ? naira / qtyKg : null,
                        runningTotal: naira,
                        runningPerKg: qtyKg > 0 ? naira / qtyKg : null,
                        lines: [],
                        extras: [],
                      }}
                    />
                  )
                })}
          </div>
        </Card>
      )}

      {productionRun && (
        <Card className="!p-4">
          <h2 className="text-base font-semibold">Production</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Machine" value={productionRun.machine?.name || '—'} />
            <Fact label="Product" value={productionRun.product?.name || '—'} />
            <Fact label="Produced" value={String(productionRun.qtyProduced)} />
            <Fact label="Good" value={String(productionRun.qtyGood)} />
            <Fact label="Waste %" value={`${productionRun.rejectPercent}%`} />
            <Fact label="OEE" value={`${productionRun.oeePercent}%`} />
            <Fact label="Material used" value={kg(productionRun.materialConsumed)} />
            <Fact label="Operator" value={productionRun.operatorName || '—'} />
          </div>
        </Card>
      )}

      {batch.qcChecks && batch.qcChecks.length > 0 && (
        <Card className="!overflow-hidden !p-0">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="text-base font-semibold">Quality checks</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">Decision</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold text-right">Pass</th>
                  <th className="px-3 py-3 font-semibold text-right">Waste</th>
                  <th className="px-3 py-3 font-semibold text-right">Rework</th>
                  <th className="px-4 py-3 font-semibold">Inspector</th>
                </tr>
              </thead>
              <tbody>
                {batch.qcChecks.map((check) => (
                  <tr key={check.id} className="border-b border-[var(--line)]">
                    <td className="px-4 py-3 tabular-nums text-[var(--ink-muted)]">
                      {formatBusinessDate(check.businessDate)}
                    </td>
                    <td className="px-3 py-3 font-semibold">{check.decision}</td>
                    <td className="px-3 py-3 text-[var(--ink-muted)]">
                      {check.checkType === 'PRODUCTION' ? 'Product' : 'Material'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{check.qtyAccepted}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{check.qtyRejected}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {check.qtyRework}
                      {check.reworkBatch?.batchNumber ? (
                        <Link
                          to={`/batches/${check.reworkBatch.batchNumber}`}
                          className="ml-1 text-xs text-[var(--accent-strong)] hover:underline"
                        >
                          {check.reworkBatch.batchNumber}
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-muted)]">
                      {check.inspectorName || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ForwardTracePanel batchNumber={batchNumber} />

      <Card className="!overflow-hidden !p-0">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-base font-semibold">Each cost on this batch</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3 font-semibold">Class</th>
                <th className="px-4 py-3 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(batch.costEntries || []).map((c) => (
                <tr key={c.id} className="border-b border-[var(--line)]">
                  <td className="px-4 py-3 tabular-nums text-[var(--ink-muted)]">
                    {c.businessDate
                      ? formatBusinessDate(c.businessDate)
                      : formatDateTime(c.createdAt)}
                  </td>
                  <td className="px-3 py-3">{c.description}</td>
                  <td className="px-3 py-3 text-[var(--ink-muted)]">
                    {COST_CLASS_LABEL[c.costClass] || c.costClass}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {money(c.amount)}
                  </td>
                </tr>
              ))}
              {!batch.costEntries?.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[var(--ink-muted)]">
                    No cost lines yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {(batch.inventoryTransactions || []).length > 0 && (
        <Card className="!overflow-hidden !p-0">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="text-base font-semibold">Stock moves</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">Direction</th>
                  <th className="px-3 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {(batch.inventoryTransactions || []).map((tx) => (
                  <tr key={tx.id} className="border-b border-[var(--line)]">
                    <td className="px-4 py-3 tabular-nums text-[var(--ink-muted)]">
                      {tx.businessDate
                        ? formatBusinessDate(tx.businessDate)
                        : formatDateTime(tx.createdAt)}
                    </td>
                    <td className="px-3 py-3">{tx.direction}</td>
                    <td className="px-3 py-3 text-[var(--ink-muted)]">{tx.reason}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {tx.qty} {tx.uom}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {detail.data.auditLogs.length > 0 && (
        <Card className="!overflow-hidden !p-0">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="text-base font-semibold">Audit log</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {detail.data.auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--line)]">
                    <td className="px-4 py-3 tabular-nums text-[var(--ink-muted)]">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">{log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

type StageCostRow = {
  key: string
  stage: string
  label: string
  qtyKg: number
  qtyReject?: number
  amount: number
  perKg: number | null
  runningTotal: number
  runningPerKg: number | null
  lines: Array<{ label: string; amount: number }>
  extras: Array<{ label: string; text: string }>
}

function StageBlock({ run, cost }: { run?: ProcessRunRow; cost: StageCostRow }) {
  const colors = parseColorBreakdown(run?.colorBreakdown)
  const stageName = cost.label || STAGE_LABEL[run?.stage || ''] || run?.stage || cost.stage

  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{stageName}</h3>
        {run && (
          <span className="text-xs text-[var(--ink-muted)]">
            Yield {run.yieldPercent}% · Waste {run.rejectPercent}%
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Kg" value={kg(cost.qtyKg)} compact />
        <Fact label="Waste" value={kg(cost.qtyReject || run?.qtyReject || 0)} compact />
        <Fact label="Expenses" value={money(cost.amount)} compact />
        <Fact
          label="₦ / kg"
          value={cost.perKg != null ? `${money(cost.perKg)}/kg` : '—'}
          compact
        />
      </div>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        Total so far: {money(cost.runningTotal)}
        {cost.runningPerKg != null ? ` · ${money(cost.runningPerKg)}/kg` : ''}
      </p>

      {colors.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
            Colours
          </p>
          <ul className="mt-1 space-y-1">
            {colors.map((line) => (
              <li
                key={`${line.color}-${line.batchNumber || ''}`}
                className="flex flex-wrap justify-between gap-2 text-sm"
              >
                <span>
                  {colorLabel(line.color)} · {Number(line.qtyKg).toLocaleString()} kg
                </span>
                {line.batchNumber && (
                  <Link
                    to={`/batches/${line.batchNumber}`}
                    className="font-medium text-[var(--accent-strong)] hover:underline"
                  >
                    {line.batchNumber}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cost.lines.length > 0 && (
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {cost.lines.map((row) => (
            <li key={row.label} className="flex justify-between py-1 text-sm">
              <span className="text-[var(--ink-muted)]">{row.label}</span>
              <span className="font-medium tabular-nums">{money(row.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {cost.extras.map((ex) => (
        <p key={ex.label} className="mt-1 text-xs text-[var(--ink-muted)]">
          {ex.label}: {ex.text}
        </p>
      ))}

      {run && (run.operatorName || run.machineName || run.teamName) && (
        <p className="mt-2 text-xs text-[var(--ink-muted)]">
          {[
            run.operatorName && `Operator: ${run.operatorName}`,
            run.machineName && `Machine: ${run.machineName}`,
            run.teamName && `Team: ${run.teamName}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {run?.notes && <p className="mt-1 text-xs text-[var(--ink-muted)]">{run.notes}</p>}
    </div>
  )
}

type ForwardTrace = {
  batches: Array<{
    batchNumber: string
    batchType: string
    status: string
    itemName: string | null
    depth: number
  }>
  sales: Array<{
    saleNumber: string
    customerName: string | null
    batchNumber: string
    qty: number
    qtyReturned: number
    uom: string
    businessDate: string | null
    vehicleNumber: string | null
    driverName: string | null
    destination: string | null
  }>
  customers: string[]
  reachedCustomers: number
  descendantCount: number
}

function ForwardTracePanel({ batchNumber }: { batchNumber: string }) {
  const trace = useQuery({
    queryKey: ['forward-trace', batchNumber],
    queryFn: async () => {
      const { data } = await api.get(`/batches/${batchNumber}/forward-trace`)
      return data.data as ForwardTrace
    },
  })

  if (!trace.data) return null
  const t = trace.data
  if (t.descendantCount === 0 && t.sales.length === 0) return null

  return (
    <Card className="!p-4">
      <h2 className="text-base font-semibold">Where it went</h2>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        {t.descendantCount} next stage{t.descendantCount === 1 ? '' : 's'}
        {t.reachedCustomers > 0
          ? ` · sold to ${t.customers.join(', ')}`
          : ' · not sold yet'}
      </p>

      <div className="mt-2 space-y-0.5">
        {t.batches.map((node) => (
          <div
            key={node.batchNumber}
            className="flex flex-wrap items-center gap-1.5 text-sm"
            style={{ paddingLeft: `${node.depth * 12}px` }}
          >
            {node.depth > 0 && <span className="text-[var(--ink-faint)]">└</span>}
            <Link
              to={`/batches/${node.batchNumber}`}
              className="font-medium text-[var(--accent-strong)] hover:underline"
            >
              {node.batchNumber}
            </Link>
            <span className="text-xs text-[var(--ink-faint)]">
              {TYPE_LABEL[node.batchType] || node.batchType}
              {node.itemName ? ` · ${node.itemName}` : ''}
            </span>
          </div>
        ))}
      </div>

      {t.sales.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Sale</th>
                <th className="px-3 py-2 font-semibold">Customer</th>
                <th className="px-3 py-2 font-semibold text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {t.sales.map((sale) => (
                <tr
                  key={`${sale.saleNumber}-${sale.batchNumber}`}
                  className="border-b border-[var(--line)]"
                >
                  <td className="px-3 py-2 tabular-nums text-[var(--ink-muted)]">
                    {formatBusinessDate(sale.businessDate)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={`/sales/${sale.saleNumber}`}
                      className="font-medium text-[var(--accent-strong)] hover:underline"
                    >
                      {sale.saleNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{sale.customerName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {sale.qty} {sale.uom}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function Fact({
  label,
  value,
  strong,
  compact,
}: {
  label: string
  value: string
  strong?: boolean
  compact?: boolean
}) {
  return (
    <div className={compact ? '' : 'rounded-lg bg-zinc-50 px-2.5 py-2'}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
        {label}
      </p>
      <p className={`mt-0.5 text-sm ${strong ? 'font-semibold' : 'font-medium'} tabular-nums`}>
        {value}
      </p>
    </div>
  )
}
