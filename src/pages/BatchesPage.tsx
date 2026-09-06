import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Search, ExternalLink, Eye, RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  { value: 'ALL', label: 'All stages' },
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

function fmtQty(value: string | number | undefined, uom: string) {
  if (value == null || value === '') return '—'
  return `${Number(value).toLocaleString()} ${uom || 'kg'}`
}

function getStageBadge(stage?: string) {
  const s = (stage || '').toUpperCase()
  if (s === 'SCRAP') return 'bg-amber-50 text-amber-800 border-amber-200'
  if (s === 'SORT') return 'bg-blue-50 text-blue-800 border-blue-200'
  if (s === 'CRUSH') return 'bg-purple-50 text-purple-800 border-purple-200'
  if (s === 'WASH') return 'bg-cyan-50 text-cyan-800 border-cyan-200'
  if (s === 'DRY') return 'bg-orange-50 text-orange-800 border-orange-200'
  if (s === 'PROD') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  return 'bg-zinc-100 text-zinc-800 border-zinc-200'
}

export function BatchesPage() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('ALL')

  const batches = useQuery({
    queryKey: ['batches', search, stage],
    queryFn: async () => {
      const { data } = await api.get('/batches', {
        params: {
          q: search || undefined,
          batchType: stage === 'ALL' ? undefined : stage,
        },
      })
      return data.data as BatchRow[]
    },
  })

  const columns: ColumnDef<BatchRow>[] = useMemo(
    () => [
      {
        id: 'batchNumber',
        header: 'Batch #',
        accessorKey: 'batchNumber',
        cell: ({ row }) => {
          const b = row.original
          return (
            <div>
              <Link
                to={`/batches/${b.batchNumber}`}
                className="font-semibold text-xs text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1 font-mono"
              >
                {b.batchNumber}
                <ExternalLink className="size-3 text-zinc-400" />
              </Link>
              {b.location?.name && (
                <p className="text-[10px] text-zinc-400">{b.location.name}</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'stage',
        header: 'Stage',
        cell: ({ row }) => {
          const s = row.original.stage || row.original.batchType
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStageBadge(
                s
              )}`}
            >
              {s}
            </span>
          )
        },
      },
      {
        id: 'sortColor',
        header: 'Colour',
        cell: ({ row }) => {
          const c = colorName(row.original.sortColor)
          return c !== '—' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200/80">
              {c}
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          )
        },
      },
      {
        id: 'material',
        header: 'Material / Product',
        cell: ({ row }) => (
          <span className="font-medium text-xs text-zinc-800">
            {row.original.product?.name || row.original.material?.name || '—'}
          </span>
        ),
      },
      {
        id: 'qtyIn',
        header: 'Qty In',
        cell: ({ row }) => (
          <span className="tabular-nums text-xs text-zinc-600 font-medium">
            {fmtQty(row.original.qtyIn, row.original.uom)}
          </span>
        ),
      },
      {
        id: 'qtyRemaining',
        header: 'Available',
        cell: ({ row }) => {
          const rem = Number(row.original.qtyRemaining || 0)
          return (
            <span
              className={`tabular-nums font-semibold text-xs ${
                rem > 0 ? 'text-emerald-700' : 'text-zinc-400'
              }`}
            >
              {fmtQty(row.original.qtyRemaining, row.original.uom)}
            </span>
          )
        },
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => {
          const biz = formatBusinessDate(row.original.businessDate)
          return (
            <span className="text-xs text-zinc-500 tabular-nums">
              {biz || formatCreatedAt(row.original.createdAt)}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap"
              asChild
            >
              <Link
                to={`/batches/${row.original.batchNumber}`}
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Eye className="size-3.5 shrink-0" />
                <span>View</span>
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(q.trim())
  }

  const handleReset = () => {
    setQ('')
    setSearch('')
    setStage('ALL')
  }

  return (
    <PageLayout
      title="Batches"
      description="Complete trace and lifecycle of all lots from raw scrap to finished goods."
    >
      <div className="space-y-3">
        {/* Card Toolbar with Search and Filters */}
        <Card className="!p-0 overflow-hidden shadow-xs border border-zinc-200">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2.5 sm:p-3 border-b border-zinc-200/80 bg-zinc-50/70"
          >
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <Input
                type="text"
                className="pl-8 h-8 text-xs bg-white"
                placeholder="Batch number e.g. BAT-… or SCR-…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {/* Stage filter and Action Buttons */}
            <div className="flex items-center gap-2">
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs bg-white font-medium">
                  <SelectValue placeholder="All stages">
                    {STAGE_FILTERS.find((f) => f.value === stage)?.label || 'All stages'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STAGE_FILTERS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button type="submit" size="sm" className="h-8 px-3 text-xs font-semibold">
                Filter
              </Button>

              {(q || stage !== 'ALL' || search) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
                  title="Reset filters"
                >
                  <RotateCcw className="size-3.5 shrink-0" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </form>

          {/* Custom Table with 50 rows default */}
          <CustomTable1
            data={batches.data || []}
            columns={columns}
            loading={batches.isLoading}
          />
        </Card>
      </div>
    </PageLayout>
  )
}
export default BatchesPage
