import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  CheckCircle2,
  Search,
  X,
  AlertTriangle,
  Palette,
  Send,
  Cpu,
  ChevronDown,
  ChevronUp,
  PackageCheck,
} from 'lucide-react'
import { api } from '@/lib/api'
import { StatPill } from '@/components/ui'
import { PageLayout } from '@/components/PageLayout'
import CustomTable1 from '@/components/CustomTable1'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SORT_COLORS } from '@/lib/sortColors'

type BatchColorItem = {
  id: number
  color: string
  qtyCrushed?: number | string
  qtyWashed?: number | string
  qtyDried?: number | string
  notes?: string | null
}

type BatchItem = {
  id: number
  batchNumber: string
  batchType: string
  status: string
  qtyRemaining: number | string
  qtyIn?: number | string
  qtyOut?: number | string
  uom: string
  sortColor?: string | null
  businessDate?: string | null
  createdAt?: string
  updatedAt?: string
  notes?: string | null
  material?: { id: number; name: string; code?: string }
  location?: { id: number; name: string; code: string }
  colorItems?: BatchColorItem[]
}

type MasterItem = {
  id: number
  name: string
  code?: string
  machineType?: string
  isActive?: boolean
}

type ProductionRunRow = {
  id: number
  machineId?: number
  productId?: number
  status?: string
  operatorName?: string
  materialConsumed?: number | string
  qtyProduced?: number | string
  qtyGood?: number | string
  goodQuantity?: number | string
  rejectQuantity?: number | string
  runtimeMinutes?: number | string
  downtimeMinutes?: number | string
  createdAt?: string
  startedAt?: string
  endedAt?: string
  batch?: {
    id: number
    batchNumber: string
    status?: string
    sortColor?: string | null
  }
  inputBatch?: {
    id: number
    batchNumber: string
    sortColor?: string | null
    material?: { name: string }
  }
  machine?: { id: number; name: string; code?: string; machineType?: string }
  product?: { id: number; name: string; code?: string; uom?: string }
  shift?: { id: number; name: string; code?: string }
}

// Separated color item representation for store inventory
type StoreMaterialLine = {
  key: string
  batchId: number
  batchNumber: string
  batchType: string
  materialName: string
  color: string
  colorItemId?: number
  qtyRemaining: number
  uom: string
  receivedDate?: string
  batchItem: BatchItem
}

function colorName(code?: string | null) {
  if (!code) return '—'
  return SORT_COLORS.find((c) => c.code === code)?.name || code
}

function fmt(value: string | number | null | undefined, digits = 1) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { maximumFractionDigits: digits })
    : String(value)
}

