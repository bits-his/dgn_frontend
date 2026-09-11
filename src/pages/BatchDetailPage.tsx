import { useState } from 'react'
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { SORT_COLORS } from '@/lib/sortColors'
import { formatBusinessDate, formatDateTime } from '@/lib/dates'
import { ChevronDown, ChevronUp, Wrench } from 'lucide-react'

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
  RECRUSHING: 'Re-crushing',
  RECYCLING: 'Recycling',
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
  loadingCost?: number | null
  transportCost?: number | null
  otherCost?: number | null
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
  const [stockAuditOpen, setStockAuditOpen] = useState(false)

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
          colorItems?: Array<{
            id: number
            batchId?: number
            color: string
            qtyCrushed: number
            qtyWashed?: number | null
            qtyWashWaste?: number | null
            qtyDried?: number | null
            qtyDryWaste?: number | null
            status?: string
          }>
          createdAt?: string
          createdBy?: { firstname: string; lastname: string }
          scrapReceipt?: {
            id?: number
            netWeight: number
            pricePerKg: number
            purchaseCost: number
            transportCost: number
            loadingCost: number
            unloadingCost: number
            scaleCost?: number
            netBagCost?: number
            sortingPricePerKg?: number
            sortingCost?: number
            otherCost?: number
            inboundForm?: string
            editable?: boolean
            lockReason?: string | null
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
          originScrapReceipt?: {
            id?: number
            netWeight: number
            pricePerKg: number
            purchaseCost: number
            transportCost: number
            loadingCost: number
            unloadingCost: number
            scaleCost?: number
            netBagCost?: number
            sortingPricePerKg?: number
            sortingCost?: number
            otherCost?: number
            inboundForm?: string
            editable?: boolean
            lockReason?: string | null
            supplier?: { name: string }
          }
          siblingBatches?: Array<{
            id: number
            batchNumber: string
            batchType: string
            status: string
            sortColor?: string | null
            qtyIn: number
            qtyRemaining: number
            uom: string
            locationName?: string | null
            materialName?: string | null
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
  const receipt = batch.scrapReceipt || batch.originScrapReceipt
  const siblingBatches = batch.siblingBatches || []
  const processRuns = batch.processRuns || []
  const productionRun = batch.productionRun
  const summary = detail.data.summary
  const costSummary = detail.data.costSummary
  const isDry = batch.batchType === 'DRY' || batch.batchType === 'RECYCLE'
  const costPerKg = isDry ? summary.trueRecycledCostPerKg : summary.costPerKg
  const typeLabel = TYPE_LABEL[batch.batchType] || batch.batchType
  const stageRows = costSummary?.stageBreakdown || []
  const sortingRun = processRuns.find((r) => r.stage === 'SORTING')
  const crushingRun = processRuns.find((r) => r.stage === 'CRUSHING')
  const crushedColors = parseColorBreakdown(crushingRun?.colorBreakdown)

  // Merge any SORTING stage into Scrap Buying ('BUY') stage, as sorting is part of scrap buying
  const displayStageRows = (() => {
    const sortingRow = stageRows.find((r) => r.stage === 'SORTING')
    const buyRow = stageRows.find((r) => r.stage === 'BUY')

    let rawRows: typeof stageRows = stageRows
    if (!sortingRow) {
      rawRows = stageRows.map((row) =>
        row.stage === 'BUY' && row.label === 'Buy scrap'
          ? { ...row, label: 'Scrap buying' }
          : row
      )
    } else if (buyRow) {
      rawRows = stageRows
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
    } else {
      // If sortingRow exists but no BUY row, transform sortingRow into Scrap buying
      rawRows = stageRows.map((row) => {
        if (row.stage === 'SORTING') {
          return {
            ...row,
            stage: 'BUY',
            label: 'Scrap buying',
          }
        }
        return row
      })
    }

    let running = 0
    let rows = rawRows.map((row) => {
      running += Number(row.amount || 0)
      const qtyKg = Number(row.qtyKg || 0)
      return {
        ...row,
        runningTotal: +running.toFixed(2),
        runningPerKg: qtyKg > 0 ? +(running / qtyKg).toFixed(2) : null,
      }
    })

    // Ensure scrap buying lines show full inbound detail from the receipt when available
    if (receipt) {
      const buyIdx = rows.findIndex((r) => r.stage === 'BUY')
      const receiptLines = [
        { label: 'Scrap buy', amount: Number(receipt.purchaseCost || 0) },
        { label: 'Transport', amount: Number(receipt.transportCost || 0) },
        { label: 'Loading', amount: Number(receipt.loadingCost || 0) },
        { label: 'Unloading', amount: Number(receipt.unloadingCost || 0) },
        { label: 'Scale fee', amount: Number(receipt.scaleCost || 0) },
        { label: 'Net bag cost', amount: Number(receipt.netBagCost || 0) },
        { label: 'Sorting', amount: Number(receipt.sortingCost || 0) },
        { label: 'Other', amount: Number(receipt.otherCost || 0) },
      ]
      const receiptTotal = +receiptLines
        .reduce((sum, line) => sum + line.amount, 0)
        .toFixed(2)
      const qtyKg = Number(receipt.netWeight || 0)
      const buyExtras = [
        ...(Number(receipt.pricePerKg) > 0
          ? [{ label: 'Buy price', text: `₦${Number(receipt.pricePerKg).toLocaleString()}/kg` }]
          : []),
        ...(receipt.supplier?.name
          ? [{ label: 'Supplier', text: receipt.supplier.name }]
          : []),
        ...(receipt.inboundForm
          ? [
              {
                label: 'Bought as',
                text: receipt.inboundForm === 'CRUSHED' ? 'Already crushed' : 'Raw scrap',
              },
            ]
          : []),
        ...(Number(receipt.sortingPricePerKg) > 0
          ? [
              {
                label: 'Sorting price',
                text: `₦${Number(receipt.sortingPricePerKg).toLocaleString()}/kg`,
              },
            ]
          : []),
      ]

      if (buyIdx >= 0) {
        const existing = rows[buyIdx]
        const byLabel = new Map(existing.lines.map((l) => [l.label.toLowerCase(), l.amount]))
        const mergedLines = receiptLines.map((line) => ({
          label: line.label,
          amount:
            line.amount > 0
              ? line.amount
              : Number(byLabel.get(line.label.toLowerCase()) || 0),
        }))
        // Keep any sorting labour already merged that isn't on the receipt field
        existing.lines.forEach((l) => {
          if (!mergedLines.some((m) => m.label.toLowerCase() === l.label.toLowerCase())) {
            mergedLines.push(l)
          }
        })
        const amount = Math.max(
          receiptTotal,
          Number(existing.amount || 0),
          +mergedLines.reduce((s, l) => s + l.amount, 0).toFixed(2),
        )
        rows[buyIdx] = {
          ...existing,
          label: 'Scrap buying',
          qtyKg: existing.qtyKg || qtyKg,
          amount,
          perKg: (existing.qtyKg || qtyKg) > 0 ? +(amount / (existing.qtyKg || qtyKg)).toFixed(2) : null,
          lines: mergedLines,
          extras: [...(existing.extras || []), ...buyExtras].filter(
            (ex, i, arr) => arr.findIndex((x) => x.label === ex.label) === i,
          ),
        }
      } else {
        rows = [
          {
            key: 'BUY-receipt',
            stage: 'BUY',
            label: 'Scrap buying',
            qtyKg,
            qtyReject: 0,
            amount: receiptTotal,
            perKg: qtyKg > 0 ? +(receiptTotal / qtyKg).toFixed(2) : null,
            runningTotal: receiptTotal,
            runningPerKg: qtyKg > 0 ? +(receiptTotal / qtyKg).toFixed(2) : null,
            lines: receiptLines,
            extras: buyExtras,
          },
          ...rows,
        ]
      }

      // Recompute running totals after buy merge
      let run = 0
      rows = rows.map((row) => {
        run += Number(row.amount || 0)
        const q = Number(row.qtyKg || 0)
        return {
          ...row,
          runningTotal: +run.toFixed(2),
          runningPerKg: q > 0 ? +(run / q).toFixed(2) : null,
        }
      })
    }

    return rows
  })()

  const displayProcessRuns = processRuns.filter((r) => r.stage !== 'SORTING')

  const isProd = batch.batchType === 'PROD' || Boolean(productionRun)

  // Scrap buying has its own clean detail page
  if (batch.batchType === 'SCRAP' && batch.scrapReceipt?.id) {
    return <Navigate to={`/receiving/${batch.scrapReceipt.id}`} replace />
  }

  // Process stages (crush / wash / dry / …): summary + expense table only
  if (!isProd) {
    const qtyKg = Number(batch.qtyIn || 0)
    const wasteKg = Number(batch.qtyReject || batch.qtyWaste || 0)
    const usableKg = Math.max(0, qtyKg - wasteKg)
    const totalCost = Number(summary.totalCost || 0)
    const unitCost = usableKg > 0 ? +(totalCost / usableKg).toFixed(2) : 0

    const expenseRows: Array<{ label: string; amount: number }> = []
    if (displayStageRows.length > 0) {
      displayStageRows.forEach((row) => {
        const stageName = row.label || STAGE_LABEL[row.stage] || row.stage
        ;(row.lines || []).forEach((line) => {
          const amount = Number(line.amount || 0)
          if (!(amount > 0)) return
          const lineLabel = String(line.label || '').trim()
          const alreadyPrefixed = lineLabel.toLowerCase().startsWith(String(stageName).toLowerCase())
          expenseRows.push({
            label: alreadyPrefixed ? lineLabel : `${stageName} ${lineLabel.toLowerCase()}`,
            amount: +amount.toFixed(2),
          })
        })
      })
    } else {
      displayProcessRuns.forEach((run) => {
        const stageName = STAGE_LABEL[run.stage] || run.stage
        const add = (label: string, amount: number | null | undefined) => {
          const n = Number(amount || 0)
          if (!(n > 0)) return
          expenseRows.push({
            label: `${stageName} ${label.toLowerCase()}`,
            amount: +n.toFixed(2),
          })
        }
        add('Labour', run.labourCost)
        add('Energy', run.energyCost)
        add('Loading', run.loadingCost)
        add('Transport', run.transportCost)
        add('Other', run.otherCost)
        add('Water', run.waterQty)
        add('Chemical', run.chemicalCost)
        add('Detergent', run.detergentCost)
      })
    }
    const expensesTotal = +expenseRows.reduce((sum, row) => sum + row.amount, 0).toFixed(2)
    const isPurchaseLine = (label: string) => {
      const l = label.toLowerCase()
      return l.includes('scrap buy') || l.includes('buy scrap') || l.includes('material purchase')
    }
    const otherExpenses = +expenseRows
      .filter((row) => !isPurchaseLine(row.label))
      .reduce((sum, row) => sum + row.amount, 0)
      .toFixed(2)
    // Prefer summed expense lines; fall back to batch total cost
    const displayTotal = expensesTotal > 0 ? expensesTotal : totalCost

    const nextAction =
      batch.batchType === 'CRUSH' && Number(batch.qtyRemaining || 0) > 0 ? (
        <Button size="sm" className="h-8 text-xs font-semibold" asChild>
          <Link to={`/process/washing/new?batch=${encodeURIComponent(batch.batchNumber)}`}>
            Process washing →
          </Link>
        </Button>
      ) : batch.batchType === 'WASH' && Number(batch.qtyRemaining || 0) > 0 ? (
        <Button size="sm" className="h-8 text-xs font-semibold" asChild>
          <Link to={`/process/drying/new?batch=${encodeURIComponent(batch.batchNumber)}`}>
            Process drying →
          </Link>
        </Button>
      ) : batch.batchType === 'DRY' && Number(batch.qtyRemaining || 0) > 0 ? (
        <Button size="sm" className="h-8 text-xs font-semibold" asChild>
          <Link to={`/process/recrushing/new?batch=${encodeURIComponent(batch.batchNumber)}`}>
            Process re-crushing →
          </Link>
        </Button>
      ) : null

    return (
      <PageLayout
        title={<span className="font-mono">{batch.batchNumber}</span>}
        description={`${typeLabel}${batch.sortColor ? ` · ${colorLabel(batch.sortColor)}` : ''}`}
        back
        backLabel="Back"
        onBack={() => navigate(-1)}
        actions={nextAction}
      >
        <div className="space-y-4">
          <Card className="!p-4">
            <h2 className="text-base font-semibold">Summary</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <Fact
                label="Date"
                value={formatBusinessDate(batch.businessDate) || formatDateTime(batch.createdAt) || '—'}
              />
              <Fact label="Name of material" value={batch.material?.name || '—'} />
              <Fact label="Quantity" value={kg(qtyKg)} />
              <Fact label="Waste" value={kg(wasteKg)} />
              <Fact
                label="Cost / kg"
                value={
                  usableKg > 0 && displayTotal > 0
                    ? `${money(+(displayTotal / usableKg).toFixed(2))}/kg`
                    : unitCost > 0
                      ? `${money(unitCost)}/kg`
                      : '—'
                }
              />
              <Fact label="Other cost" value={money(Number(otherExpenses))} />
              <Fact label="Cost" value={money(displayTotal)} strong />
            </div>
          </Card>

          <Card className="!overflow-hidden !p-0">
            <div className="border-b border-[var(--line)] px-4 py-3">
              <h2 className="text-base font-semibold">Expense details</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                    <th className="px-4 py-3 font-semibold">Expense</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-sm text-[var(--ink-muted)]">
                        No expense lines recorded yet.
                      </td>
                    </tr>
                  ) : (
                    expenseRows.map((row, idx) => (
                      <tr key={`${row.label}-${idx}`} className="border-b border-[var(--line)]">
                        <td className="px-4 py-3 font-medium">{row.label}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {money(row.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-zinc-50">
                    <td className="px-4 py-3 font-semibold">Total</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {money(displayTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </PageLayout>
    )
  }


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
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-xs"
            asChild
          >
            <Link to={`/production/${productionRun.id}/work`}>
              <Wrench className="size-3.5" />
              <span>Work & Logs →</span>
            </Link>
          </Button>
        ) : batch.batchType === 'CRUSH' && Number(batch.qtyRemaining || 0) > 0 ? (
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
            asChild
          >
            <Link to={`/process/washing/new?batch=${encodeURIComponent(batch.batchNumber)}`}>
              Process Washing →
            </Link>
          </Button>
        ) : batch.batchType === 'WASH' && Number(batch.qtyRemaining || 0) > 0 ? (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
            asChild
          >
            <Link to="/production/store">
              Move to Material Store →
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
                Material has been issued ({materialConsumed} kg). Track shifts, record operator output, and log downtime in Work & Logs.
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

      {/* Colors & Process Lifecycle Breakdown Card for Crushed, Washed, or Dried Batches */}
      {((batch.colorItems && batch.colorItems.length > 0) || crushedColors.length > 0) &&
        (batch.batchType === 'CRUSH' || batch.batchType === 'WASH' || batch.batchType === 'DRY') && (
        <Card className="!p-4 border-blue-200 bg-blue-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Colors &amp; Recycling Progression</h2>
              <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                {batch.batchType === 'CRUSH'
                  ? 'Output colours from crushing run · Ready for washing'
                  : batch.batchType === 'WASH'
                  ? 'Washed colours · Ready for drying'
                  : 'Dried colours · Ready for production or recycling'}
              </p>
            </div>
            {Number(batch.qtyRemaining || 0) > 0 && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold self-start sm:self-auto cursor-pointer"
                asChild
              >
                {batch.batchType === 'CRUSH' ? (
                  <Link to={`/process/washing/new?batch=${encodeURIComponent(batch.batchNumber)}`}>
                    Process Washing →
                  </Link>
                ) : batch.batchType === 'WASH' ? (
                  <Link to="/production/store">
                    Move to Material Store →
                  </Link>
                ) : (
                  <Link to="/production/store">
                    Move to Material Store →
                  </Link>
                )}
              </Button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Input weight" value={kg(batch.qtyIn)} strong />
            <Fact label="Available output" value={kg(batch.qtyRemaining)} strong />
            <Fact
              label="Accumulated waste"
              value={kg(batch.qtyReject || (crushingRun ? crushingRun.qtyReject : 0))}
              strong
            />
            <Fact
              label="Yield"
              value={
                crushingRun?.yieldPercent != null
                  ? `${crushingRun.yieldPercent}%`
                  : Number(batch.qtyIn || 0) > 0
                  ? `${+(((Number(batch.qtyRemaining) || 0) / Number(batch.qtyIn)) * 100).toFixed(1)}%`
                  : '—'
              }
              strong
            />
          </div>

          {batch.colorItems && batch.colorItems.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Colour Lifecycle Tracking ({batch.colorItems.length})
              </h3>
              <table className="w-full text-xs text-left border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Colour</th>
                    <th className="px-3 py-2 text-right">Crushed (kg)</th>
                    <th className="px-3 py-2 text-right">Washed (kg)</th>
                    <th className="px-3 py-2 text-right">Wash Waste</th>
                    <th className="px-3 py-2 text-right">Dried (kg)</th>
                    <th className="px-3 py-2 text-right">Dry Waste</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {batch.colorItems.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-3 py-1.5 font-semibold text-zinc-900">
                        {colorLabel(item.color)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-medium">
                        {Number(item.qtyCrushed).toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-medium text-emerald-700">
                        {item.qtyWashed != null ? Number(item.qtyWashed).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-zinc-500">
                        {item.qtyWashWaste != null ? `${Number(item.qtyWashWaste).toLocaleString()} kg` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-medium text-blue-700">
                        {item.qtyDried != null ? Number(item.qtyDried).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-zinc-500">
                        {item.qtyDryWaste != null ? `${Number(item.qtyDryWaste).toLocaleString()} kg` : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                          {item.status || 'CRUSHED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : crushedColors.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Colors Crushed ({crushedColors.length})
              </h3>
              <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white overflow-hidden">
                {crushedColors.map((c, i) => (
                  <div key={`${c.color}-${i}`} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full border border-zinc-300 bg-zinc-200" />
                      <span className="font-semibold text-zinc-800">{colorLabel(c.color)}</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-900 tabular-nums">
                      {Number(c.qtyKg).toLocaleString()} kg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      )}

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

      <ForwardTracePanel
        batchNumber={batchNumber}
        inputs={batch.inputs}
        siblingBatches={batch.batchType === 'CRUSH' ? [] : siblingBatches}
      />

      {!isProd && (displayProcessRuns.length > 0 || displayStageRows.length > 0 || receipt) && (
        <Card className="!p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
            <div>
              <h2 className="text-base font-semibold">Process stages</h2>
              <p className="text-xs text-[var(--ink-muted)]">
                Scrap buying through current stage — costs and measured kg
              </p>
            </div>
            <div className="flex items-center gap-3">
              {receipt?.id && receipt.editable !== false ? (
                <Link
                  to={`/receiving/${receipt.id}/edit`}
                  className="text-xs font-medium text-[var(--accent-strong)] hover:underline"
                >
                  Edit scrap costs
                </Link>
              ) : receipt?.id && receipt.editable === false ? (
                <span
                  className="text-xs text-[var(--ink-muted)]"
                  title={receipt.lockReason || 'Already moved to crushing or later'}
                >
                  Scrap edit locked
                </span>
              ) : null}
              {batch.originScrapReceipt && !batch.scrapReceipt && batch.inputs?.[0]?.fromBatch && (
                <Link
                  to={`/batches/${batch.inputs[0].fromBatch.batchNumber}`}
                  className="text-xs font-medium text-[var(--accent-strong)] hover:underline"
                >
                  Origin: {batch.inputs[0].fromBatch.batchNumber} →
                </Link>
              )}
              <span className="text-xs text-[var(--ink-muted)]">Current:</span>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                {typeLabel}
              </span>
            </div>
          </div>

          {/* Stage Progression Pipeline */}
          {/* <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { key: 'BUY', label: '1. Scrap buying', match: ['SCRAP'] },
              { key: 'CRUSHING', label: '2. Crushing', match: ['CRUSH'] },
              { key: 'WASHING', label: '3. Washing', match: ['WASH'] },
              { key: 'DRYING', label: '4. Drying', match: ['DRY'] },
              { key: 'RECYCLING', label: '5. Recycling', match: ['RECYCLE', 'PROD'] },
            ].map((step) => {
              const hasRun = displayStageRows.some((r) => r.stage === step.key)
              const isCurrent = step.match.includes(batch.batchType)

              return (
                <div
                  key={step.key}
                  className={`rounded-lg border p-2.5 text-xs transition-all ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50/80 font-medium text-blue-900 shadow-sm'
                      : hasRun
                      ? 'border-emerald-200 bg-emerald-50/40 text-emerald-800'
                      : 'border-zinc-200 bg-zinc-50/40 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium">{step.label}</span>
                    {hasRun && (
                      <span className="text-emerald-600 font-bold">✓</span>
                    )}
                    {isCurrent && !hasRun && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] opacity-80">
                    {isCurrent ? 'Current stage' : hasRun ? 'Completed' : 'Upcoming'}
                  </p>
                </div>
              )
            })}
          </div> */}

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--line)] pt-3">
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
          <div className="mt-4 space-y-3">
            {displayStageRows.length > 0
              ? displayStageRows.map((row) => {
                  const run =
                    row.stage === 'BUY'
                      ? (processRuns.find((r) => r.stage === 'BUY') || sortingRun)
                      : processRuns.find((r) => r.stage === row.stage)
                  return <StageBlock key={row.key} run={run} cost={row} />
                })
              : (() => {
                  let fallbackRunning = 0
                  return displayProcessRuns.map((run) => {
                    const lines = [
                      Number(run.labourCost || 0) > 0 ? { label: 'Labour', amount: Number(run.labourCost) } : null,
                      Number(run.energyCost || 0) > 0 ? { label: 'Energy', amount: Number(run.energyCost) } : null,
                      Number(run.loadingCost || 0) > 0 ? { label: 'Loading', amount: Number(run.loadingCost) } : null,
                      Number(run.transportCost || 0) > 0
                        ? { label: 'Transport', amount: Number(run.transportCost) }
                        : null,
                      Number(run.otherCost || 0) > 0 ? { label: 'Other', amount: Number(run.otherCost) } : null,
                      Number(run.chemicalCost || 0) > 0 ? { label: 'Chemical', amount: Number(run.chemicalCost) } : null,
                      Number(run.detergentCost || 0) > 0 ? { label: 'Detergent', amount: Number(run.detergentCost) } : null,
                      Number(run.waterQty || 0) > 0 ? { label: 'Water', amount: Number(run.waterQty) } : null,
                    ].filter(Boolean) as Array<{ label: string; amount: number }>
                    const naira = lines.reduce((sum, line) => sum + line.amount, 0)
                    const qtyKg = Number(run.qtyUsable || run.qtyInput || 0)
                    fallbackRunning += naira
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
                          runningTotal: fallbackRunning,
                          runningPerKg: qtyKg > 0 ? fallbackRunning / qtyKg : null,
                          lines,
                          extras: [],
                        }}
                      />
                    )
                  })
                })()}
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
          value={
            cost.runningPerKg != null
              ? `${money(cost.runningPerKg)}/kg`
              : cost.perKg != null
                ? `${money(cost.perKg)}/kg`
                : '—'
          }
          compact
        />
      </div>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">
        Total so far: {money(cost.runningTotal)}
        {cost.perKg != null && cost.runningPerKg != null && Math.abs(cost.perKg - cost.runningPerKg) > 0.01
          ? ` · +${money(cost.perKg)}/kg this stage`
          : ''}
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
          {cost.lines
            .filter((row) => Number(row.amount || 0) > 0)
            .map((row) => {
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
      {(cost.extras || [])
        .filter((ex) => ex.label !== 'Buy price')
        .map((ex) => (
        <p key={ex.label} className="mt-1 text-xs text-[var(--ink-muted)]">
          {ex.label}: {ex.text}
        </p>
      ))}

      {run && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-muted)]">
          {run.operatorName && <span>Operator: {run.operatorName}</span>}
          {run.machineName && <span>Machine: {run.machineName}</span>}
          {run.teamName && <span>Team: {run.teamName}</span>}
          {run.waterQty != null && Number(run.waterQty) > 0 && cost.stage === 'WASHING' && (
            <span>Water: ₦{Number(run.waterQty).toLocaleString()}</span>
          )}
          {run.moistureReading != null && (
            <span>Moisture: {run.moistureReading}%</span>
          )}
          {run.downtimeMinutes != null && Number(run.downtimeMinutes) > 0 && (
            <span>
              Downtime: {run.downtimeMinutes} min{run.downtimeReason ? ` (${run.downtimeReason})` : ''}
            </span>
          )}
        </div>
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
    qtyIn?: number
    qtyOut?: number
    qtyRemaining?: number
    qtyConsumed?: number | null
    uom?: string
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

type BatchLinkInput = {
  id: number
  qtyConsumed: number
  fromBatch?: {
    batchNumber: string
    batchType: string
    material?: { name: string }
    location?: { name: string; code?: string }
  }
}

type SiblingBatchItem = {
  id: number
  batchNumber: string
  batchType: string
  status: string
  sortColor?: string | null
  qtyIn: number
  qtyRemaining: number
  uom: string
  locationName?: string | null
  materialName?: string | null
}

function ForwardTracePanel({
  batchNumber,
  inputs,
  siblingBatches,
}: {
  batchNumber: string
  inputs?: BatchLinkInput[]
  siblingBatches?: SiblingBatchItem[]
}) {
  const trace = useQuery({
    queryKey: ['forward-trace', batchNumber],
    queryFn: async () => {
      const { data } = await api.get(`/batches/${batchNumber}/forward-trace`)
      return data.data as ForwardTrace
    },
  })

  if (!trace.data) return null
  const t = trace.data
  const hasInputs = Boolean(inputs && inputs.length > 0)
  const hasSiblings = Boolean(siblingBatches && siblingBatches.length > 0)
  const hasDescendants = t.descendantCount > 0 || (t.sales && t.sales.length > 0)

  if (!hasDescendants && !hasInputs && !hasSiblings) return null

  return (
    <Card className="!p-4">
      <h2 className="text-base font-semibold">Linked & related batches</h2>
      <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
        {t.descendantCount > 0
          ? `${t.descendantCount} next stage${t.descendantCount === 1 ? '' : 's'}`
          : 'Origin & downstream tracking'}
        {t.reachedCustomers > 0 ? ` · sold to ${t.customers.join(', ')}` : ''}
      </p>

      {hasInputs && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
            Came from (Source)
          </p>
          <div className="space-y-1 pl-1">
            {inputs!.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                <Link
                  to={`/batches/${link.fromBatch?.batchNumber}`}
                  className="font-medium text-[var(--accent-strong)] hover:underline"
                >
                  {link.fromBatch?.batchNumber}
                </Link>
                <span className="text-xs text-[var(--ink-muted)]">
                  {TYPE_LABEL[link.fromBatch?.batchType || ''] || link.fromBatch?.batchType}
                  {link.fromBatch?.material?.name ? ` · ${link.fromBatch.material.name}` : ''}
                  {link.qtyConsumed ? ` · ${Number(link.qtyConsumed).toLocaleString()} kg consumed` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSiblings && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
            Sister Lots (Same Scrap Ticket)
          </p>
          <div className="space-y-1 pl-2 max-h-48 overflow-y-auto border-l-2 border-[var(--line)]">
            {siblingBatches!.map((sib) => (
              <div key={sib.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                <Link
                  to={`/batches/${sib.batchNumber}`}
                  className="font-medium text-[var(--accent-strong)] hover:underline"
                >
                  {sib.batchNumber}
                </Link>
                <span className="text-xs text-[var(--ink-muted)]">
                  {TYPE_LABEL[sib.batchType] || sib.batchType}
                  {sib.sortColor ? ` · ${colorLabel(sib.sortColor)}` : ''}
                  {sib.qtyIn ? ` · ${Number(sib.qtyIn).toLocaleString()} kg` : ''}
                  {` · ${sib.status}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-1">
        {(hasInputs || hasSiblings) && (
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
            Downstream Journey
          </p>
        )}
        <div className="space-y-1">
          {t.batches.map((node) => {
            const isCurrent = node.batchNumber === batchNumber
            const weight =
              node.qtyConsumed != null && node.qtyConsumed > 0
                ? node.qtyConsumed
                : (node.qtyIn != null && node.qtyIn > 0
                    ? node.qtyIn
                    : (node.qtyRemaining != null && node.qtyRemaining > 0
                        ? node.qtyRemaining
                        : (node.qtyOut != null && node.qtyOut > 0 ? node.qtyOut : null)))
            return (
              <div
                key={node.batchNumber}
                className="flex flex-wrap items-center gap-1.5 text-sm py-0.5"
                style={{ paddingLeft: `${node.depth * 14}px` }}
              >
                {node.depth > 0 && <span className="text-[var(--ink-faint)] font-mono">└</span>}
                <Link
                  to={`/batches/${node.batchNumber}`}
                  className={`font-medium hover:underline ${isCurrent ? 'font-semibold text-zinc-900' : 'text-[var(--accent-strong)]'}`}
                >
                  {node.batchNumber}
                  {isCurrent && <span className="ml-1 text-[11px] font-normal text-[var(--ink-muted)]">(this batch)</span>}
                </Link>
                <span className="text-xs text-[var(--ink-muted)]">
                  {TYPE_LABEL[node.batchType] || node.batchType}
                  {node.itemName ? ` · ${node.itemName}` : ''}
                  {weight != null ? ` · ${Number(weight).toLocaleString()} ${node.uom || 'kg'}` : ''}
                </span>
              </div>
            )
          })}
          {t.descendantCount === 0 && (!t.sales || t.sales.length === 0) && (
            <p className="text-xs text-[var(--ink-muted)] pl-1">In inventory / Not yet consumed into further stages</p>
          )}
        </div>
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
