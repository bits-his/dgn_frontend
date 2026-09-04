import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, Field, PageHeader } from '@/components/ui'

type LedgerRow = {
  id: number
  direction: 'IN' | 'OUT'
  qty: number
  uom: string
  reason: string
  referenceType: string | null
  notes: string | null
  businessDate: string | null
  createdAt: string
  batchNumber: string | null
  materialName: string | null
  productName: string | null
  locationName: string | null
  createdBy: string | null
}

type MasterItem = { id: number; name: string }

const REASONS = [
  'RECEIVING',
  'PROCESSING',
  'CONSUMPTION',
  'PRODUCTION',
  'TRANSFER',
  'ADJUSTMENT',
  'REJECTION',
  'WASTE',
  'SALE',
  'RETURN',
]

export function StockLedgerPage() {
  const [direction, setDirection] = useState('')
  const [reason, setReason] = useState('')
  const [locationId, setLocationId] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const locations = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data } = await api.get('/masters/locations')
      return data.data as MasterItem[]
    },
  })

  const ledger = useQuery({
    queryKey: ['inventory-ledger', direction, reason, locationId, batchNumber, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (direction) params.set('direction', direction)
      if (reason) params.set('reason', reason)
      if (locationId) params.set('locationId', locationId)
      if (batchNumber) params.set('batchNumber', batchNumber)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const { data } = await api.get(`/inventory/ledger?${params.toString()}`)
      return data.data as LedgerRow[]
    },
  })

  const totalIn =
    ledger.data?.filter((r) => r.direction === 'IN').reduce((s, r) => s + Number(r.qty), 0) ?? 0
  const totalOut =
    ledger.data?.filter((r) => r.direction === 'OUT').reduce((s, r) => s + Number(r.qty), 0) ?? 0

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Movement ledger"
        description="Every stock movement ever recorded, with the person and reference behind it. Entries are never edited or deleted."
        actions={
          <Link to="/inventory" className="dgn-btn dgn-btn-secondary">
            <ArrowLeft className="size-4" />
            Back to stock
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Direction">
            <select
              className="dgn-input"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="">All</option>
              <option value="IN">In</option>
              <option value="OUT">Out</option>
            </select>
          </Field>
          <Field label="Reason">
            <select className="dgn-input" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">All reasons</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <select
              className="dgn-input"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
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
              placeholder="e.g. PRD-260903"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
            />
          </Field>
          <Field label="From date" hint="Business date, YYYY-MM-DD">
            <input
              type="date"
              className="dgn-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </Field>
          <Field label="To date">
            <input
              type="date"
              className="dgn-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </Field>
        </div>
        <p className="mt-4 text-sm text-[var(--ink-muted)]">
          Showing {ledger.data?.length ?? 0} movements · total in{' '}
          {totalIn.toLocaleString(undefined, { maximumFractionDigits: 3 })} · total out{' '}
          {totalOut.toLocaleString(undefined, { maximumFractionDigits: 3 })}
        </p>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--ink-muted)]">
                <th className="py-3 pr-4 font-semibold">Date</th>
                <th className="py-3 pr-4 font-semibold">Batch</th>
                <th className="py-3 pr-4 font-semibold">Item</th>
                <th className="py-3 pr-4 font-semibold">Location</th>
                <th className="py-3 pr-4 font-semibold">Direction</th>
                <th className="py-3 pr-4 font-semibold">Qty</th>
                <th className="py-3 pr-4 font-semibold">Reason</th>
                <th className="py-3 font-semibold">By</th>
              </tr>
            </thead>
            <tbody>
              {ledger.isLoading && (
                <tr>
                  <td colSpan={8} className="py-6 text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {ledger.data?.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-4 whitespace-nowrap">{row.businessDate || '—'}</td>
                  <td className="py-3 pr-4">
                    {row.batchNumber ? (
                      <Link
                        to={`/batches/${row.batchNumber}`}
                        className="font-semibold text-[var(--accent-strong)] hover:underline"
                      >
                        {row.batchNumber}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 pr-4">{row.productName || row.materialName || '—'}</td>
                  <td className="py-3 pr-4">{row.locationName || '—'}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        row.direction === 'IN'
                          ? 'font-semibold text-teal-700'
                          : 'font-semibold text-red-600'
                      }
                    >
                      {row.direction}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-semibold">
                    {Number(row.qty).toLocaleString(undefined, { maximumFractionDigits: 3 })}{' '}
                    {row.uom}
                  </td>
                  <td className="py-3 pr-4">
                    {row.reason}
                    {row.notes && (
                      <span className="block text-xs text-[var(--ink-faint)]">{row.notes}</span>
                    )}
                  </td>
                  <td className="py-3">{row.createdBy || '—'}</td>
                </tr>
              ))}
              {!ledger.isLoading && !ledger.data?.length && (
                <tr>
                  <td colSpan={8} className="py-6 text-[var(--ink-muted)]">
                    No movements match these filters.
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