function formatDate(raw?: string | null) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function ProductionStorePage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showActiveFloor, setShowActiveFloor] = useState(false)
  const [showFinishedGoods, setShowFinishedGoods] = useState(false)
  const [showColorStock, setShowColorStock] = useState(false)

  // Notifications
  const [successBanner, setSuccessBanner] = useState('')
  const [errorBanner, setErrorBanner] = useState('')

  // -------------------------------------------------------------
  // Data Queries
  // -------------------------------------------------------------
  const storeQuery = useQuery({
    queryKey: ['production-store'],
    queryFn: async () => {
      const { data } = await api.get('/production/store')
      return (data.data || []) as BatchItem[]
    },
  })

  const machinesQuery = useQuery({
    queryKey: ['machines'],
    queryFn: async () => {
      const { data } = await api.get('/machines')
      return (data.data || []) as MasterItem[]
    },
  })

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get('/masters/products')
      return (data.data || []) as MasterItem[]
    },
  })



  const runsQuery = useQuery({
    queryKey: ['production-runs'],
    queryFn: async () => {
      const { data } = await api.get('/production/runs')
      return (data.data || []) as ProductionRunRow[]
    },
    refetchInterval: 20_000,
  })

  const storeBatches = storeQuery.data || []
  const allRuns = runsQuery.data || []

  // Filter ONLY production machines
  const productionMachines = useMemo(() => {
    return (machinesQuery.data || []).filter((m) => {
      if (!m.machineType) return true
      const t = m.machineType.toUpperCase()
      return (
        t === 'PRODUCTION' ||
        t.includes('PROD') ||
        t.includes('INJECT') ||
        t.includes('BLOW') ||
        t.includes('MOULD')
      )
    })
  }, [machinesQuery.data])

  // Active runs currently on machines
  const activeFloorRuns = useMemo(() => {
    return allRuns.filter(
      (r) => r.status === 'IN_PROGRESS' || r.batch?.status === 'IN_PROGRESS'
    )
  }, [allRuns])

  // Completed production runs (Finished Goods)
  const finishedGoodsRuns = useMemo(() => {
    return allRuns.filter(
      (r) => r.status === 'COMPLETED' || r.batch?.status === 'COMPLETED'
    )
  }, [allRuns])

  // Color additive inventory (Masterbatch or Pigment)
  const colorBatches = useMemo(() => {
    return storeBatches.filter(
      (b) => b.batchType === 'MASTERBATCH' || b.batchType === 'PIGMENT'
    )
  }, [storeBatches])

  // Raw materials ready for machine issue (CRUSH, WASH, DRY, EXTRUSION)
  const rawMaterialBatches = useMemo(() => {
    return storeBatches.filter(
      (b) => b.batchType !== 'MASTERBATCH' && b.batchType !== 'PIGMENT'
    )
  }, [storeBatches])

  // -------------------------------------------------------------
  // SEPARATED COLOR LOTS: Flatten batches so each color is distinct
  // -------------------------------------------------------------
  const rawMaterialLines = useMemo<StoreMaterialLine[]>(() => {
    const lines: StoreMaterialLine[] = []
    for (const b of rawMaterialBatches) {
      if (b.colorItems && b.colorItems.length > 0) {
        const positiveItems = b.colorItems.filter(
          (c) => Number(c.qtyDried ?? c.qtyWashed ?? c.qtyCrushed ?? 0) > 0
        )
        if (positiveItems.length > 0) {
          for (const c of positiveItems) {
            lines.push({
              key: `${b.batchNumber}-${c.id}`,
              batchId: b.id,
              batchNumber: b.batchNumber,
              batchType: b.batchType,
              materialName: b.material?.name || b.batchType || 'Raw Material',
              color: c.color,
              colorItemId: c.id,
              qtyRemaining: Number(c.qtyDried ?? c.qtyWashed ?? c.qtyCrushed ?? 0),
              uom: b.uom || 'kg',
              receivedDate: b.businessDate || b.createdAt || b.updatedAt,
              batchItem: b,
            })
          }
          continue
        }
      }
      lines.push({
        key: `${b.batchNumber}-base`,
        batchId: b.id,
        batchNumber: b.batchNumber,
        batchType: b.batchType,
        materialName: b.material?.name || b.batchType || 'Raw Material',
        color: b.sortColor || 'Natural',
        qtyRemaining: Number(b.qtyRemaining || 0),
        uom: b.uom || 'kg',
        receivedDate: b.businessDate || b.createdAt || b.updatedAt,
        batchItem: b,
      })
    }
    // Newest received first
    lines.sort((a, b) => {
      const ta = a.receivedDate ? new Date(a.receivedDate).getTime() : 0
      const tb = b.receivedDate ? new Date(b.receivedDate).getTime() : 0
      return tb - ta
    })
    return lines
  }, [rawMaterialBatches])

  // Metrics
  const totalStoreKg = useMemo(
    () => rawMaterialLines.reduce((acc, l) => acc + l.qtyRemaining, 0),
    [rawMaterialLines]
  )

  const totalActiveFloorKg = useMemo(
    () => activeFloorRuns.reduce((acc, r) => acc + Number(r.materialConsumed || 0), 0),
    [activeFloorRuns]
  )

  const totalFinishedGoodsPcs = useMemo(
    () =>
      finishedGoodsRuns.reduce(
        (acc, r) => acc + Number(r.qtyGood || r.qtyProduced || r.goodQuantity || 0),
        0
      ),
    [finishedGoodsRuns]
  )

  const totalColorStockKg = useMemo(
    () => colorBatches.reduce((acc, b) => acc + Number(b.qtyRemaining || 0), 0),
    [colorBatches]
  )

  // -------------------------------------------------------------
  // Filtered lists
  // -------------------------------------------------------------
  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rawMaterialLines
    return rawMaterialLines.filter((l) => {
      const numMatch = l.batchNumber.toLowerCase().includes(q)
      const matMatch = l.materialName.toLowerCase().includes(q)
      const colMatch = l.color.toLowerCase().includes(q) || colorName(l.color).toLowerCase().includes(q)
      return numMatch || matMatch || colMatch
    })
  }, [rawMaterialLines, search])

  // -------------------------------------------------------------
  // MODAL STATE: ISSUE MATERIAL TO MACHINE
  // -------------------------------------------------------------
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
  const [issueMachineId, setIssueMachineId] = useState('')
  const [issueProductId, setIssueProductId] = useState('')

  // Multiple material lots (e.g. white + blue) in one issue
  type IssueMaterialLine = { id: string; lineKey: string; qty: string }
  const [issueMaterialLines, setIssueMaterialLines] = useState<IssueMaterialLine[]>([
    { id: '1', lineKey: '', qty: '0' },
  ])

  // Master Batch additive (amount & price)
  const [issueMasterBatchKg, setIssueMasterBatchKg] = useState('0')
  const [issueMasterBatchPricePerKg, setIssueMasterBatchPricePerKg] = useState('0')

  // Batching additive (amount & price)
  const [issueBatchingKg, setIssueBatchingKg] = useState('0')
  const [issueBatchingPricePerKg, setIssueBatchingPricePerKg] = useState('0')

  const [issueNotes, setIssueNotes] = useState('')
  const [isIssueSubmitting, setIsIssueSubmitting] = useState(false)
  const [issueModalError, setIssueModalError] = useState('')

  const lineByKey = useMemo(() => {
    const map = new Map<string, StoreMaterialLine>()
    for (const line of rawMaterialLines) map.set(line.key, line)
    return map
  }, [rawMaterialLines])

  const handleOpenIssueModal = (preselected?: StoreMaterialLine) => {
    setIssueModalError('')
    const firstKey = preselected?.key || ''
    setIssueMaterialLines([{ id: String(Date.now()), lineKey: firstKey, qty: '' }])
    setIssueMasterBatchKg('0')
    setIssueMasterBatchPricePerKg('0')
    setIssueBatchingKg('0')
    setIssueBatchingPricePerKg('0')
    setIssueMachineId(productionMachines[0] ? String(productionMachines[0].id) : '')
    setIssueProductId(productsQuery.data?.[0] ? String(productsQuery.data[0].id) : '')
    setIssueNotes('')
    setIsIssueModalOpen(true)
  }

  const handleExecuteIssueToMachine = async (e: React.FormEvent) => {
    e.preventDefault()
    setIssueModalError('')
    setErrorBanner('')
    setSuccessBanner('')

    if (!issueMachineId) {
      setIssueModalError('Please select a target production machine.')
      return
    }
    if (!issueProductId) {
      setIssueModalError('Please select the product to manufacture.')
      return
    }

    const materials: Array<{
      inputBatchNumber: string
      colorItemId?: number
      inputColor?: string
      materialConsumed: number
    }> = []

    for (const row of issueMaterialLines) {
      const line = lineByKey.get(row.lineKey)
      const qty = Number(row.qty)
      if (!line) {
        setIssueModalError('Select a material lot for every row.')
        return
      }
      if (!(qty > 0)) {
        setIssueModalError(`Enter quantity for ${colorName(line.color)} (${line.batchNumber}).`)
        return
      }
      if (qty > line.qtyRemaining + 0.001) {
        setIssueModalError(
          `Cannot issue ${qty} kg of ${colorName(line.color)}. Only ${line.qtyRemaining} kg available.`,
        )
        return
      }
      materials.push({
        inputBatchNumber: line.batchNumber,
        colorItemId: line.colorItemId || undefined,
        inputColor: line.color || undefined,
        materialConsumed: qty,
      })
    }

    if (!materials.length) {
      setIssueModalError('Add at least one material lot to issue.')
      return
    }

    setIsIssueSubmitting(true)
    try {
      const mbKg = Number(issueMasterBatchKg || 0)
      const mbPrice = Number(issueMasterBatchPricePerKg || 0)
      const batchingKg = Number(issueBatchingKg || 0)
      const batchingPrice = Number(issueBatchingPricePerKg || 0)
      const totalKg = materials.reduce((sum, m) => sum + m.materialConsumed, 0)

      const payload: Record<string, unknown> = {
        materials,
        machineId: Number(issueMachineId),
        productId: Number(issueProductId),
        materialConsumed: totalKg,
        masterbatchKg: mbKg > 0 ? mbKg : undefined,
        masterbatchPricePerKg: mbPrice > 0 ? mbPrice : undefined,
        batchingKg: batchingKg > 0 ? batchingKg : undefined,
        batchingPricePerKg: batchingPrice > 0 ? batchingPrice : undefined,
        colorCost: mbKg > 0 && mbPrice > 0 ? +(mbKg * mbPrice).toFixed(2) : undefined,
        notes: issueNotes.trim() || undefined,
      }

      const startRes = await api.post('/production/runs/start', payload)

      const targetMachine = productionMachines.find((m) => m.id === Number(issueMachineId))
      const materialSummary = materials
        .map((m) => {
          const line = rawMaterialLines.find(
            (l) => l.batchNumber === m.inputBatchNumber && (l.colorItemId || null) === (m.colorItemId || null),
          )
          return `${m.materialConsumed} kg ${colorName(line?.color || m.inputColor)}`
        })
        .join(' + ')

      setSuccessBanner(
        startRes.data?.addedToExisting
          ? `Added ${materialSummary} to running ${targetMachine?.name || 'machine'}.`
          : `Issued ${materialSummary} to ${targetMachine?.name || issueMachineId}.`,
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production-store'] }),
        queryClient.invalidateQueries({ queryKey: ['production-runs'] }),
        queryClient.invalidateQueries({ queryKey: ['production-inputs'] }),
      ])

      setIsIssueModalOpen(false)
      setShowActiveFloor(true)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { msg?: string; err?: string; errors?: Record<string, string> } } }
      const backendMsg =
        axiosErr.response?.data?.msg ||
        axiosErr.response?.data?.err ||
        (axiosErr.response?.data?.errors ? Object.values(axiosErr.response.data.errors).join(', ') : null)
      setIssueModalError(backendMsg || 'Failed to issue material to machine.')
    } finally {
      setIsIssueSubmitting(false)
    }
  }

  const activeRunForMachine = useMemo(() => {
    if (!issueMachineId) return null
    return (
      activeFloorRuns.find((r) => Number(r.machineId) === Number(issueMachineId)) || null
    )
  }, [activeFloorRuns, issueMachineId])



  // -------------------------------------------------------------
  // Table Columns: Raw Material in Store (Separated Color Lots)
  // -------------------------------------------------------------
  const storeColumns: ColumnDef<StoreMaterialLine>[] = useMemo(
    () => [
      {
        id: 'batchNumber',
        header: 'Lot',
        accessorKey: 'batchNumber',
        cell: ({ row }) => (
          <Link
            to={`/batches/${row.original.batchNumber}`}
            className="font-semibold text-xs text-[var(--accent-strong)] hover:underline font-mono"
          >
            {row.original.batchNumber}
          </Link>
        ),
      },
      {
        id: 'material',
        header: 'Material',
        accessorKey: 'materialName',
        cell: ({ row }) => (
          <span className="font-semibold text-xs text-zinc-900">{row.original.materialName}</span>
        ),
      },
      {
        id: 'color',
        header: 'Color',
        accessorKey: 'color',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-zinc-800">{colorName(row.original.color)}</span>
        ),
      },
      {
        id: 'qtyRemaining',
        header: 'Available',
        accessorKey: 'qtyRemaining',
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-emerald-700 text-xs">
            {fmt(row.original.qtyRemaining, 1)} kg
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2.5 text-xs font-semibold gap-1 bg-violet-600 hover:bg-violet-700 text-white shadow-xs"
            onClick={() => handleOpenIssueModal(row.original)}
          >
            <Send className="size-3" />
            Issue
          </Button>
        ),
      },
    ],
    []
  )

  // -------------------------------------------------------------
  // Table Columns: Issued Material on Machines (Active Floor)
  // -------------------------------------------------------------
  const floorColumns: ColumnDef<ProductionRunRow>[] = useMemo(
    () => [
      {
        id: 'machine',
        header: 'Machine',
        cell: ({ row }) => (
          <span className="font-semibold text-xs text-zinc-900">
            {row.original.machine?.name || `Machine #${row.original.machineId}`}
          </span>
        ),
      },
      {
        id: 'product',
        header: 'Product',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-800">
            {row.original.product?.name || '—'}
          </span>
        ),
      },
      {
        id: 'color',
        header: 'Color',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-700">
            {colorName(row.original.batch?.sortColor || row.original.inputBatch?.sortColor)}
          </span>
        ),
      },
      {
        id: 'materialConsumed',
        header: 'Issued',
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-blue-700 text-xs">
            {fmt(row.original.materialConsumed, 1)} kg
          </span>
        ),
      },
      {
        id: 'startedAt',
        header: 'When',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 tabular-nums">
            {formatDate(row.original.startedAt || row.original.createdAt)}
          </span>
        ),
      },
    ],
    []
  )

  // -------------------------------------------------------------
  // Table Columns: Produced Finished Goods Ready for Sales
  // -------------------------------------------------------------
  const finishedGoodsColumns: ColumnDef<ProductionRunRow>[] = useMemo(
    () => [
      {
        id: 'batchNumber',
        header: 'Lot',
        cell: ({ row }) => (
          <Link
            to={`/batches/${row.original.batch?.batchNumber}`}
            className="font-mono text-xs font-bold text-[var(--accent-strong)] hover:underline"
          >
            {row.original.batch?.batchNumber || `Run #${row.original.id}`}
          </Link>
        ),
      },
      {
        id: 'product',
        header: 'Product',
        cell: ({ row }) => (
          <span className="font-semibold text-xs text-zinc-900">
            {row.original.product?.name || 'Finished Product'}
          </span>
        ),
      },
      {
        id: 'color',
        header: 'Color',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-700">{colorName(row.original.batch?.sortColor)}</span>
        ),
      },
      {
        id: 'qtyGood',
        header: 'Qty',
        cell: ({ row }) => {
          const pcs = Number(row.original.qtyGood || row.original.qtyProduced || row.original.goodQuantity || 0)
          return (
            <span className="font-bold tabular-nums text-emerald-700 text-xs">
              {fmt(pcs, 0)} pcs
            </span>
          )
        },
      },
      {
        id: 'completedAt',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 tabular-nums">
            {formatDate(row.original.endedAt || row.original.createdAt)}
          </span>
        ),
      },
    ],
    []
  )

  // -------------------------------------------------------------
  // Table Columns: Colors & Additives
  // -------------------------------------------------------------
  const colorColumns: ColumnDef<BatchItem>[] = useMemo(
    () => [
      {
        id: 'batchNumber',
        header: 'Lot',
        accessorKey: 'batchNumber',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-zinc-900">
            {row.original.batchNumber}
          </span>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        accessorKey: 'batchType',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-700">
            {row.original.batchType === 'MASTERBATCH' ? 'Masterbatch' : 'Pigment'}
          </span>
        ),
      },
      {
        id: 'color',
        header: 'Color',
        accessorKey: 'sortColor',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-900">{colorName(row.original.sortColor)}</span>
        ),
      },
      {
        id: 'qtyRemaining',
        header: 'Stock',
        accessorKey: 'qtyRemaining',
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-violet-700 text-xs">
            {fmt(row.original.qtyRemaining, 2)} kg
          </span>
        ),
      },
    ],
    []
  )

  return (
    <PageLayout
      title="Material Store"
      description="Issue color lots to machines."
      actions={
        <Button
          type="button"
          className="gap-1.5 font-bold text-xs h-9 bg-violet-600 hover:bg-violet-700 text-white shadow-xs"
          onClick={() => handleOpenIssueModal()}
          disabled={rawMaterialLines.length === 0}
        >
          <Send className="size-3.5" />
          Issue
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <StatPill
            label="In store"
            value={`${fmt(totalStoreKg, 1)} kg`}
            tone="success"
          />
          <StatPill
            label="Color lots"
            value={String(rawMaterialLines.length)}
            tone={rawMaterialLines.length > 0 ? 'accent' : 'default'}
          />
        </div>

        {/* Notifications */}
        {successBanner && (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-900 border border-emerald-200 shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              type="button"
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer p-1"
              onClick={() => setSuccessBanner('')}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {errorBanner && (
          <div className="flex items-center justify-between rounded-xl bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-600 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              className="text-red-600 hover:text-red-900 cursor-pointer p-1"
              onClick={() => setErrorBanner('')}
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-zinc-900">Raw material</h2>
            <div className="flex items-center gap-2 text-xs">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
                <Input
                  type="text"
                  className="pl-8 text-xs h-8 w-full bg-white"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {colorBatches.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-zinc-600 gap-1"
                  onClick={() => setShowColorStock((prev) => !prev)}
                >
                  <Palette className="size-3.5 text-violet-600" />
                  Additives ({colorBatches.length})
                  {showColorStock ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </Button>
              )}
            </div>
          </div>

          {showColorStock && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 space-y-2">
              <span className="text-xs font-bold text-violet-950">
                Additives · {totalColorStockKg.toFixed(1)} kg
              </span>
              <CustomTable1
                data={colorBatches}
                columns={colorColumns}
                filter={false}
                loading={storeQuery.isLoading}
                card={true}
              />
            </div>
          )}

          <CustomTable1
            data={filteredLines}
            columns={storeColumns}
            filter={false}
            loading={storeQuery.isLoading}
            card={true}
          />
        </div>

        {activeFloorRuns.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-zinc-200">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
              onClick={() => setShowActiveFloor((prev) => !prev)}
            >
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <Cpu className="size-3.5 text-blue-600" />
                On machines ({activeFloorRuns.length} · {fmt(totalActiveFloorKg, 1)} kg)
              </span>
              {showActiveFloor ? <ChevronUp className="size-3 text-zinc-400" /> : <ChevronDown className="size-3 text-zinc-400" />}
            </button>
            {showActiveFloor && (
              <CustomTable1
                data={activeFloorRuns}
                columns={floorColumns}
                filter={false}
                loading={runsQuery.isLoading}
                card={true}
              />
            )}
          </div>
        )}

        {finishedGoodsRuns.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-zinc-200">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
              onClick={() => setShowFinishedGoods((prev) => !prev)}
            >
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <PackageCheck className="size-3.5 text-emerald-600" />
                Finished goods ({finishedGoodsRuns.length} · {fmt(totalFinishedGoodsPcs, 0)} pcs)
              </span>
              {showFinishedGoods ? <ChevronUp className="size-3 text-zinc-400" /> : <ChevronDown className="size-3 text-zinc-400" />}
            </button>
            {showFinishedGoods && (
              <CustomTable1
                data={finishedGoodsRuns}
                columns={finishedGoodsColumns}
                filter={false}
                loading={runsQuery.isLoading}
                card={true}
              />
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* MODAL: ISSUE MATERIAL TO MACHINE (CUSTOM SHADCN SELECTS)      */}
        {/* ============================================================= */}
        {isIssueModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="relative w-full max-w-md rounded-xl bg-white p-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
                <h2 className="text-sm font-bold text-zinc-900">Issue to machine</h2>
                <button
                  type="button"
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                  onClick={() => setIsIssueModalOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>

              {issueModalError && (
                <div className="mt-2.5 rounded-lg bg-red-50 p-2 text-xs text-red-700 border border-red-200">
                  {issueModalError}
                </div>
              )}

              <form className="mt-3 space-y-3" onSubmit={handleExecuteIssueToMachine}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Machine
                    </label>
                    <Select value={issueMachineId} onValueChange={setIssueMachineId}>
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Machine…" />
                      </SelectTrigger>
                      <SelectContent>
                        {productionMachines.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Product
                    </label>
                    <Select value={issueProductId} onValueChange={setIssueProductId}>
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue placeholder="Product…" />
                      </SelectTrigger>
                      <SelectContent>
                        {productsQuery.data?.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {activeRunForMachine ? (
                  <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                    Machine is running — material will add to the current run
                    {activeRunForMachine.batch?.batchNumber
                      ? ` (${activeRunForMachine.batch.batchNumber})`
                      : ''}
                    .
                  </p>
                ) : null}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="grid grid-cols-[1fr_5.5rem] gap-2 flex-1 pr-2">
                      <span className="text-[11px] font-semibold text-zinc-600">Color</span>
                      <span className="text-[11px] font-semibold text-zinc-600">KG</span>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-violet-700 hover:underline cursor-pointer shrink-0"
                      onClick={() =>
                        setIssueMaterialLines((prev) => [
                          ...prev,
                          { id: String(Date.now()), lineKey: '', qty: '' },
                        ])
                      }
                    >
                      + Add
                    </button>
                  </div>

                  {issueMaterialLines.map((row) => {
                    const selected = lineByKey.get(row.lineKey) || null
                    return (
                      <div key={row.id} className="flex items-center gap-1.5">
                        <div className="grid grid-cols-[1fr_5.5rem] gap-2 flex-1 min-w-0">
                          <Select
                            value={row.lineKey || undefined}
                            onValueChange={(val) =>
                              setIssueMaterialLines((prev) =>
                                prev.map((l) =>
                                  l.id === row.id ? { ...l, lineKey: val, qty: '' } : l,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue placeholder="Select color…" />
                            </SelectTrigger>
                            <SelectContent>
                              {rawMaterialLines.map((l) => (
                                <SelectItem key={l.key} value={l.key}>
                                  {colorName(l.color)} · {fmt(l.qtyRemaining, 1)} kg
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <input
                            type="number"
                            step="any"
                            min={0}
                            className="dgn-input font-semibold text-xs h-8"
                            placeholder="kg"
                            value={row.qty}
                            onChange={(e) =>
                              setIssueMaterialLines((prev) =>
                                prev.map((l) =>
                                  l.id === row.id ? { ...l, qty: e.target.value } : l,
                                ),
                              )
                            }
                          />
                        </div>
                        {issueMaterialLines.length > 1 ? (
                          <button
                            type="button"
                            className="text-zinc-400 hover:text-red-600 cursor-pointer shrink-0 p-1"
                            onClick={() =>
                              setIssueMaterialLines((prev) =>
                                prev.filter((l) => l.id !== row.id),
                              )
                            }
                          >
                            <X className="size-3.5" />
                          </button>
                        ) : (
                          <span className="w-5 shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
                      Masterbatch kg
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className="dgn-input text-xs h-8"
                      placeholder="0"
                      value={issueMasterBatchKg}
                      onChange={(e) => setIssueMasterBatchKg(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
                      MB ₦/kg
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className="dgn-input text-xs h-8"
                      placeholder="0"
                      value={issueMasterBatchPricePerKg}
                      onChange={(e) => setIssueMasterBatchPricePerKg(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
                      Batching kg
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className="dgn-input text-xs h-8"
                      placeholder="0"
                      value={issueBatchingKg}
                      onChange={(e) => setIssueBatchingKg(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-zinc-500 mb-0.5">
                      Batching ₦/kg
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className="dgn-input text-xs h-8"
                      placeholder="0"
                      value={issueBatchingPricePerKg}
                      onChange={(e) => setIssueBatchingPricePerKg(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsIssueModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isIssueSubmitting}
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-1.5"
                    size="sm"
                  >
                    <Send className="size-3.5" />
                    {isIssueSubmitting ? 'Issuing…' : 'Issue'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
