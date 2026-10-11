import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Printer, QrCode, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  StoreBatchLabelModal,
  type StoreLabelData,
} from '@/components/StoreBatchLabelModal'
import { SORT_COLORS } from '@/lib/sortColors'
import { formatBusinessDate } from '@/lib/dates'
import { batchVerifyUrl } from '@/lib/batchLabel'

type BatchColorItem = {
  color: string
  qtyCrushed?: number | string
  qtyWashed?: number | string
  qtyDried?: number | string
}

type StoreBatch = {
  id: number
  batchNumber: string
  batchType: string
  qtyRemaining: number | string
  qtyOut?: number | string
  qtyWaste?: number | string
  businessDate?: string | null
  sortColor?: string | null
  colorItems?: BatchColorItem[]
}

function colorName(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

function lineQty(item: BatchColorItem) {
  return Number(
    item.qtyDried != null
      ? item.qtyDried
      : item.qtyWashed != null
        ? item.qtyWashed
        : item.qtyCrushed || 0
  )
}

function toLabelData(row: StoreBatch): StoreLabelData {
  const colors = (row.colorItems || [])
    .map((item) => ({ color: item.color || null, qtyKg: lineQty(item) }))
    .filter((c) => c.qtyKg > 0.0001)

  if (!colors.length && row.sortColor) {
    colors.push({
      color: row.sortColor,
      qtyKg: Number(row.qtyRemaining || row.qtyOut || 0),
    })
  }

  const usableKg = colors.length
    ? +colors.reduce((s, c) => s + c.qtyKg, 0).toFixed(3)
    : Number(row.qtyRemaining || row.qtyOut || 0)

  return {
    batchNumber: row.batchNumber,
    businessDate: row.businessDate || null,
    colors,
    usableKg,
    wasteKg: Number(row.qtyWaste || 0),
    stageLabel:
      String(row.batchType || '').toUpperCase() === 'DRY'
        ? 'Re-crushing'
        : row.batchType || 'Store',
  }
}

export function StoreLabelsReprintPage() {
  const [q, setQ] = useState('')
  const [label, setLabel] = useState<StoreLabelData | null>(null)

  const store = useQuery({
    queryKey: ['production-store'],
    queryFn: async () => {
      const { data } = await api.get('/production/store')
      return (data.data || []) as StoreBatch[]
    },
  })

  const rows = useMemo(() => {
    const list = store.data || []
    const needle = q.trim().toLowerCase()
    if (!needle) return list
    return list.filter((b) => {
      const colors = (b.colorItems || []).map((c) => colorName(c.color)).join(' ')
      return (
        b.batchNumber.toLowerCase().includes(needle) ||
        colors.toLowerCase().includes(needle) ||
        String(b.businessDate || '').includes(needle) ||
        formatBusinessDate(b.businessDate).toLowerCase().includes(needle)
      )
    })
  }, [store.data, q])

  const columns = useMemo<ColumnDef<StoreBatch>[]>(
    () => [
      {
        id: 'batchNumber',
        header: 'Batch',
        accessorKey: 'batchNumber',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold">{row.original.batchNumber}</p>
            <p className="text-[10px] text-zinc-500">
              {formatBusinessDate(row.original.businessDate)}
            </p>
          </div>
        ),
      },
      {
        id: 'colors',
        header: 'Colours',
        cell: ({ row }) => {
          const items = row.original.colorItems || []
          if (!items.length) {
            return (
              <span className="text-xs font-semibold">
                {colorName(row.original.sortColor)}
              </span>
            )
          }
          return (
            <ul className="space-y-0.5 text-xs">
              {items
                .filter((i) => lineQty(i) > 0.0001)
                .map((i) => (
                  <li key={`${i.color}-${lineQty(i)}`} className="flex gap-2">
                    <span className="font-semibold">{colorName(i.color)}</span>
                    <span className="font-mono text-zinc-500">
                      {lineQty(i).toLocaleString()} kg
                    </span>
                  </li>
                ))}
            </ul>
          )
        },
      },
      {
        id: 'qty',
        header: 'Stock',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold tabular-nums text-emerald-700">
            {Number(row.original.qtyRemaining || 0).toLocaleString()} kg
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              asChild
            >
              <Link to={`/v/${encodeURIComponent(row.original.batchNumber)}`} target="_blank">
                <QrCode className="size-3.5" />
                Verify
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 text-xs font-semibold"
              onClick={() => setLabel(toLabelData(row.original))}
            >
              <Printer className="size-3.5" />
              Reprint
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <PageLayout
      title="Store labels"
      description="Reprint QR labels for material store batches. Scan opens the verify page with colour, batch, and date."
      actions={
        <Button type="button" variant="outline" size="sm" className="h-9 text-xs" asChild>
          <Link to="/production/store">Back to store</Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search batch, colour, date…"
            className="h-9 pl-8 text-sm"
          />
        </div>

        <p className="text-[11px] text-zinc-500">
          Verify URL pattern:{' '}
          <span className="font-mono text-zinc-700">
            {batchVerifyUrl('BATCH-NUMBER')}
          </span>
        </p>

        <CustomTable1
          data={rows}
          columns={columns}
          loading={store.isLoading}
        />
      </div>

      <StoreBatchLabelModal
        open={Boolean(label)}
        data={label}
        doneLabel="Close"
        onDone={() => setLabel(null)}
      />
    </PageLayout>
  )
}
