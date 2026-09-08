import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { SORT_COLORS } from '@/lib/sortColors'
import { formatBusinessDate, formatDateTime } from '@/lib/dates'
import { ChevronDown, ChevronUp } from 'lucide-react'

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `₦${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function kg(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `${Number(n).toLocaleString()} kg`
}

function formatMinutes(mins: number | null | undefined) {
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return '0 min'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h > 0 && m > 0) return `${h}h ${m}m (${mins} mins)`
  if (h > 0) return `${h}h (${mins} mins)`
  return `${mins} mins`
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
  BUY: 'Scrap buying',
  SORTING: 'Sorting',
  CRUSHING: 'Crushing',
  WASHING: 'Washing',
  DRYING: 'Drying',
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
    materialName?: string | null
    locationName?: string | null
    locationCode?: string | null
    qtyConsumed: number
    parentQtyIn: number
    allocationRatio: number
    allocatedAmount: number
    unitPrice?: number | null
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
  const navigate = useNavigate()
  const [stockAuditOpen, setStockAuditOpen] = useState(true)

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
          product?: {
            id?: number
            name: string
            code?: string
            unitsPerDozen?: number
            uom?: string
          }
          machine?: {
            id?: number
            name: string
            code?: string
          }
          shift?: {
            id?: number
            name: string
          }
          startedAt?: string
          endedAt?: string
          businessDate?: string | null
          createdAt?: string
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
            id: number
            status?: string
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
            materialVariance?: number
            operatorName?: string
            runtimeMinutes: number
            downtimeMinutes: number
            downtimeReason?: string
            scheduledMinutes?: number
            labourCost?: number
            energyCost?: number
            otherCost?: number
            startedAt?: string
            endedAt?: string
            notes?: string
            machine?: { id?: number; name: string; code?: string; ratedOutputPerHour?: number }
            product?: {
              id?: number
              name: string
              code?: string
              uom?: string
              unitsPerDozen?: number
              standardMaterialPerUnit?: number
            }
            shift?: { id?: number; name: string; startTime?: string; endTime?: string }
            inputBatch?: {
              id?: number
              batchNumber: string
              batchType?: string
              uom?: string
              qtyRemaining?: number
              material?: { name: string }
              location?: { name: string; code?: string }
            }
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
            location?: { name: string; code?: string }
            createdAt?: string
          }>
          inputs?: Array<{
            id: number
            qtyConsumed: number
            fromBatch?: {
              batchNumber: string
              batchType: string
              material?: { name: string }
              location?: { name: string; code?: string }
            }
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
          costPerUnit: number | null
          costPerDozen: number | null
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
  const sortingRun = processRuns.find((r) => r.stage === 'SORTING')

  // Merge any SORTING stage into Scrap Buying ('BUY') stage, as sorting is part of scrap buying
  const displayStageRows = (() => {
    const sortingRow = stageRows.find((r) => r.stage === 'SORTING')
    const buyRow = stageRows.find((r) => r.stage === 'BUY')

    if (!sortingRow) {
      return stageRows.map((row) =>
        row.stage === 'BUY' && row.label === 'Buy scrap'
          ? { ...row, label: 'Scrap buying' }
          : row
      )
    }

    if (buyRow) {
      return stageRows
        .filter((r) => r.stage !== 'SORTING')
        .map((row) => {
          if (row.stage === 'BUY') {
            const mergedLines = [...row.lines]
            if (sortingRow.amount > 0) {
              const sortingIdx = mergedLines.findIndex((l) =>
                l.label.toLowerCase().includes('sorting')
              )
              if (sortingIdx >= 0) {
                mergedLines[sortingIdx] = {
                  ...mergedLines[sortingIdx],
                  amount: +(mergedLines[sortingIdx].amount + sortingRow.amount).toFixed(2),
                }
              } else {
                mergedLines.push({ label: 'Sorting', amount: sortingRow.amount })
              }
            }
            const mergedAmount = +(row.amount + (sortingRow.amount || 0)).toFixed(2)
            const mergedReject = +((row.qtyReject || 0) + (sortingRow.qtyReject || 0)).toFixed(2)
            return {
              ...row,
              label: 'Scrap buying',
              amount: mergedAmount,
              qtyReject: mergedReject,
              perKg: row.qtyKg > 0 ? +(mergedAmount / row.qtyKg).toFixed(2) : null,
              lines: mergedLines,
            }
          }
          return row
        })
    }

    // If sortingRow exists but no BUY row, transform sortingRow into Scrap buying
    return stageRows.map((row) => {
      if (row.stage === 'SORTING') {
        return {
          ...row,
          stage: 'BUY',
          label: 'Scrap buying',
        }
      }
      return row
    })
  })()

  const displayProcessRuns = processRuns.filter((r) => r.stage !== 'SORTING')

  const isProd = batch.batchType === 'PROD' || Boolean(productionRun)


  const prodGoodUnits = Number(productionRun?.qtyGood || batch.qtyOut || 0)
  const prodRejectUnits = Number(productionRun?.qtyReject || batch.qtyReject || 0)
  const prodTotalUnits = Number(productionRun?.qtyProduced || (prodGoodUnits + prodRejectUnits) || 0)
  const prodTotalCost = Number(summary.totalCost || 0)
  const prodUnitsPerDozen = Number(productionRun?.product?.unitsPerDozen || batch.product?.unitsPerDozen || 12)
  const prodCostPerPiece = summary.costPerUnit != null ? Number(summary.costPerUnit) : (prodGoodUnits > 0 ? prodTotalCost / prodGoodUnits : 0)
  const prodCostPerDozen = summary.costPerDozen != null ? Number(summary.costPerDozen) : (prodCostPerPiece * prodUnitsPerDozen)

  // Material In allocation & location info
  const firstAlloc = costSummary?.lineageAllocations?.[0]
  const inputBatchNumber = firstAlloc?.fromBatchNumber || productionRun?.inputBatch?.batchNumber || batch.inputs?.[0]?.fromBatch?.batchNumber || ''
  const inputMaterialName = firstAlloc?.materialName || productionRun?.inputBatch?.material?.name || batch.inputs?.[0]?.fromBatch?.material?.name || batch.material?.name || 'Raw Material'
  const inputLocationName = firstAlloc?.locationName || productionRun?.inputBatch?.location?.name || batch.inputs?.[0]?.fromBatch?.location?.name || 'Raw Material Store'
  const inputLocationCode = firstAlloc?.locationCode || productionRun?.inputBatch?.location?.code || ''
  const materialConsumed = Number(firstAlloc?.qtyConsumed || productionRun?.materialConsumed || batch.qtyIn || 0)
  const materialCost = Number(firstAlloc?.allocatedAmount || summary.inheritedCost || 0)
  const inputMaterialUnitPrice = firstAlloc?.unitPrice != null
    ? Number(firstAlloc.unitPrice)
    : (materialConsumed > 0 && materialCost > 0 ? materialCost / materialConsumed : 0)

  // Direct and overhead costs
  const labourCost = Number(productionRun?.labourCost || costSummary?.directByClass?.['LABOUR'] || 0)
  const energyCost = Number(productionRun?.energyCost || costSummary?.directByClass?.['UTILITIES'] || 0)
  const overheadCost = Number(costSummary?.accumulatedByClass?.['OVERHEAD'] || 0)
  const otherCost = Number(productionRun?.otherCost || costSummary?.directByClass?.['OTHER'] || 0)

  // OEE & execution metrics
  const oeePercent = Number(productionRun?.oeePercent || summary.oeePercent || 0)
  const qualityPercent = Number(productionRun?.qualityPercent || summary.yieldPercent || (prodTotalUnits > 0 ? +((prodGoodUnits / prodTotalUnits) * 100).toFixed(1) : 0))
  const rejectPercent = Number(productionRun?.rejectPercent || summary.rejectPercent || (prodTotalUnits > 0 ? +((prodRejectUnits / prodTotalUnits) * 100).toFixed(1) : 0))
  const runtimeMinutes = Number(productionRun?.runtimeMinutes || 0)
  const downtimeMinutes = Number(productionRun?.downtimeMinutes || 0)
  const downtimeReason = productionRun?.downtimeReason || ''
  const outputPerHour = Number(productionRun?.outputPerHour || 0)
  const isNotCompleted = isProd && (batch.status === 'IN_PROGRESS' || productionRun?.status === 'IN_PROGRESS' || !productionRun?.endedAt)

  return (
    <PageLayout
      title={<span className="font-mono">{batch.batchNumber}</span>}
      description={`${typeLabel} · Created ${formatBusinessDate(batch.businessDate) || formatDateTime(batch.createdAt)}`}
      back={true}
      backLabel="Back"
      onBack={() => navigate(-1)}
      actions={
        isNotCompleted && productionRun ? (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            asChild
          >
            <Link to={`/production/${productionRun.id}/complete`}>
              Complete Run →
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="space-y-3">

      {isNotCompleted && (
        <Card className="!p-3.5 border-l-4 !border-l-amber-500">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">Production in progress · Not completed</p>
              <p className="text-xs text-[var(--ink-muted)]">
                Material has been issued ({materialConsumed} kg). Enter good units, rejects, and runtime when finished.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="!p-4">
        <h2 className="text-base font-semibold">Batch overview</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {isProd ? (
            <>
              <Fact
                label="Good produced"
                value={isNotCompleted && prodGoodUnits === 0 ? 'Pending completion' : `${prodGoodUnits} ${batch.uom || 'pcs'}`}
                strong
              />
              <Fact
                label="Cost / pc"
                value={prodCostPerPiece > 0 ? `${money(prodCostPerPiece)}/pc` : (isNotCompleted ? 'Pending…' : '—')}
                strong
              />
              <Fact
                label="Cost / dozen"
                value={prodCostPerDozen > 0 ? `${money(prodCostPerDozen)}/dz` : (isNotCompleted ? 'Pending…' : '—')}
              />
              <Fact label="Total cost" value={money(summary.totalCost)} strong />
            </>
          ) : (
            <>
              <Fact label="Qty in" value={kg(batch.qtyIn)} strong />
              <Fact label="Available" value={`${batch.qtyRemaining} ${batch.uom}`} strong />
              <Fact label="Total cost" value={money(summary.totalCost)} />
              <Fact label="Cost / kg" value={costPerKg != null ? `${money(costPerKg)}/kg` : '—'} />
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {batch.sortColor && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
              {colorLabel(batch.sortColor)}
            </span>
          )}
          {batch.location?.name && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
              {batch.location.name}
            </span>
          )}
          {batch.product?.name && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
              {batch.product.name}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
            {typeLabel}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            isNotCompleted
              ? 'bg-amber-100 text-amber-700'
              : batch.status === 'CLOSED'
              ? 'bg-zinc-200 text-zinc-600'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isNotCompleted ? 'In progress' : batch.status}
          </span>
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

      {/* Material In for Production */}
      {isProd && (
        <Card className="!p-4">
          <h2 className="text-base font-semibold">Material in</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <Fact label="Input batch" value={inputBatchNumber || '—'} />
              {inputBatchNumber && (
                <Link
                  to={`/batches/${inputBatchNumber}`}
                  className="mt-1 inline-block text-xs font-medium text-[var(--accent-strong)] hover:underline"
                >
                  View input batch →
                </Link>
              )}
            </div>
            <Fact label="Material" value={inputMaterialName} />
            <Fact label="From location" value={`${inputLocationName}${inputLocationCode ? ` (${inputLocationCode})` : ''}`} />
            <Fact label="Material used" value={kg(materialConsumed)} strong />
            <Fact label="Price / kg at location" value={inputMaterialUnitPrice > 0 ? `${money(inputMaterialUnitPrice)}/kg` : '—'} strong />
            <Fact label="Total material cost" value={money(materialCost)} strong />
          </div>
        </Card>
      )}

      {/* Production Run Details */}
      {productionRun && (
        <Card className="!p-4">
          <h2 className="text-base font-semibold">Production run</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Machine" value={productionRun.machine?.name || '—'} />
            <Fact label="Product" value={productionRun.product?.name || batch.product?.name || '—'} />
            <Fact label="Operator" value={productionRun.operatorName || '—'} />
            <Fact label="Shift" value={productionRun.shift?.name || batch.shift?.name || '—'} />
            <Fact label="Produced (gross)" value={`${prodTotalUnits} ${batch.uom || 'pcs'}`} />
            <Fact label="Good units" value={`${prodGoodUnits} ${batch.uom || 'pcs'}`} strong />
            <Fact label="Yield" value={`${qualityPercent}%`} />
            <Fact label="Rejects" value={`${prodRejectUnits} ${batch.uom || 'pcs'}`} />
            <Fact label="Reject %" value={`${rejectPercent}%`} />
            <Fact label="Runtime" value={formatMinutes(runtimeMinutes)} />
            <Fact label="Downtime" value={downtimeMinutes > 0 ? `${formatMinutes(downtimeMinutes)}${downtimeReason ? ` (${downtimeReason})` : ''}` : '0 min'} />
            <Fact label="Output / hr" value={`${outputPerHour} ${batch.uom || 'pcs'}/hr`} />
            <Fact label="OEE" value={`${oeePercent}%`} strong />
          </div>
        </Card>
      )}

      {/* Production Cost Breakdown */}
      {isProd && (
        <Card className="!p-4">
          <h2 className="text-base font-semibold">Production cost breakdown</h2>
          <ul className="mt-3 divide-y divide-[var(--line)]">
            <li className="flex justify-between gap-3 py-2 text-sm">
              <div>
                <span className="font-medium">Material in</span>
                <p className="text-xs text-[var(--ink-muted)]">
                  {materialConsumed} kg @ {inputMaterialUnitPrice > 0 ? `${money(inputMaterialUnitPrice)}/kg` : '—'} from {inputLocationName}
                </p>
              </div>
              <div className="text-right">
                <span className="font-semibold tabular-nums">{money(materialCost)}</span>
                <p className="text-xs text-[var(--ink-muted)]">
                  {prodGoodUnits > 0 ? `${money(materialCost / prodGoodUnits)}/pc` : '—'}
                </p>
              </div>
            </li>

            <li className="flex justify-between gap-3 py-2 text-sm">
              <div>
                <span className="font-medium">Direct labour</span>
                <p className="text-xs text-[var(--ink-muted)]">
                  Formula: Rate × 10 × {materialConsumed} kg
                </p>
              </div>
              <div className="text-right">
                <span className="font-semibold tabular-nums">{money(labourCost)}</span>
                <p className="text-xs text-[var(--ink-muted)]">
                  {prodGoodUnits > 0 ? `${money(labourCost / prodGoodUnits)}/pc` : '—'}
                </p>
              </div>
            </li>

            {energyCost > 0 && (
              <li className="flex justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium">Energy & utilities</span>
                  <p className="text-xs text-[var(--ink-muted)]">Machine operation</p>
                </div>
                <div className="text-right">
                  <span className="font-semibold tabular-nums">{money(energyCost)}</span>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {prodGoodUnits > 0 ? `${money(energyCost / prodGoodUnits)}/pc` : '—'}
                  </p>
                </div>
              </li>
            )}

            {overheadCost > 0 && (
              <li className="flex justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium">Factory overhead</span>
                  <p className="text-xs text-[var(--ink-muted)]">Allocated overhead</p>
                </div>
                <div className="text-right">
                  <span className="font-semibold tabular-nums">{money(overheadCost)}</span>
                  <p className="text-xs text-[var(--ink-muted)]">
                    {prodGoodUnits > 0 ? `${money(overheadCost / prodGoodUnits)}/pc` : '—'}
                  </p>
                </div>
              </li>
            )}

            {otherCost > 0 && (
              <li className="flex justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium">Other direct costs</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold tabular-nums">{money(otherCost)}</span>
                </div>
              </li>
            )}

            <li className="flex justify-between gap-3 py-2.5 text-sm font-bold border-t border-[var(--line)]">
              <div>
                <span>Total production cost</span>
                <p className="text-xs font-normal text-[var(--ink-muted)]">
                  {prodGoodUnits} good {batch.uom || 'pcs'} produced
                </p>
              </div>
              <div className="text-right">
                <span className="tabular-nums text-base">{money(prodTotalCost)}</span>
                <p className="text-xs font-semibold text-[var(--ink-muted)]">
                  {money(prodCostPerPiece)}/pc · {money(prodCostPerDozen)}/dz
                </p>
              </div>
            </li>
          </ul>
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

      {!isProd && (displayProcessRuns.length > 0 || displayStageRows.length > 0) && (
        <Card className="!p-4">
          <h2 className="text-base font-semibold">Process stages</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Fact
              label="Expenses total"
              value={money(displayStageRows.reduce((sum, row) => sum + Number(row.amount || 0), 0))}
              strong
            />
            <Fact
              label="Total waste"
              value={kg(
                displayStageRows.reduce((sum, row) => sum + Number(row.qtyReject || 0), 0) ||
                  displayProcessRuns.reduce((sum, run) => sum + Number(run.qtyReject || 0), 0),
              )}
              strong
            />
          </div>
          <div className="mt-3 space-y-3">
            {displayStageRows.length > 0
              ? displayStageRows.map((row) => {
                  const run =
                    row.stage === 'BUY'
                      ? (processRuns.find((r) => r.stage === 'BUY') || sortingRun)
                      : processRuns.find((r) => r.stage === row.stage)
                  return <StageBlock key={row.key} run={run} cost={row} />
                })
              : displayProcessRuns.map((run) => {
                  const lines = [
                    Number(run.labourCost || 0) > 0 ? { label: 'Labour', amount: Number(run.labourCost) } : null,
                    (run.stage !== 'WASHING' && Number(run.energyCost || 0) > 0) ? { label: 'Energy', amount: Number(run.energyCost) } : null,
                    Number(run.chemicalCost || 0) > 0 ? { label: 'Chemical', amount: Number(run.chemicalCost) } : null,
                    Number(run.detergentCost || 0) > 0 ? { label: 'Detergent', amount: Number(run.detergentCost) } : null,
                    Number(run.waterQty || 0) > 0 ? { label: 'Water', amount: Number(run.waterQty) } : null,
                  ].filter(Boolean) as Array<{ label: string; amount: number }>
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
                        lines,
                        extras: [],
                      }}
                    />
                  )
                })}
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


      {/* Combined Stock & Audit — collapsible */}
      {((batch.inventoryTransactions || []).length > 0 || detail.data.auditLogs.length > 0) && (
        <Card className="!overflow-hidden !p-0">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
            onClick={() => setStockAuditOpen((o) => !o)}
          >
            <div>
              <h2 className="text-base font-semibold">Stock &amp; Audit</h2>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                {(batch.inventoryTransactions || []).length} stock move{(batch.inventoryTransactions || []).length !== 1 ? 's' : ''}
                {' · '}
                {detail.data.auditLogs.length} audit event{detail.data.auditLogs.length !== 1 ? 's' : ''}
              </p>
            </div>
            {stockAuditOpen
              ? <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />}
          </button>

          {stockAuditOpen && (
            <div className="border-t border-[var(--line)]">

              {/* Stock moves */}
              {(batch.inventoryTransactions || []).length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Stock moves</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                          <th className="px-4 py-2.5 font-semibold">Date</th>
                          <th className="px-3 py-2.5 font-semibold">Direction</th>
                          <th className="px-3 py-2.5 font-semibold">Reason</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(batch.inventoryTransactions || []).map((tx) => (
                          <tr key={tx.id} className="border-b border-[var(--line)]">
                            <td className="px-4 py-2.5 tabular-nums text-[var(--ink-muted)]">
                              {tx.businessDate ? formatBusinessDate(tx.businessDate) : formatDateTime(tx.createdAt)}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                tx.direction === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {tx.direction}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-[var(--ink-muted)]">{tx.reason}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium">{tx.qty} {tx.uom}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Audit log */}
              {detail.data.auditLogs.length > 0 && (
                <div className={`${ (batch.inventoryTransactions || []).length > 0 ? 'border-t border-[var(--line)]' : '' }`}>
                  <p className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-widest text-zinc-400">Audit log</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                          <th className="px-4 py-2.5 font-semibold">Date &amp; time</th>
                          <th className="px-4 py-2.5 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.data.auditLogs.map((log) => (
                          <tr key={log.id} className="border-b border-[var(--line)]">
                            <td className="px-4 py-2.5 tabular-nums text-[var(--ink-muted)] whitespace-nowrap">
                              {formatDateTime(log.createdAt)}
                            </td>
                            <td className="px-4 py-2.5 text-sm">{log.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
        </Card>
      )}
      </div>
    </PageLayout>
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
  const buyPriceExtra = cost.extras?.find((e) => e.label === 'Buy price')

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
          {cost.lines.map((row) => {
            const isScrapBuy =
              row.label === 'Scrap buy' || row.label.toLowerCase().includes('scrap buy')
            const buyPriceText = buyPriceExtra
              ? buyPriceExtra.text.startsWith('@')
                ? buyPriceExtra.text
                : `@ ${buyPriceExtra.text}`
              : cost.perKg
              ? `@ ${money(cost.perKg)}/kg`
              : null

            return (
              <li key={row.label} className="flex justify-between py-1.5 text-sm items-start">
                <div>
                  <span className="text-[var(--ink-muted)] font-medium">{row.label}</span>
                  {isScrapBuy && buyPriceText && (
                    <p className="text-xs text-[var(--ink-faint)] font-normal mt-0.5">
                      Buy price: {buyPriceText}
                    </p>
                  )}
                </div>
                <span className="font-medium tabular-nums">{money(row.amount)}</span>
              </li>
            )
          })}
        </ul>
      )}
      {cost.extras.filter((ex) => ex.label !== 'Buy price').map((ex) => (
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
