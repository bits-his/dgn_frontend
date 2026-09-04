import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRightLeft, ClipboardList, SlidersHorizontal } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader, StatPill } from '@/components/ui'
import { hasPermission } from '@/lib/auth'
import { useAuthStore } from '@/stores/auth-store'

type StockLine = {
  id: number
  qtyOnHand: number
  uom: string
  locationId: number
  locationCode: string | null
  locationName: string | null
  locationType: string | null
  materialName: string | null
  productName: string | null
  batchNumber: string | null
  batchType: string | null
  ageDays: number | null
}

type Overview = {
  totals: {
    lines: number
    rawMaterialQty: number
    wipQty: number
    finishedGoodsQty: number
    stockValue: number
    unvaluedLines: number
  }
  byLocation: Array<{
    locationId: number
    code: string | null
    name: string
    locationType: string
    qty: number
    lines: number
    uom: string
  }>
  byMaterial: Array<{
    materialId: number
    code: string | null
    name: string
    qty: number
    uom: string
    reorderLevel: number
    belowReorder: boolean
  }>
  byProduct: Array<{
    productId: number
    code: string | null
    name: string
    qty: number
    uom: string
    reorderLevel: number
    belowReorder: boolean
  }>
  currency: string
}

type Alerts = {
  ageingDaysThreshold: number
  counts: { lowStock: number; ageing: number; negative: number }
  lowStock: Array<{
    kind: string
    code: string | null
    name: string
    qty: number
    uom: string
    reorderLevel: number
    shortfall: number
    severity: string
  }>
  ageing: StockLine[]
  negative: StockLine[]
}

type MasterItem = { id: number; name: string; code?: string }

const REASON_LABELS: Record<string, string> = {
  STOCK_COUNT: 'Physical count difference',
  DAMAGE: 'Damaged stock',
  SPILLAGE: 'Spillage',
  THEFT: 'Theft / missing',
  DATA_ENTRY_ERROR: 'Data entry error',
  MOISTURE_LOSS: 'Moisture loss',
  OTHER: 'Other',
}

