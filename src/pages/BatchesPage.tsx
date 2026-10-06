import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Search, Eye, RotateCcw } from 'lucide-react'
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
  buyKg?: number | null
  buyCost?: number | null
  buyPricePerKg?: number | null
  supplierName?: string | null
}

const STAGE_FILTERS = [
  { value: 'BUYING', label: 'Scrap buying' },
  { value: 'ALL', label: 'All lots' },
  { value: 'SCRAP', label: 'Still raw' },
  { value: 'CRUSH', label: 'Crushed' },
  { value: 'WASH', label: 'Washed' },
  { value: 'DRY', label: 'Dried' },
  { value: 'PROD', label: 'Finished goods' },
]

function colorName(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

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

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `₦${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function getStageBadge(stage?: string) {
  const s = (stage || '').toUpperCase()
  if (s.includes('SCRAP') || s === 'BUYING') return 'bg-amber-50 text-amber-800 border-amber-200'
  if (s === 'SORT' || s.includes('SORTED')) return 'bg-blue-50 text-blue-800 border-blue-200'
  if (s.includes('CRUSH')) return 'bg-purple-50 text-purple-800 border-purple-200'
  if (s.includes('WASH')) return 'bg-cyan-50 text-cyan-800 border-cyan-200'
  if (s.includes('DRY')) return 'bg-orange-50 text-orange-800 border-orange-200'
  if (s.includes('PROD') || s.includes('FINISHED')) return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  return 'bg-zinc-100 text-zinc-800 border-zinc-200'
}

export function BatchesPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('BUYING')
  const buying = stage === 'BUYING'

  const batches = useQuery({
    queryKey: ['batches', search, stage],
    queryFn: async () => {
      const { data } = await api.get('/batches', {
        params: {
          q: search || undefined,
          source: buying ? 'buying' : undefined,
          batchType: !buying && stage !== 'ALL' ? stage : undefined,
        },
      })
      return data.data as BatchRow[]
    },
  })

  const rows = batches.data || []

  const summary = useMemo(() => {
    const kg = rows.reduce((sum, row) => sum + Number(row.buyKg || 0), 0)
    const cost = rows.reduce((sum, row) => sum + Number(row.buyCost || 0), 0)
    return {
      count: rows.length,
      kg,
      cost,
      perKg: kg > 0 ? cost / kg : 0,
    }
  }, [rows])

  const columns: ColumnDef<BatchRow>[] = useMemo(
    () => [
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
        id: 'batchNumber',
        header: 'Batch',
        accessorKey: 'batchNumber',
        cell: ({ row }) => {
          const b = row.original
          return (
            <div>
              <Link
                to={`/batches/${b.batchNumber}`}
                className="font-semibold text-xs text-[var(--accent-strong)] hover:underline font-mono"
              >
                {b.batchNumber}
              </Link>
              {buying && b.supplierName && (
                <p className="text-[10px] text-zinc-400 truncate max-w-[160px]">{b.supplierName}</p>
              )}
              {!buying && b.location?.name && (
                <p className="text-[10px] text-zinc-400">{b.location.name}</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'material',
        header: buying ? 'Bought' : 'Material / Product',
        cell: ({ row }) => (
          <div>
            <span className="font-medium text-xs text-zinc-800">
              {row.original.product?.name || row.original.material?.name || '—'}
            </span>
            {buying && Number(row.original.buyKg) > 0 && (
              <p className="text-[11px] font-semibold text-emerald-700">
                {Number(row.original.buyKg).toLocaleString()} kg
              </p>
            )}
          </div>
        ),
      },
      ...(buying
        ? [
            {
              id: 'buyCost',
              header: 'Buy cost',
              cell: ({ row }) => (
                <div>
                  <span className="text-xs font-semibold tabular-nums text-zinc-900">
                    {money(row.original.buyCost)}
                  </span>
                  {Number(row.original.buyPricePerKg) > 0 && (
                    <p className="text-[10px] text-zinc-400">
                      {money(row.original.buyPricePerKg)}/kg
                    </p>
                  )}
                </div>
              ),
            } as ColumnDef<BatchRow>,
          ]
        : [
            {
              id: 'qtyIn',
              header: 'Qty In',
              cell: ({ row }) => (
                <span className="tabular-nums text-xs text-zinc-600 font-medium">
                  {fmtQty(row.original.qtyIn, row.original.uom)}
                </span>
              ),
            } as ColumnDef<BatchRow>,
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
            } as ColumnDef<BatchRow>,
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
            } as ColumnDef<BatchRow>,
          ]),
      {
        id: 'stage',
        header: 'Stage',
        cell: ({ row }) => {
          const s = row.original.stage || row.original.batchType
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStageBadge(
                s,
              )}`}
            >
              {s}
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
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap cursor-pointer"
              onClick={() => navigate(`/batches/${row.original.batchNumber}`)}
            >
              <Eye className="size-3.5 shrink-0" />
              <span>View</span>
            </Button>
          </div>
        ),
      },
    ],
    [navigate, buying],
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(q.trim())
  }

  const handleReset = () => {
    setQ('')
    setSearch('')
    setStage('BUYING')
  }

  return (
    <PageLayout
      title="Batches"
      description={
        buying
          ? 'Scrap we bought — totals on this page, process cost when you open a batch'
          : 'Lots by process stage. Scrap buying is the default view.'
      }
    >
      <div className="space-y-3">
        {buying && !batches.isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            <SummaryTile label="Buys" value={String(summary.count)} hint="Scrap tickets" />
            <SummaryTile
              label="Bought"
              value={`${summary.kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`}
              hint="Net weight"
            />
            <SummaryTile label="Spend" value={money(summary.cost)} hint="Total buy cost" />
            <SummaryTile
              label="Avg"
              value={summary.perKg > 0 ? `${money(summary.perKg)}/kg` : '—'}
              hint="Cost per kg"
            />
          </div>
        )}

        <Card className="!p-0 overflow-hidden shadow-xs border border-zinc-200">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-2.5 sm:p-3 border-b border-zinc-200/80 bg-zinc-50/70"
          >
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

            <div className="flex items-center gap-2">
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs bg-white font-medium">
                  <SelectValue placeholder="Scrap buying">
                    {STAGE_FILTERS.find((f) => f.value === stage)?.label || 'Scrap buying'}
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

              {(q || stage !== 'BUYING' || search) && (
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

          <CustomTable1
            data={rows}
            columns={columns}
            loading={batches.isLoading}
            card={true}
          />
        </Card>
      </div>
    </PageLayout>
  )
}

function SummaryTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-lg sm:rounded-xl border border-zinc-200/90 bg-white p-2.5 sm:p-3 shadow-xs">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-base sm:text-lg font-black text-zinc-900 tabular-nums tracking-tight truncate">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-zinc-400">{hint}</p>
    </div>
  )
}

export default BatchesPage
