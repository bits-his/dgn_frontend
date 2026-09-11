import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  CheckCircle2,
  Search,
  ExternalLink,
  X,
  AlertTriangle,
  Palette,
  Package,
  Send,
  Cpu,
  ArrowRight,
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
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ColorCombobox } from '@/components/ui/color-combobox'
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

function formatTime(raw?: string | null) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ProductionStorePage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showActiveFloor, setShowActiveFloor] = useState(true)
  const [showFinishedGoods, setShowFinishedGoods] = useState(true)
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

  const shiftsQuery = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data } = await api.get('/masters/shifts')
      return (data.data || []) as MasterItem[]
    },
  })

  const staffQuery = useQuery({
    queryKey: ['masters-employees'],
    queryFn: async () => {
      const { data } = await api.get('/masters/employees')
      return (data.data || []) as Array<{
        id: number
        firstname?: string
        lastname?: string
        employeeCode?: string
      }>
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
              receivedDate: b.updatedAt || b.createdAt,
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
        receivedDate: b.updatedAt || b.createdAt,
        batchItem: b,
      })
    }
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
  const [issueSelectedLineKey, setIssueSelectedLineKey] = useState('')
  const [issueMachineId, setIssueMachineId] = useState('')
  const [issueProductId, setIssueProductId] = useState('')
  const [issueQtyKg, setIssueQtyKg] = useState('')
  const [issueShiftId, setIssueShiftId] = useState('')
  const [issueOperatorName, setIssueOperatorName] = useState('')
  const [issueNotes, setIssueNotes] = useState('')

  // Color additive for run
  const [issueColorStrategy, setIssueColorStrategy] = useState<'natural' | 'master' | 'normal'>('natural')
  const [issueMasterbatchColor, setIssueMasterbatchColor] = useState('')
  const [issueMasterbatchKg, setIssueMasterbatchKg] = useState('')
  const [issueNormalColor, setIssueNormalColor] = useState('')

  const [isIssueSubmitting, setIsIssueSubmitting] = useState(false)
  const [issueModalError, setIssueModalError] = useState('')

  // Currently selected line in modal
  const selectedLineForIssue = useMemo(() => {
    return rawMaterialLines.find((l) => l.key === issueSelectedLineKey) || null
  }, [rawMaterialLines, issueSelectedLineKey])

  const handleOpenIssueModal = (preselected?: StoreMaterialLine) => {
    setIssueModalError('')
    if (preselected) {
      setIssueSelectedLineKey(preselected.key)
      setIssueQtyKg(String(preselected.qtyRemaining || ''))
    } else if (rawMaterialLines.length > 0) {
      const first = rawMaterialLines[0]
      setIssueSelectedLineKey(first.key)
      setIssueQtyKg(String(first.qtyRemaining || ''))
    } else {
      setIssueSelectedLineKey('')
      setIssueQtyKg('')
    }
    setIssueMachineId(productionMachines[0] ? String(productionMachines[0].id) : '')
    setIssueProductId(productsQuery.data?.[0] ? String(productsQuery.data[0].id) : '')
    setIssueShiftId(shiftsQuery.data?.[0] ? String(shiftsQuery.data[0].id) : '')
    setIssueOperatorName('')
    setIssueNotes('')
    setIssueColorStrategy('natural')
    setIssueMasterbatchColor('')
    setIssueMasterbatchKg('')
    setIssueNormalColor('')
    setIsIssueModalOpen(true)
  }

  const handleExecuteIssueToMachine = async (e: React.FormEvent) => {
    e.preventDefault()
    setIssueModalError('')
    setErrorBanner('')
    setSuccessBanner('')

    if (!selectedLineForIssue) {
      setIssueModalError('Please select a material batch lot from the store.')
      return
    }
    if (!issueMachineId) {
      setIssueModalError('Please select a target production machine.')
      return
    }
    if (!issueProductId) {
      setIssueModalError('Please select the product to manufacture.')
      return
    }
    const qty = Number(issueQtyKg)
    if (!(qty > 0)) {
      setIssueModalError('Please enter a valid quantity (kg) to issue.')
      return
    }
    const available = selectedLineForIssue.qtyRemaining
    if (qty > available + 0.001) {
      setIssueModalError(`Cannot issue ${qty} kg. Only ${available} kg available for this color lot.`)
      return
    }

    setIsIssueSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        inputBatchNumber: selectedLineForIssue.batchNumber,
        colorItemId: selectedLineForIssue.colorItemId || undefined,
        inputColor: selectedLineForIssue.color || undefined,
        machineId: Number(issueMachineId),
        productId: Number(issueProductId),
        shiftId: issueShiftId ? Number(issueShiftId) : undefined,
        operatorName: issueOperatorName.trim() || undefined,
        materialConsumed: qty,
        notes: issueNotes.trim() || undefined,
      }

      if (issueColorStrategy === 'master' && issueMasterbatchColor) {
        payload.colorType = 'master'
        payload.colorName = issueMasterbatchColor
        payload.masterbatchColor = issueMasterbatchColor
        if (issueMasterbatchKg) {
          payload.masterbatchKg = Number(issueMasterbatchKg)
        }
      } else if (issueColorStrategy === 'normal' && issueNormalColor) {
        payload.colorType = 'normal'
        payload.colorName = issueNormalColor
        payload.normalColorName = issueNormalColor
      }

      await api.post('/production/runs/start', payload)

      const targetMachine = productionMachines.find((m) => m.id === Number(issueMachineId))
      setSuccessBanner(
        `Successfully issued ${qty} kg of ${colorName(selectedLineForIssue.color)} from ${selectedLineForIssue.batchNumber} to Machine ${targetMachine?.name || issueMachineId}!`
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production-store'] }),
        queryClient.invalidateQueries({ queryKey: ['production-runs'] }),
        queryClient.invalidateQueries({ queryKey: ['production-inputs'] }),
      ])

      setIsIssueModalOpen(false)
      setShowActiveFloor(true)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string; errors?: Record<string, string> } } }
      const backendMsg =
        axiosErr.response?.data?.err ||
        (axiosErr.response?.data?.errors ? Object.values(axiosErr.response.data.errors).join(', ') : null)
      setIssueModalError(backendMsg || 'Failed to issue material to machine.')
    } finally {
      setIsIssueSubmitting(false)
    }
  }

  // -------------------------------------------------------------
  // MODAL STATE: ADD COLOR TO STORE
  // -------------------------------------------------------------
  const [isAddColorModalOpen, setIsAddColorModalOpen] = useState(false)
  const [colorType, setColorType] = useState<'master' | 'normal'>('master')
  const [colorNameInput, setColorNameInput] = useState('')
  const [colorQtyKg, setColorQtyKg] = useState('')
  const [colorCostPerKg, setColorCostPerKg] = useState('')
  const [colorNotes, setColorNotes] = useState('')
  const [colorError, setColorError] = useState('')
  const [isColorSubmitting, setIsColorSubmitting] = useState(false)

  const handleExecuteAddColorToStore = async (e: React.FormEvent) => {
    e.preventDefault()
    setColorError('')

    const qty = Number(colorQtyKg)
    if (!colorNameInput.trim()) {
      setColorError('Please choose or enter a color formulation name.')
      return
    }
    if (!(qty > 0)) {
      setColorError('Please enter a valid positive quantity in kilograms.')
      return
    }

    setIsColorSubmitting(true)
    try {
      const cost = colorCostPerKg ? Number(colorCostPerKg) : undefined
      await api.post('/production/store/add-color', {
        type: colorType,
        colorName: colorNameInput.trim(),
        qtyKg: qty,
        costPerKg: cost,
        notes: colorNotes || undefined,
      })

      setSuccessBanner(
        `Added ${qty} kg of ${colorNameInput} (${colorType === 'master' ? 'Masterbatch' : 'Normal Pigment'}) to Store!`
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production-store'] }),
        queryClient.invalidateQueries({ queryKey: ['production-store-colors'] }),
      ])

      setIsAddColorModalOpen(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string } } }
      setColorError(axiosErr.response?.data?.err || 'Failed to add color stock to store.')
    } finally {
      setIsColorSubmitting(false)
    }
  }

  // Options for SearchableSelect
  const materialLineOptions = useMemo(() => {
    return rawMaterialLines.map((l) => ({
      value: l.key,
      label: `${l.batchNumber} · ${colorName(l.color)} (${fmt(l.qtyRemaining, 1)} kg)`,
      sublabel: `${l.materialName} · Stage: ${l.batchType}`,
    }))
  }, [rawMaterialLines])

  const operatorOptions = useMemo(() => {
    return (staffQuery.data || []).map((s) => ({
      value: [s.firstname, s.lastname].filter(Boolean).join(' '),
      label: [s.firstname, s.lastname].filter(Boolean).join(' '),
      sublabel: s.employeeCode || '',
    }))
  }, [staffQuery.data])

  // -------------------------------------------------------------
  // Table Columns: Raw Material in Store (Separated Color Lots)
  // -------------------------------------------------------------
  const storeColumns: ColumnDef<StoreMaterialLine>[] = useMemo(
    () => [
      {
        id: 'batchNumber',
        header: 'Batch Lot',
        accessorKey: 'batchNumber',
        cell: ({ row }) => (
          <Link
            to={`/batches/${row.original.batchNumber}`}
            className="font-semibold text-xs text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1 font-mono"
          >
            {row.original.batchNumber}
            <ExternalLink className="size-3 text-zinc-400" />
          </Link>
        ),
      },
      {
        id: 'material',
        header: 'Material / Stage',
        accessorKey: 'materialName',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-semibold text-xs text-zinc-900">
              {row.original.materialName}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase font-medium">
              Stage: {row.original.batchType}
            </span>
          </div>
        ),
      },
      {
        id: 'color',
        header: 'Color / Lot',
        accessorKey: 'color',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
            <span className="size-2 rounded-full bg-violet-600" />
            {colorName(row.original.color)}
          </span>
        ),
      },
      {
        id: 'qtyRemaining',
        header: 'Available (kg)',
        accessorKey: 'qtyRemaining',
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-emerald-700 text-xs">
            {fmt(row.original.qtyRemaining, 1)}{' '}
            <span className="text-[11px] font-normal text-zinc-500">{row.original.uom}</span>
          </span>
        ),
      },
      {
        id: 'receivedDate',
        header: 'Received Date',
        accessorKey: 'receivedDate',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 tabular-nums">
            {formatDate(row.original.receivedDate)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2.5 text-xs font-semibold gap-1 bg-violet-600 hover:bg-violet-700 text-white shadow-xs"
            onClick={() => handleOpenIssueModal(row.original)}
          >
            <Send className="size-3" />
            <span>Issue to Machine</span>
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
        header: 'Production Machine',
        accessorKey: 'machine',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-100 text-blue-800 font-bold text-xs shrink-0">
              <Cpu className="size-3.5" />
            </div>
            <div>
              <span className="font-bold text-xs text-zinc-900 block">
                {row.original.machine?.name || `Machine #${row.original.machineId}`}
              </span>
              {row.original.machine?.code && (
                <span className="text-[10px] font-mono text-zinc-400">
                  {row.original.machine.code}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'product',
        header: 'Target Product',
        accessorKey: 'product',
        cell: ({ row }) => (
          <span className="font-semibold text-xs text-zinc-800">
            {row.original.product?.name || 'Finished Product'}
          </span>
        ),
      },
      {
        id: 'inputBatch',
        header: 'Issued Material Lot',
        cell: ({ row }) => {
          const inputNum = row.original.inputBatch?.batchNumber
          return inputNum ? (
            <Link
              to={`/batches/${inputNum}`}
              className="font-semibold text-xs text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1 font-mono"
            >
              {inputNum}
              <ExternalLink className="size-2.5 text-zinc-400" />
            </Link>
          ) : (
            <span className="text-zinc-400 text-xs">—</span>
          )
        },
      },
      {
        id: 'color',
        header: 'Color Blend',
        cell: ({ row }) => (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
            {colorName(row.original.batch?.sortColor || row.original.inputBatch?.sortColor)}
          </span>
        ),
      },
      {
        id: 'materialConsumed',
        header: 'Issued (kg)',
        accessorKey: 'materialConsumed',
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-blue-700 text-xs">
            {fmt(row.original.materialConsumed, 1)} kg
          </span>
        ),
      },
      {
        id: 'operator',
        header: 'Shift & Operator',
        cell: ({ row }) => (
          <div className="flex flex-col text-xs">
            <span className="font-medium text-zinc-900">
              {row.original.operatorName || 'Operator'}
            </span>
            <span className="text-[10px] text-zinc-400">
              {row.original.shift?.name || 'Shift'}
            </span>
          </div>
        ),
      },
      {
        id: 'startedAt',
        header: 'Issued Time',
        cell: ({ row }) => (
          <div className="text-xs text-zinc-600">
            <span className="block font-medium">
              {formatDate(row.original.startedAt || row.original.createdAt)}
            </span>
            <span className="text-[10px] text-zinc-400">
              {formatTime(row.original.startedAt || row.original.createdAt)}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Floor Status',
        cell: () => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            In Production
          </span>
        ),
      },
      {
        id: 'link',
        header: 'Action',
        cell: () => (
          <Link
            to="/production"
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900 hover:underline"
          >
            <span>Production Room</span>
            <ArrowRight className="size-3" />
          </Link>
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
        header: 'FG Lot #',
        cell: ({ row }) => (
          <Link
            to={`/batches/${row.original.batch?.batchNumber}`}
            className="font-mono text-xs font-bold text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
          >
            {row.original.batch?.batchNumber || `Run #${row.original.id}`}
            <ExternalLink className="size-2.5 text-zinc-400" />
          </Link>
        ),
      },
      {
        id: 'product',
        header: 'Manufactured Product',
        accessorKey: 'product',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-bold text-xs text-zinc-900">
              {row.original.product?.name || 'Finished Product'}
            </span>
            {row.original.product?.code && (
              <span className="text-[10px] font-mono text-zinc-400">
                {row.original.product.code}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'color',
        header: 'Product Color',
        cell: ({ row }) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
            {colorName(row.original.batch?.sortColor)}
          </span>
        ),
      },
      {
        id: 'qtyGood',
        header: 'Good Quantity',
        cell: ({ row }) => {
          const pcs = Number(row.original.qtyGood || row.original.qtyProduced || row.original.goodQuantity || 0)
          const dz = Math.floor(pcs / 12)
          const remPcs = pcs % 12
          return (
            <div className="flex flex-col text-xs">
              <span className="font-black tabular-nums text-emerald-700">
                {fmt(pcs, 0)} {row.original.product?.uom || 'pcs'}
              </span>
              {dz > 0 && (
                <span className="text-[10px] text-zinc-500 font-medium">
                  ({dz} dz {remPcs > 0 ? `${remPcs} pcs` : ''})
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: 'machine',
        header: 'Produced On',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-700 font-medium">
            {row.original.machine?.name || `Machine #${row.original.machineId}`}
          </span>
        ),
      },
      {
        id: 'completedAt',
        header: 'Production Date',
        cell: ({ row }) => (
          <div className="text-xs text-zinc-600">
            <span className="block font-medium">
              {formatDate(row.original.endedAt || row.original.createdAt)}
            </span>
            <span className="text-[10px] text-zinc-400">
              {row.original.shift?.name || ''}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Inventory State',
        cell: () => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <PackageCheck className="size-3" />
            Ready for Sales
          </span>
        ),
      },
      {
        id: 'salesAction',
        header: 'Action',
        cell: () => (
          <Link
            to="/sales/new"
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
          >
            <span>Create Sale</span>
            <ArrowRight className="size-3" />
          </Link>
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
        header: 'Stock Lot #',
        accessorKey: 'batchNumber',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-zinc-900">
            {row.original.batchNumber}
          </span>
        ),
      },
      {
        id: 'type',
        header: 'Formulation Type',
        accessorKey: 'batchType',
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
              row.original.batchType === 'MASTERBATCH'
                ? 'bg-violet-100 text-violet-800 border border-violet-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            {row.original.batchType === 'MASTERBATCH' ? 'Masterbatch Pellets' : 'Normal Pigment'}
          </span>
        ),
      },
      {
        id: 'color',
        header: 'Color Shade',
        accessorKey: 'sortColor',
        cell: ({ row }) => (
          <span className="font-semibold text-xs text-zinc-900">
            {colorName(row.original.sortColor)}
          </span>
        ),
      },
      {
        id: 'qtyRemaining',
        header: 'In Stock (kg)',
        accessorKey: 'qtyRemaining',
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-violet-700 text-xs">
            {fmt(row.original.qtyRemaining, 2)} kg
          </span>
        ),
      },
      {
        id: 'updatedAt',
        header: 'Date Added',
        accessorKey: 'updatedAt',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 tabular-nums">
            {formatDate(row.original.updatedAt || row.original.createdAt)}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <PageLayout
      title="Material Store"
      description="Central inventory control: manage separated color flake lots, additives, finished goods, and issue directly to production machines."
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 font-semibold text-xs h-9"
            onClick={() => {
              setColorType('master')
              setColorNameInput('')
              setColorQtyKg('')
              setColorCostPerKg('')
              setColorNotes('')
              setColorError('')
              setIsAddColorModalOpen(true)
            }}
          >
            <Palette className="size-3.5 text-violet-600" />
            <span>+ Add Color<span className="hidden sm:inline"> Additive</span></span>
          </Button>

          <Button
            type="button"
            className="gap-1.5 font-bold text-xs h-9 bg-violet-600 hover:bg-violet-700 text-white shadow-xs"
            onClick={() => handleOpenIssueModal()}
            disabled={rawMaterialLines.length === 0}
          >
            <Send className="size-3.5" />
            <span>Issue to Machine</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* KPI Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatPill
            label="Raw Material in Store"
            value={`${fmt(totalStoreKg, 1)} kg`}
            tone="success"
          />
          <StatPill
            label="Separated Color Lots"
            value={String(rawMaterialLines.length)}
            tone={rawMaterialLines.length > 0 ? 'accent' : 'default'}
          />
          <StatPill
            label="Active on Machines"
            value={`${fmt(totalActiveFloorKg, 1)} kg`}
            tone={activeFloorRuns.length > 0 ? 'accent' : 'default'}
          />
          <StatPill
            label="Finished Goods in Store"
            value={`${fmt(totalFinishedGoodsPcs, 0)} pcs`}
            tone="success"
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

        {/* ============================================================= */}
        {/* 1. RAW MATERIAL INVENTORY (SEPARATED BY INDIVIDUAL COLOR LOT)  */}
        {/* ============================================================= */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">
                Raw Material Lots in Store (Separated Colors)
              </h2>
              <p className="text-xs text-zinc-500">
                Available colored flakes ready to be issued to production machines.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
                <Input
                  type="text"
                  className="pl-8 text-xs h-8 w-full bg-white"
                  placeholder="Search batch, color, material…"
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
                  <span>Additives ({colorBatches.length})</span>
                  {showColorStock ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </Button>
              )}
            </div>
          </div>

          {/* Color stock drawer if toggled */}
          {showColorStock && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-violet-950 flex items-center gap-1.5">
                  <Palette className="size-3.5 text-violet-600" />
                  Masterbatch & Pigment Additive Stock ({totalColorStockKg.toFixed(1)} kg)
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white text-violet-700"
                  onClick={() => {
                    setColorType('master')
                    setColorNameInput('')
                    setColorQtyKg('')
                    setColorCostPerKg('')
                    setColorNotes('')
                    setColorError('')
                    setIsAddColorModalOpen(true)
                  }}
                >
                  + Stock Additive
                </Button>
              </div>
              <CustomTable1
                data={colorBatches}
                columns={colorColumns}
                filter={false}
                loading={storeQuery.isLoading}
                card={true}
              />
            </div>
          )}

          {/* Main Raw Materials by Color Table */}
          <CustomTable1
            data={filteredLines}
            columns={storeColumns}
            filter={false}
            loading={storeQuery.isLoading}
            card={true}
          />
        </div>

        {/* ============================================================= */}
        {/* 2. ACTIVE MATERIAL ON PRODUCTION MACHINES (FLOOR TRACKING)    */}
        {/* ============================================================= */}
        {activeFloorRuns.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-zinc-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-blue-600 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-zinc-900">
                    Material Active on Machines ({activeFloorRuns.length} running · {fmt(totalActiveFloorKg, 1)} kg)
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Raw material issued from store currently being manufactured on factory machines.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/production"
                  className="text-xs font-bold text-blue-700 hover:underline shrink-0"
                >
                  Go to Production →
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-zinc-500"
                  onClick={() => setShowActiveFloor((prev) => !prev)}
                >
                  {showActiveFloor ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </Button>
              </div>
            </div>

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

        {/* ============================================================= */}
        {/* 3. FINISHED GOODS PRODUCED (READY FOR WAREHOUSE & SALES)      */}
        {/* ============================================================= */}
        {finishedGoodsRuns.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-zinc-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck className="size-4 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="text-xs font-bold text-zinc-900">
                    Produced Finished Goods ({finishedGoodsRuns.length} lots · {fmt(totalFinishedGoodsPcs, 0)} pcs in store)
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Finished items manufactured by production, received back into store, and ready for sales dispatch.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/sales"
                  className="text-xs font-bold text-emerald-700 hover:underline shrink-0"
                >
                  Go to Sales →
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-zinc-500"
                  onClick={() => setShowFinishedGoods((prev) => !prev)}
                >
                  {showFinishedGoods ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </Button>
              </div>
            </div>

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-violet-100 text-violet-800">
                    <Send className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">Issue Material to Machine</h2>
                    <p className="text-[11px] text-zinc-500">
                      Release raw material from store inventory to a factory production machine.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                  onClick={() => setIsIssueModalOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>

              {issueModalError && (
                <div className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 flex items-center gap-2">
                  <AlertTriangle className="size-4 text-red-600 shrink-0" />
                  <span>{issueModalError}</span>
                </div>
              )}

              <form className="mt-3 space-y-3.5" onSubmit={handleExecuteIssueToMachine}>
                {/* 1. Pick Material Batch & Color Lot with SearchableSelect */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Select Material & Color Lot <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    size="sm"
                    value={issueSelectedLineKey}
                    onChange={(val) => {
                      setIssueSelectedLineKey(val)
                      const found = rawMaterialLines.find((l) => l.key === val)
                      if (found) {
                        setIssueQtyKg(String(found.qtyRemaining || ''))
                      }
                    }}
                    options={materialLineOptions}
                    placeholder="Choose material lot & color…"
                    searchPlaceholder="Search batch lot number, material, or color…"
                  />

                  {/* Selected Batch Details Callout */}
                  {selectedLineForIssue && (
                    <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50/90 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-700">Selected Lot:</span>
                        <span className="font-mono font-bold text-zinc-900">
                          {selectedLineForIssue.batchNumber}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">Color Shade:</span>
                        <span className="inline-flex items-center gap-1 font-bold text-violet-800 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">
                          <span className="size-1.5 rounded-full bg-violet-600" />
                          {colorName(selectedLineForIssue.color)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-zinc-500">Available in Lot:</span>
                        <span className="font-bold font-mono text-emerald-700">
                          {fmt(selectedLineForIssue.qtyRemaining, 1)} {selectedLineForIssue.uom}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Target Production Machine & Product using custom Select */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Production Machine <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={issueMachineId}
                      onValueChange={(val) => setIssueMachineId(val)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white font-medium">
                        <SelectValue placeholder="Choose machine…" />
                      </SelectTrigger>
                      <SelectContent>
                        {productionMachines.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.name} {m.code ? `(${m.code})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Product to Produce <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={issueProductId}
                      onValueChange={(val) => setIssueProductId(val)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white font-medium">
                        <SelectValue placeholder="Choose product…" />
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

                {/* 3. Quantity to Issue (kg) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-zinc-700">
                      Quantity to Issue (kg) <span className="text-red-500">*</span>
                    </label>
                    {selectedLineForIssue && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="text-[10px] font-bold text-violet-700 hover:underline cursor-pointer"
                          onClick={() => setIssueQtyKg(String(selectedLineForIssue.qtyRemaining || ''))}
                        >
                          Max ({fmt(selectedLineForIssue.qtyRemaining, 1)} kg)
                        </button>
                        <span className="text-zinc-300">·</span>
                        <button
                          type="button"
                          className="text-[10px] font-bold text-violet-700 hover:underline cursor-pointer"
                          onClick={() => {
                            const half = selectedLineForIssue.qtyRemaining / 2
                            setIssueQtyKg(String(half > 0 ? half.toFixed(1) : ''))
                          }}
                        >
                          50%
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    step="any"
                    min={0.1}
                    max={Number(selectedLineForIssue?.qtyRemaining || 999999)}
                    required
                    className="dgn-input font-bold text-sm"
                    placeholder="e.g. 50"
                    value={issueQtyKg}
                    onChange={(e) => setIssueQtyKg(e.target.value)}
                  />
                </div>

                {/* 4. Shift & Operator using custom Selects */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Production Shift
                    </label>
                    <Select
                      value={issueShiftId}
                      onValueChange={(val) => setIssueShiftId(val)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white font-medium">
                        <SelectValue placeholder="Select shift…" />
                      </SelectTrigger>
                      <SelectContent>
                        {shiftsQuery.data?.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Machine Operator
                    </label>
                    <SearchableSelect
                      size="sm"
                      value={issueOperatorName}
                      onChange={(val) => setIssueOperatorName(val)}
                      options={operatorOptions}
                      placeholder="Select staff…"
                      searchPlaceholder="Search operator name…"
                    />
                  </div>
                </div>

                {/* 5. Color Formulation / Additive */}
                <div className="rounded-xl border border-zinc-200 p-3 bg-zinc-50/50 space-y-2.5">
                  <label className="block text-xs font-semibold text-zinc-800">
                    Color & Additives Strategy
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      className={`p-2 rounded-lg border text-left transition cursor-pointer text-xs ${
                        issueColorStrategy === 'natural'
                          ? 'border-violet-600 bg-violet-50 text-violet-950 font-bold ring-1 ring-violet-500'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                      onClick={() => setIssueColorStrategy('natural')}
                    >
                      <span>Lot Color ({colorName(selectedLineForIssue?.color)})</span>
                    </button>

                    <button
                      type="button"
                      className={`p-2 rounded-lg border text-left transition cursor-pointer text-xs ${
                        issueColorStrategy === 'master'
                          ? 'border-violet-600 bg-violet-50 text-violet-950 font-bold ring-1 ring-violet-500'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                      onClick={() => setIssueColorStrategy('master')}
                    >
                      <span>+ Masterbatch</span>
                    </button>

                    <button
                      type="button"
                      className={`p-2 rounded-lg border text-left transition cursor-pointer text-xs ${
                        issueColorStrategy === 'normal'
                          ? 'border-violet-600 bg-violet-50 text-violet-950 font-bold ring-1 ring-violet-500'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                      onClick={() => setIssueColorStrategy('normal')}
                    >
                      <span>+ Pigment</span>
                    </button>
                  </div>

                  {issueColorStrategy === 'master' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                          Masterbatch Color
                        </label>
                        <ColorCombobox
                          value={issueMasterbatchColor}
                          onChange={(c) => setIssueMasterbatchColor(c)}
                          placeholder="Select masterbatch…"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                          Additive Amount (kg)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min={0.1}
                          className="dgn-input text-xs"
                          placeholder="e.g. 2.5"
                          value={issueMasterbatchKg}
                          onChange={(e) => setIssueMasterbatchKg(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {issueColorStrategy === 'normal' && (
                    <div className="pt-1">
                      <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                        Pigment Color Name
                      </label>
                      <ColorCombobox
                        value={issueNormalColor}
                        onChange={(c) => setIssueNormalColor(c)}
                        placeholder="Select pigment color…"
                      />
                    </div>
                  )}
                </div>

                {/* 6. Notes */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Store Dispatch Notes (Optional)
                  </label>
                  <input
                    type="text"
                    className="dgn-input text-xs"
                    placeholder="e.g. Issued to Machine 2 for morning production batch..."
                    value={issueNotes}
                    onChange={(e) => setIssueNotes(e.target.value)}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
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
                    {isIssueSubmitting ? 'Issuing to Machine…' : 'Confirm & Issue to Machine'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* MODAL: ADD COLOR (MASTERBATCH / PIGMENT) TO STORE             */}
        {/* ============================================================= */}
        {isAddColorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-800">
                    <Palette className="size-3.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">Add Color to Store</h2>
                    <p className="text-[11px] text-zinc-500">
                      Stock Masterbatch pellets or Normal Pigment powder directly into the store.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                  onClick={() => setIsAddColorModalOpen(false)}
                >
                  <X className="size-4" />
                </button>
              </div>

              {colorError && (
                <div className="mt-2.5 rounded-xl bg-red-50 p-2 text-xs text-red-700 border border-red-200 flex items-center gap-2">
                  <AlertTriangle className="size-3.5 text-red-600 shrink-0" />
                  <span>{colorError}</span>
                </div>
              )}

              <form className="mt-3 space-y-3" onSubmit={handleExecuteAddColorToStore}>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Color Formulation Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        colorType === 'master'
                          ? 'border-violet-500 bg-violet-50 text-violet-950 font-bold ring-1 ring-violet-400'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                      onClick={() => setColorType('master')}
                    >
                      <span className="block text-xs font-semibold">Masterbatch</span>
                      <span className="block text-[10px] text-zinc-500">Concentrated pellets</span>
                    </button>

                    <button
                      type="button"
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        colorType === 'normal'
                          ? 'border-violet-500 bg-violet-50 text-violet-950 font-bold ring-1 ring-violet-400'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                      onClick={() => setColorType('normal')}
                    >
                      <span className="block text-xs font-semibold">Normal Pigment</span>
                      <span className="block text-[10px] text-zinc-500">Standard powder / dye</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Batch Color
                  </label>
                  <ColorCombobox
                    value={colorNameInput}
                    onChange={(col) => setColorNameInput(col)}
                    placeholder="Search and select color…"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Select a standard color preset or type a custom color formulation name.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Quantity (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      min={0.01}
                      className="dgn-input font-bold"
                      placeholder="e.g. 50"
                      value={colorQtyKg}
                      onChange={(e) => setColorQtyKg(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Cost per kg (₦)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className="dgn-input"
                      placeholder="e.g. 3500"
                      value={colorCostPerKg}
                      onChange={(e) => setColorCostPerKg(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    className="dgn-input text-xs"
                    placeholder="e.g. Received from supplier XYZ, batch code #449..."
                    value={colorNotes}
                    onChange={(e) => setColorNotes(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddColorModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isColorSubmitting}
                    className="bg-violet-700 hover:bg-violet-800 text-white font-semibold gap-1.5"
                    size="sm"
                  >
                    <Package className="size-3.5" />
                    {isColorSubmitting ? 'Adding…' : 'Add to Store'}
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