function fmt(n: number) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function InventoryPage() {
  const user = useAuthStore((s) => s.user)
  const canAdjust = hasPermission(user, 'inventory.adjust')
  const queryClient = useQueryClient()

  const [locationFilter, setLocationFilter] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [panel, setPanel] = useState<{ mode: 'adjust' | 'transfer'; line: StockLine } | null>(null)

  const overview = useQuery({
    queryKey: ['inventory-overview'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/overview')
      return data.data as Overview
    },
  })

  const alerts = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/alerts')
      return data.data as Alerts
    },
  })

  const locations = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data } = await api.get('/masters/locations')
      return data.data as MasterItem[]
    },
  })

  const balances = useQuery({
    queryKey: ['inventory-balances', locationFilter, batchFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (locationFilter) params.set('locationId', locationFilter)
      if (batchFilter) params.set('batchNumber', batchFilter)
      const { data } = await api.get(`/inventory/balances?${params.toString()}`)
      return data.data as StockLine[]
    },
  })

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-overview'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-balances'] })
  }

  const totals = overview.data?.totals
  const alertCount = alerts.data
    ? alerts.data.counts.lowStock + alerts.data.counts.ageing + alerts.data.counts.negative
    : 0

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Stock visibility"
        description="Live balances across raw material, work in progress and finished goods. Stock is never edited directly — every change is a recorded movement."
        actions={
          <Link to="/inventory/ledger" className="dgn-btn dgn-btn-secondary">
            <ClipboardList className="size-4" />
            Movement ledger
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatPill label="Raw material" value={`${fmt(totals?.rawMaterialQty ?? 0)} kg`} />
        <StatPill label="Work in progress" value={`${fmt(totals?.wipQty ?? 0)} kg`} tone="accent" />
        <StatPill
          label="Finished goods"
          value={`${fmt(totals?.finishedGoodsQty ?? 0)} pcs`}
          tone="success"
        />
        <StatPill
          label="Stock value"
          value={`₦${fmt(totals?.stockValue ?? 0)}`}
          tone="success"
        />
        <StatPill
          label="Open alerts"
          value={String(alertCount)}
          tone={alertCount > 0 ? 'danger' : 'default'}
        />
      </div>

      {alerts.data && alertCount > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 text-amber-950">
            <AlertTriangle className="size-5" />
            <h2 className="text-lg font-semibold tracking-tight">Attention needed</h2>
          </div>
          <div className="mt-4 space-y-4 text-sm text-amber-950">
            {alerts.data.lowStock.length > 0 && (
              <div>
                <p className="font-semibold">Below reorder level</p>
                <ul className="mt-1 space-y-1">
                  {alerts.data.lowStock.map((item) => (
                    <li key={`${item.kind}-${item.code}`}>
                      {item.name} — {fmt(item.qty)} {item.uom} on hand against a reorder level of{' '}
                      {fmt(item.reorderLevel)}, short by {fmt(item.shortfall)} {item.uom}
                      {item.severity === 'CRITICAL' && ' (out of stock)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alerts.data.ageing.length > 0 && (
              <div>
                <p className="font-semibold">
                  Sitting longer than {alerts.data.ageingDaysThreshold} days
                </p>
                <ul className="mt-1 space-y-1">
                  {alerts.data.ageing.slice(0, 8).map((line) => (
                    <li key={line.id}>
                      {line.batchNumber || line.materialName} — {fmt(line.qtyOnHand)} {line.uom} at{' '}
                      {line.locationName}, {line.ageDays} days old
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {alerts.data.negative.length > 0 && (
              <div>
                <p className="font-semibold">Negative balances (data problem)</p>
                <ul className="mt-1 space-y-1">
                  {alerts.data.negative.map((line) => (
                    <li key={line.id}>
                      {line.batchNumber || line.materialName} — {fmt(line.qtyOnHand)} {line.uom} at{' '}
                      {line.locationName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-base font-semibold tracking-tight">By location</h2>
          <div className="mt-3 space-y-2 text-sm">
            {overview.data?.byLocation.map((loc) => (
              <div key={loc.locationId} className="flex items-center justify-between gap-3">
                <span>
                  {loc.name}
                  <span className="ml-2 text-xs text-[var(--ink-faint)]">{loc.locationType}</span>
                </span>
                <strong>
                  {fmt(loc.qty)} {loc.uom}
                </strong>
              </div>
            ))}
            {!overview.isLoading && !overview.data?.byLocation.length && (
              <p className="text-[var(--ink-muted)]">No stock on hand.</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold tracking-tight">By material</h2>
          <div className="mt-3 space-y-2 text-sm">
            {overview.data?.byMaterial.map((m) => (
              <div key={m.materialId} className="flex items-center justify-between gap-3">
                <span>{m.name}</span>
                <strong className={m.belowReorder ? 'text-red-600' : undefined}>
                  {fmt(m.qty)} {m.uom}
                </strong>
              </div>
            ))}
            {!overview.isLoading && !overview.data?.byMaterial.length && (
              <p className="text-[var(--ink-muted)]">No material stock.</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold tracking-tight">By product</h2>
          <div className="mt-3 space-y-2 text-sm">
            {overview.data?.byProduct.map((p) => (
              <div key={p.productId} className="flex items-center justify-between gap-3">
                <span>{p.name}</span>
                <strong className={p.belowReorder ? 'text-red-600' : undefined}>
                  {fmt(p.qty)} {p.uom}
                </strong>
              </div>
            ))}
            {!overview.isLoading && !overview.data?.byProduct.length && (
              <p className="text-[var(--ink-muted)]">No finished goods yet.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Stock lines</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Location">
              <select
                className="dgn-input"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="">All locations</option>
                {locations.data?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Batch number">
              <input
                className="dgn-input"
                placeholder="e.g. DRY-260903"
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--ink-muted)]">
                <th className="py-3 pr-4 font-semibold">Batch</th>
                <th className="py-3 pr-4 font-semibold">Item</th>
                <th className="py-3 pr-4 font-semibold">Location</th>
                <th className="py-3 pr-4 font-semibold">On hand</th>
                <th className="py-3 pr-4 font-semibold">Age</th>
                {canAdjust && <th className="py-3 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {balances.isLoading && (
                <tr>
                  <td colSpan={6} className="py-6 text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {balances.data?.map((line) => (
                <tr key={line.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-4">
                    {line.batchNumber ? (
                      <Link
                        to={`/batches/${line.batchNumber}`}
                        className="font-semibold text-[var(--accent-strong)] hover:underline"
                      >
                        {line.batchNumber}
                      </Link>
                    ) : (
                      <span className="text-[var(--ink-muted)]">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">{line.productName || line.materialName || '—'}</td>
                  <td className="py-3 pr-4">{line.locationName}</td>
                  <td className="py-3 pr-4 font-semibold">
                    {fmt(line.qtyOnHand)} {line.uom}
                  </td>
                  <td className="py-3 pr-4">{line.ageDays != null ? `${line.ageDays}d` : '—'}</td>
                  {canAdjust && (
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="dgn-btn dgn-btn-ghost px-2 py-1 text-xs"
                          onClick={() => setPanel({ mode: 'adjust', line })}
                        >
                          <SlidersHorizontal className="size-3.5" />
                          Adjust
                        </button>
                        <button
                          type="button"
                          className="dgn-btn dgn-btn-ghost px-2 py-1 text-xs"
                          onClick={() => setPanel({ mode: 'transfer', line })}
                        >
                          <ArrowRightLeft className="size-3.5" />
                          Transfer
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!balances.isLoading && !balances.data?.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-[var(--ink-muted)]">
                    No stock lines match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {panel && (
        <StockActionDialog
          mode={panel.mode}
          line={panel.line}
          locations={locations.data ?? []}
          onClose={() => setPanel(null)}
          onDone={() => {
            setPanel(null)
            refreshAll()
          }}
        />
      )}
    </div>
  )
}

function StockActionDialog({
  mode,
  line,
  locations,
  onClose,
  onDone,
}: {
  mode: 'adjust' | 'transfer'
  line: StockLine
  locations: MasterItem[]
  onClose: () => void
  onDone: () => void
}) {
  const [qtyDelta, setQtyDelta] = useState('')
  const [reasonCode, setReasonCode] = useState('STOCK_COUNT')
  const [notes, setNotes] = useState('')
  const [writeOffCost, setWriteOffCost] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [qty, setQty] = useState('')
  const [error, setError] = useState('')

  const destinations = useMemo(
    () => locations.filter((loc) => loc.id !== line.locationId),
    [locations, line.locationId],
  )

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'adjust') {
        await api.post('/inventory/adjustments', {
          balanceId: line.id,
          qtyDelta: Number(qtyDelta),
          reasonCode,
          notes,
          writeOffCost: writeOffCost ? Number(writeOffCost) : 0,
        })
      } else {
        await api.post('/inventory/transfers', {
          balanceId: line.id,
          toLocationId: Number(toLocationId),
          qty: Number(qty),
          notes,
        })
      }
    },
    onSuccess: onDone,
    onError: (err: unknown) => {
      const res = (err as { response?: { data?: { err?: string; errors?: Record<string, string> } } })
        .response
      if (res?.data?.errors) setError(Object.values(res.data.errors).join(' · '))
      else setError(res?.data?.err || 'Could not save this change')
    },
  })

  const projected =
    mode === 'adjust' && qtyDelta !== ''
      ? line.qtyOnHand + Number(qtyDelta || 0)
      : mode === 'transfer' && qty !== ''
        ? line.qtyOnHand - Number(qty || 0)
        : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="dgn-card w-full max-w-lg p-5 sm:p-6">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            {mode === 'adjust' ? 'Stock adjustment' : 'Stock transfer'}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {line.batchNumber || line.materialName || line.productName}
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {fmt(line.qtyOnHand)} {line.uom} on hand at {line.locationName}
          </p>
        </div>

        <div className="space-y-4">
          {mode === 'adjust' ? (
            <>
              <Field
                label="Adjustment quantity"
                hint="Use a negative number for a loss, positive for a gain"
              >
                <input
                  inputMode="decimal"
                  className="dgn-input"
                  placeholder="-8"
                  value={qtyDelta}
                  onChange={(e) => setQtyDelta(e.target.value)}
                />
              </Field>
              <Field label="Reason">
                <select
                  className="dgn-input"
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                >
                  {Object.entries(REASON_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Explanation" hint="Required, minimum 5 characters">
                <textarea
                  className="dgn-input"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <Field label="Write-off cost ₦" hint="Optional, charged to the batch as a loss">
                <input
                  inputMode="decimal"
                  className="dgn-input"
                  value={writeOffCost}
                  onChange={(e) => setWriteOffCost(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Destination location">
                <select
                  className="dgn-input"
                  value={toLocationId}
                  onChange={(e) => setToLocationId(e.target.value)}
                >
                  <option value="">Select destination</option>
                  {destinations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Quantity to move (${line.uom})`}>
                <input
                  inputMode="decimal"
                  className="dgn-input"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  className="dgn-input"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </>
          )}

          {projected != null && (
            <StatPill
              label="Balance at this location after saving"
              value={`${fmt(projected)} ${line.uom}`}
              tone={projected < 0 ? 'danger' : 'accent'}
            />
          )}

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="dgn-btn dgn-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="dgn-btn dgn-btn-primary"
              disabled={mutation.isPending}
              onClick={() => {
                setError('')
                mutation.mutate()
              }}
            >
              {mutation.isPending
                ? 'Saving…'
                : mode === 'adjust'
                  ? 'Post adjustment'
                  : 'Post transfer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
