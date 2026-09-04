import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, PageHeader } from '@/components/ui'
import { SORT_COLORS } from '@/lib/sortColors'

type BatchRow = {
  id: number
  batchNumber: string
  batchType: string
  stage?: string
  qtyIn?: string | number
  qtyRemaining: string | number
  uom: string
  sortColor?: string | null
  businessDate?: string | null
  createdAt?: string
  material?: { name: string }
  location?: { name: string }
  product?: { name: string }
}

const STAGE_FILTERS = [
  { value: '', label: 'All stages' },
  { value: 'SCRAP', label: 'Scrap (buy)' },
  { value: 'SORT', label: 'Sorted' },
  { value: 'CRUSH', label: 'Crushed' },
  { value: 'WASH', label: 'Washed' },
  { value: 'DRY', label: 'Dried' },
  { value: 'PROD', label: 'Finished goods' },
]

function colorName(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

/** businessDate is YYMMDD → e.g. 04 Sep 2026 */
function formatBusinessDate(raw?: string | null) {
  if (!raw || raw.length !== 6) return null
  const yy = Number(raw.slice(0, 2))
  const mm = Number(raw.slice(2, 4))
  const dd = Number(raw.slice(4, 6))
  if (!yy || !mm || !dd) return null
  const date = new Date(2000 + yy, mm - 1, dd)
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatCreatedAt(raw?: string) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function qty(value: string | number | undefined, uom: string) {
  if (value == null || value === '') return '—'
  return `${Number(value).toLocaleString()} ${uom || 'kg'}`
}

export function BatchesPage() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')

  const batches = useQuery({
    queryKey: ['batches', search, stage],
    queryFn: async () => {
      const { data } = await api.get('/batches', {
        params: {
          q: search || undefined,
          batchType: stage || undefined,
        },
      })
      return data.data as BatchRow[]
    },
  })

  return (
    <div>
      <PageHeader
        eyebrow="Traceability"
        title="Batches"
        description="All factory batches. See stage, weight, and date — open one for full detail."
      />

      <Card className="mb-4 !p-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(q.trim())
          }}
        >
          <label className="block min-w-0 flex-1">
            <span className="dgn-label">Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Batch number e.g. BAT-… or SCR-…"
              className="dgn-input"
            />
          </label>
          <label className="block sm:w-48">
            <span className="dgn-label">Stage</span>
            <select
              className="dgn-input"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              {STAGE_FILTERS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="dgn-btn dgn-btn-primary sm:min-w-28">
            Search
          </button>
        </form>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-3 py-3 font-semibold">Stage</th>
                <th className="px-3 py-3 font-semibold">Colour</th>
                <th className="px-3 py-3 font-semibold">Material / product</th>
                <th className="px-3 py-3 font-semibold text-right">Qty in</th>
                <th className="px-3 py-3 font-semibold text-right">Available</th>
                <th className="px-3 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {batches.isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!batches.isLoading &&
                batches.data?.map((batch) => {
                  const biz = formatBusinessDate(batch.businessDate)
                  return (
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
                        {batch.location?.name && (
                          <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
                            {batch.location.name}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-strong)]">
                          {batch.stage || batch.batchType}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[var(--ink-muted)]">
                        {colorName(batch.sortColor)}
                      </td>
                      <td className="px-3 py-3">
                        {batch.product?.name || batch.material?.name || '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {qty(batch.qtyIn, batch.uom)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">
                        {qty(batch.qtyRemaining, batch.uom)}
                      </td>
                      <td className="px-3 py-3 text-[var(--ink-muted)] tabular-nums">
                        {biz || formatCreatedAt(batch.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/batches/${batch.batchNumber}`}
                          className="text-sm font-semibold text-[var(--accent-strong)] hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              {!batches.isLoading && batches.data?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    No batches found.
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
