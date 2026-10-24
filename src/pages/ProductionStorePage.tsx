import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  History,
  Blend,
  RotateCcw,
  FileX,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SORT_COLORS } from '@/lib/sortColors'
import { materialKindLabel } from '@/lib/materialLabels'

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
  material?: { id: number; name: string; code?: string | null }
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
  fromDamage?: boolean
  batchItem: BatchItem
  additiveKind?: 'masterbatch' | 'virgin' | 'pigment' | null
  displayLabel?: string
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showActiveFloor, setShowActiveFloor] = useState(false)
  const [showFinishedGoods, setShowFinishedGoods] = useState(false)
  const [showColorStock, setShowColorStock] = useState(false)
  const [showMixStock, setShowMixStock] = useState(false)

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

  const ADDITIVE_CODES = new Set(['MAT-MASTERBATCH', 'MAT-VIRGIN', 'MAT-PIGMENT'])

  const isAdditiveBatch = (b: BatchItem) => {
    const code = b.material?.code || ''
    if (ADDITIVE_CODES.has(code)) return true
    const sort = String(b.sortColor || '')
    return (
      sort.includes('(Masterbatch)') ||
      sort.includes('(Virgin)') ||
      sort.includes('(Normal Pigment)')
    )
  }

  // Purchased additives (masterbatch / virgin / pigment)
  const colorBatches = useMemo(() => {
    return storeBatches.filter(isAdditiveBatch)
  }, [storeBatches])

  // Recycled/process lots (exclude purchased additives from main store table metrics)
  const rawMaterialBatches = useMemo(() => {
    return storeBatches.filter((b) => !isAdditiveBatch(b))
  }, [storeBatches])

  function additiveKindOf(b: BatchItem): StoreMaterialLine['additiveKind'] {
    const code = b.material?.code || ''
    const sort = String(b.sortColor || '')
    if (code === 'MAT-VIRGIN' || sort.includes('(Virgin)')) return 'virgin'
    if (code === 'MAT-MASTERBATCH' || sort.includes('(Masterbatch)')) return 'masterbatch'
    if (code === 'MAT-PIGMENT' || sort.includes('(Normal Pigment)')) return 'pigment'
    return null
  }

  function additiveDisplayName(b: BatchItem) {
    return String(b.sortColor || b.material?.name || 'Additive')
      .replace(/\s*\((Masterbatch|Normal Pigment|Virgin)\)/i, '')
      .trim()
  }

  // -------------------------------------------------------------
  // Color select lines: process colors + purchased masterbatch/virgin
  // -------------------------------------------------------------
  const rawMaterialLines = useMemo<StoreMaterialLine[]>(() => {
    const lines: StoreMaterialLine[] = []
    for (const b of rawMaterialBatches) {
      if (b.colorItems && b.colorItems.length > 0) {
        const positiveItems = b.colorItems.filter(
          (c) => Number(c.qtyDried ?? c.qtyWashed ?? c.qtyCrushed ?? 0) > 0
        )
        const itemsToUse = positiveItems.length > 0 ? positiveItems : b.colorItems
        for (const c of itemsToUse) {
          const label = colorName(c.color)
          lines.push({
            key: `${b.batchNumber}-${c.id}`,
            batchId: b.id,
            batchNumber: b.batchNumber,
            batchType: b.batchType,
            materialName: materialKindLabel({
              batchType: b.batchType,
              materialName: b.material?.name,
            }),
            color: c.color,
            colorItemId: c.id,
            qtyRemaining: Number(c.qtyDried ?? c.qtyWashed ?? c.qtyCrushed ?? 0),
            uom: b.uom || 'kg',
            receivedDate: b.businessDate || b.createdAt || b.updatedAt,
            fromDamage:
              b.batchType === 'DAMAGED' ||
              String(b.notes || '').includes('production damage'),
            batchItem: b,
            additiveKind: null,
            displayLabel: label,
          })
        }
        continue
      }
      const label = colorName(b.sortColor) || b.sortColor || 'Natural'
      lines.push({
        key: `${b.batchNumber}-base`,
        batchId: b.id,
        batchNumber: b.batchNumber,
        batchType: b.batchType,
        materialName: materialKindLabel({
          batchType: b.batchType,
          materialName: b.material?.name,
        }),
        color: b.sortColor || 'Natural',
        qtyRemaining: Number(b.qtyRemaining || 0),
        uom: b.uom || 'kg',
        receivedDate: b.businessDate || b.createdAt || b.updatedAt,
        fromDamage:
          b.batchType === 'DAMAGED' || String(b.notes || '').includes('production damage'),
        batchItem: b,
        additiveKind: null,
        displayLabel: label,
      })
    }

    for (const b of colorBatches) {
      const kind = additiveKindOf(b)
      const name = additiveDisplayName(b)
      const kindLabel =
        kind === 'virgin' ? 'Virgin' : kind === 'masterbatch' ? 'Masterbatch' : 'Pigment'
      lines.push({
        key: `${b.batchNumber}-additive`,
        batchId: b.id,
        batchNumber: b.batchNumber,
        batchType: b.batchType,
        materialName: kindLabel,
        color: b.sortColor || name,
        qtyRemaining: Number(b.qtyRemaining || 0),
        uom: b.uom || 'kg',
        receivedDate: b.businessDate || b.createdAt || b.updatedAt,
        batchItem: b,
        additiveKind: kind,
        displayLabel: `${kindLabel} · ${name}`,
      })
    }

    lines.sort((a, b) => {
      const aHasStock = a.qtyRemaining > 0.0001 ? 1 : 0
      const bHasStock = b.qtyRemaining > 0.0001 ? 1 : 0
      if (aHasStock !== bHasStock) return bHasStock - aHasStock
      const ta = a.receivedDate ? new Date(a.receivedDate).getTime() : 0
      const tb = b.receivedDate ? new Date(b.receivedDate).getTime() : 0
      return tb - ta
    })
    return lines
  }, [rawMaterialBatches, colorBatches])

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

  type MixLineDraft = { id: string; lineKey: string; qty: string }
  type StoreMixRow = {
    id: number
    mixNumber: string
    batchNumber: string
    sortColor: string
    totalKg: number
    qtyRemaining: number
    lines: Array<{ id: number; batchNumber: string; color: string | null; qtyKg: number }>
  }

  const mixesQuery = useQuery({
    queryKey: ['production-store-mixes'],
    queryFn: async () => {
      const { data } = await api.get('/production/store/mixes')
      return (data.data || []) as StoreMixRow[]
    },
    refetchInterval: 20_000,
  })
  const availableMixes = mixesQuery.data || []

  // -------------------------------------------------------------
  // MODAL STATE: MIX + ISSUE
  // -------------------------------------------------------------
  const [isMixModalOpen, setIsMixModalOpen] = useState(false)
  const [mixLines, setMixLines] = useState<MixLineDraft[]>([
    { id: '1', lineKey: '', qty: '' },
  ])
  const [mixNotes, setMixNotes] = useState('')
  const [isMixSubmitting, setIsMixSubmitting] = useState(false)
  const [mixModalError, setMixModalError] = useState('')

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false)
  const [issueMachineId, setIssueMachineId] = useState('')
  const [issueProductId, setIssueProductId] = useState('')
  const [issueMixId, setIssueMixId] = useState('')
  const [issueKg, setIssueKg] = useState('')
  const [issueNotes, setIssueNotes] = useState('')
  const [isIssueSubmitting, setIsIssueSubmitting] = useState(false)
  const [issueModalError, setIssueModalError] = useState('')

  const lineByKey = useMemo(() => {
    const map = new Map<string, StoreMaterialLine>()
    for (const line of rawMaterialLines) map.set(line.key, line)
    return map
  }, [rawMaterialLines])

  const selectedIssueMix = useMemo(
    () => availableMixes.find((m) => String(m.id) === issueMixId) || null,
    [availableMixes, issueMixId],
  )

  const handleOpenMixModal = (preselected?: StoreMaterialLine) => {
    setMixModalError('')
    const initialKey = preselected && preselected.qtyRemaining > 0 ? preselected.key : ''
    setMixLines([
      {
        id: String(Date.now()),
        lineKey: initialKey,
        qty: '',
      },
    ])
    setMixNotes('')
    setIsMixModalOpen(true)
  }

  const handleCreateMix = async (e: React.FormEvent) => {
    e.preventDefault()
    setMixModalError('')
    setErrorBanner('')
    setSuccessBanner('')

    const materials: Array<{
      inputBatchNumber: string
      colorItemId?: number
      inputColor?: string
      materialConsumed: number
    }> = []

    for (const row of mixLines) {
      const line = lineByKey.get(row.lineKey)
      const qty = Number(row.qty)
      if (!line) {
        setMixModalError('Select a material lot for every row.')
        return
      }
      if (!(qty > 0)) {
        setMixModalError(
          `Enter quantity for ${line.displayLabel || colorName(line.color)} (${line.batchNumber}).`,
        )
        return
      }
      if (qty > line.qtyRemaining + 0.001) {
        setMixModalError(
          `Cannot mix ${qty} kg of ${line.displayLabel || colorName(line.color)}. Only ${line.qtyRemaining} kg available.`,
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
      setMixModalError('Add at least one lot to mix.')
      return
    }

    setIsMixSubmitting(true)
    try {
      const { data } = await api.post('/production/store/mixes', {
        lines: materials,
        notes: mixNotes.trim() || undefined,
      })
      const mixNumber = data.data?.mixNumber || 'mix'
      const totalKg = data.data?.totalKg
      setSuccessBanner(
        data.message ||
          `Created ${mixNumber}${totalKg != null ? ` · ${fmt(totalKg, 1)} kg` : ''}`,
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production-store'] }),
        queryClient.invalidateQueries({ queryKey: ['production-store-colors'] }),
        queryClient.invalidateQueries({ queryKey: ['production-store-mixes'] }),
      ])
      setIsMixModalOpen(false)
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { msg?: string; err?: string; errors?: Record<string, string> } }
      }
      const backendMsg =
        axiosErr.response?.data?.msg ||
        axiosErr.response?.data?.err ||
        (axiosErr.response?.data?.errors
          ? Object.values(axiosErr.response.data.errors).join(', ')
          : null)
      setMixModalError(backendMsg || 'Failed to create mix.')
    } finally {
      setIsMixSubmitting(false)
    }
  }

  const handleOpenIssueModal = () => {
    setIssueModalError('')
    setIssueMachineId(productionMachines[0] ? String(productionMachines[0].id) : '')
    setIssueProductId(productsQuery.data?.[0] ? String(productsQuery.data[0].id) : '')
    const firstMix = availableMixes[0]
    setIssueMixId(firstMix ? String(firstMix.id) : '')
    setIssueKg(firstMix ? String(firstMix.qtyRemaining) : '')
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
    if (!issueMixId) {
      setIssueModalError('Select a mix to issue.')
      return
    }
    const qty = Number(issueKg)
    if (!(qty > 0)) {
      setIssueModalError('Enter how many kg to issue from the mix.')
      return
    }
    if (selectedIssueMix && qty > selectedIssueMix.qtyRemaining + 0.001) {
      setIssueModalError(
        `Cannot issue ${qty} kg. Mix has ${selectedIssueMix.qtyRemaining} kg left.`,
      )
      return
    }

    setIsIssueSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        mixId: Number(issueMixId),
        machineId: Number(issueMachineId),
        productId: Number(issueProductId),
        materialConsumed: qty,
        notes: issueNotes.trim() || undefined,
      }

      const startRes = await api.post('/production/runs/start', payload)

      const targetMachine = productionMachines.find((m) => m.id === Number(issueMachineId))
      const mixLabel = selectedIssueMix?.mixNumber || issueMixId

      setSuccessBanner(
        startRes.data?.addedToExisting
          ? `Added ${fmt(qty, 1)} kg from ${mixLabel} to running ${targetMachine?.name || 'machine'}.`
          : `Issued ${fmt(qty, 1)} kg from ${mixLabel} to ${targetMachine?.name || issueMachineId}.`,
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production-store'] }),
        queryClient.invalidateQueries({ queryKey: ['production-store-colors'] }),
        queryClient.invalidateQueries({ queryKey: ['production-store-mixes'] }),
        queryClient.invalidateQueries({ queryKey: ['production-runs'] }),
        queryClient.invalidateQueries({ queryKey: ['production-inputs'] }),
      ])

      setIsIssueModalOpen(false)
      setShowActiveFloor(true)
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { msg?: string; err?: string; errors?: Record<string, string> } }
      }
      const backendMsg =
        axiosErr.response?.data?.msg ||
        axiosErr.response?.data?.err ||
        (axiosErr.response?.data?.errors
          ? Object.values(axiosErr.response.data.errors).join(', ')
          : null)
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
  // MODAL STATE: MOVE TO RECYCLE
  // -------------------------------------------------------------
  const [recycleTarget, setRecycleTarget] = useState<StoreMaterialLine | null>(null)
  const [recycleQty, setRecycleQty] = useState('')
  const [recycleError, setRecycleError] = useState('')
  const [recycling, setRecycling] = useState(false)

  const openRecycleModal = (line: StoreMaterialLine) => {
    setRecycleTarget(line)
    setRecycleQty(String(line.qtyRemaining))
    setRecycleError('')
  }

  const closeRecycleModal = () => {
    if (recycling) return
    setRecycleTarget(null)
    setRecycleQty('')
    setRecycleError('')
  }

  const handleMoveToRecycle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recycleTarget) return
    const qty = Number(recycleQty)
    if (!(qty > 0)) { setRecycleError('Enter kg to move.'); return }
    if (qty > recycleTarget.qtyRemaining + 0.001) {
      setRecycleError(`Only ${recycleTarget.qtyRemaining} kg available.`)
      return
    }
    setRecycling(true)
    setRecycleError('')
    try {
      const { data } = await api.post('/production/store/transfer-to-recycle', {
        batchNumber: recycleTarget.batchNumber,
        qty,
        colorItemId: recycleTarget.colorItemId,
        color: recycleTarget.color,
      })
      setSuccessBanner(data.message || `Moved ${qty} kg to Recycle Store`)
      setRecycleTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store-mixes'] })
      await queryClient.invalidateQueries({ queryKey: ['recycle-store'] })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { err?: string } } }
      setRecycleError(e.response?.data?.err || 'Could not move to Recycle Store')
    } finally {
      setRecycling(false)
    }
  }

  // -------------------------------------------------------------
  // MODAL STATE: WRITE OFF BATCH (ZERO BALANCE)
  // -------------------------------------------------------------
  const [writeOffTarget, setWriteOffTarget] = useState<StoreMaterialLine | null>(null)
  const [writeOffQty, setWriteOffQty] = useState('')
  const [writingOff, setWritingOff] = useState(false)
  const [writeOffError, setWriteOffError] = useState('')

  const openWriteOffModal = (line: StoreMaterialLine) => {
    setWriteOffTarget(line)
    setWriteOffQty(line.qtyRemaining > 0 ? String(line.qtyRemaining) : '')
    setWriteOffError('')
  }

  const closeWriteOffModal = () => {
    if (writingOff) return
    setWriteOffTarget(null)
    setWriteOffQty('')
    setWriteOffError('')
  }

  const handleWriteOffBatch = async () => {
    if (!writeOffTarget) return
    setWritingOff(true)
    setWriteOffError('')
    try {
      const amount = Number(writeOffQty || writeOffTarget.qtyRemaining)
      const { data } = await api.post(`/production/store/${encodeURIComponent(writeOffTarget.batchNumber)}/write-off`, {
        colorItemId: writeOffTarget.colorItemId,
        qty: amount,
      })
      setSuccessBanner(data.message || `${writeOffTarget.batchNumber} written off`)
      setWriteOffTarget(null)
      setWriteOffQty('')
      await queryClient.invalidateQueries({ queryKey: ['production-store'] })
      await queryClient.invalidateQueries({ queryKey: ['production-store-mixes'] })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { err?: string } } }
      setWriteOffError(e.response?.data?.err || 'Could not write off batch')
    } finally {
      setWritingOff(false)
    }
  }



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
          <div>
            <Link
              to={`/batches/${row.original.batchNumber}`}
              className="font-semibold text-xs text-[var(--accent-strong)] hover:underline font-mono"
            >
              {row.original.batchNumber}
            </Link>
            {row.original.fromDamage && (
              <p className="text-[10px] font-semibold text-amber-800">
                {row.original.batchType === 'DAMAGED' ? 'Damaged' : 'From damaged goods'}
              </p>
            )}
          </div>
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
        cell: ({ row }) => {
          const qty = Number(row.original.qtyRemaining || 0)
          if (qty <= 0.0001) {
            return (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold tabular-nums text-zinc-400 text-xs">
                  0.0 kg
                </span>
                <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 border border-zinc-200">
                  Written off
                </span>
              </div>
            )
          }
          return (
            <span className="font-bold tabular-nums text-emerald-700 text-xs">
              {fmt(qty, 1)} kg
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const isWrittenOff = Number(row.original.qtyRemaining || 0) <= 0.0001
          return (
            <div className="flex items-center gap-1 justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isWrittenOff}
                className="h-7 px-2.5 text-xs font-semibold gap-1 text-amber-700 border-amber-200 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title={isWrittenOff ? 'Balance is 0 kg' : 'Move this lot back to Recycle Store'}
                onClick={() => openRecycleModal(row.original)}
              >
                <RotateCcw className="size-3" />
                To Recycle
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isWrittenOff}
                className="h-7 px-2.5 text-xs font-semibold gap-1 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title={isWrittenOff ? 'Lot is already written off' : 'Write off this lot (set balance to 0 kg)'}
                onClick={() => openWriteOffModal(row.original)}
              >
                <FileX className="size-3" />
                <span>Write off</span>
              </Button>
            </div>
          )
        },
      },
    ],
    [rawMaterialLines]
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
        cell: ({ row }) => {
          const code = row.original.material?.code || ''
          const sort = String(row.original.sortColor || '')
          const label =
            code === 'MAT-VIRGIN' || sort.includes('(Virgin)')
              ? 'Virgin material'
              : code === 'MAT-MASTERBATCH' || sort.includes('(Masterbatch)')
                ? 'Masterbatch'
                : code === 'MAT-PIGMENT' || sort.includes('(Normal Pigment)')
                  ? 'Pigment'
                  : row.original.material?.name || 'Additive'
          return <span className="text-xs text-zinc-700">{label}</span>
        },
      },
      {
        id: 'color',
        header: 'Name',
        accessorKey: 'sortColor',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-900">
            {String(row.original.sortColor || '')
              .replace(/\s*\((Masterbatch|Normal Pigment|Virgin)\)/i, '')
              .trim() || row.original.material?.name || '—'}
          </span>
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

  const mixColumns: ColumnDef<StoreMixRow>[] = useMemo(
    () => [
      {
        id: 'mixNumber',
        header: 'Mix',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-zinc-900">
            {row.original.mixNumber || row.original.batchNumber}
          </span>
        ),
      },
      {
        id: 'contents',
        header: 'Contains',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-700">
            {(row.original.lines || [])
              .map(
                (l) =>
                  `${fmt(l.qtyKg, 1)} kg ${l.color ? colorName(l.color) : l.batchNumber}`,
              )
              .join(' + ') || row.original.sortColor || 'Mix'}
          </span>
        ),
      },
      {
        id: 'qtyRemaining',
        header: 'Available',
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-violet-700 text-xs">
            {fmt(Number(row.original.qtyRemaining || 0), 1)} kg
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
            variant="outline"
            className="h-7 px-2.5 text-xs font-semibold gap-1"
            onClick={() => {
              setIssueMixId(String(row.original.id))
              setIssueKg(String(Number(row.original.qtyRemaining || 0)))
              setIssueModalError('')
              setIsIssueModalOpen(true)
            }}
          >
            <Send className="size-3" />
            Issue
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <PageLayout
      title="Material Store"
      description="Mix colours, then issue a mix to a machine."
      actions={
        <div className="flex max-w-full items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-9 shrink-0 px-0 sm:w-auto sm:gap-1.5 sm:px-3 text-xs font-semibold"
            onClick={() => navigate('/production/store/history')}
            aria-label="History"
            title="History"
          >
            <History className="size-3.5" />
            <span className="hidden sm:inline">History</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 px-2.5 sm:px-3 text-xs font-semibold"
            onClick={() => handleOpenMixModal()}
            disabled={rawMaterialLines.filter((l) => l.qtyRemaining > 0).length === 0}
          >
            <Blend className="size-3.5" />
            Mix
          </Button>
          <Button
            type="button"
            className="h-9 shrink-0 gap-1.5 px-2.5 sm:px-3 font-bold text-xs bg-violet-600 hover:bg-violet-700 text-white shadow-xs"
            onClick={handleOpenIssueModal}
            disabled={availableMixes.length === 0}
          >
            <Send className="size-3.5" />
            Issue
          </Button>
        </div>
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
            <div className="flex items-center gap-2 text-xs flex-wrap justify-end">
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
              {availableMixes.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-zinc-600 gap-1"
                  onClick={() => setShowMixStock((prev) => !prev)}
                >
                  <Blend className="size-3.5 text-violet-600" />
                  Mixes ({availableMixes.length})
                  {showMixStock ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </Button>
              )}
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

          {showMixStock && availableMixes.length > 0 && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 space-y-2">
              <span className="text-xs font-bold text-violet-950">
                Material mixes ·{' '}
                {availableMixes
                  .reduce((sum, m) => sum + Number(m.qtyRemaining || 0), 0)
                  .toFixed(1)}{' '}
                kg
              </span>
              <CustomTable1
                data={availableMixes}
                columns={mixColumns}
                filter={false}
                loading={mixesQuery.isLoading}
                card={true}
              />
            </div>
          )}

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

        <Dialog open={isMixModalOpen} onOpenChange={setIsMixModalOpen}>
          <DialogContent className="max-h-[92vh] w-[min(90vw,40rem)] max-w-[min(90vw,40rem)] overflow-y-auto p-4 sm:p-5 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:pt-[max(1.25rem,env(safe-area-inset-top))] max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <DialogHeader className="mb-0 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Mix materials
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Combine colour lots (and additives) into a mix. Issue that mix to a machine next.
              </DialogDescription>
            </DialogHeader>

            {mixModalError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                {mixModalError}
              </div>
            )}

            <form className="mt-3 space-y-4" onSubmit={handleCreateMix}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="grid grid-cols-[1fr_7rem] gap-2 flex-1 pr-2 sm:grid-cols-[1fr_8rem]">
                    <span className="text-[11px] font-semibold text-zinc-600">Color</span>
                    <span className="text-[11px] font-semibold text-zinc-600">KG</span>
                  </div>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-violet-700 hover:underline cursor-pointer shrink-0"
                    onClick={() =>
                      setMixLines((prev) => [
                        ...prev,
                        { id: String(Date.now()), lineKey: '', qty: '' },
                      ])
                    }
                  >
                    + Add
                  </button>
                </div>

                {mixLines.map((row) => (
                  <div key={row.id} className="flex items-center gap-1.5">
                    <div className="grid grid-cols-[1fr_7rem] gap-2 flex-1 min-w-0 sm:grid-cols-[1fr_8rem]">
                      <Select
                        value={row.lineKey || undefined}
                        onValueChange={(val) =>
                          setMixLines((prev) =>
                            prev.map((l) =>
                              l.id === row.id ? { ...l, lineKey: val, qty: '' } : l,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-9 text-xs bg-white">
                          <SelectValue placeholder="Select color…" />
                        </SelectTrigger>
                        <SelectContent>
                          {rawMaterialLines
                            .filter((l) => l.qtyRemaining > 0)
                            .map((l) => (
                              <SelectItem key={l.key} value={l.key}>
                                {l.displayLabel || colorName(l.color)} · {fmt(l.qtyRemaining, 1)} kg
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        className="dgn-input font-semibold text-xs h-9"
                        placeholder="kg"
                        value={row.qty}
                        onChange={(e) =>
                          setMixLines((prev) =>
                            prev.map((l) =>
                              l.id === row.id ? { ...l, qty: e.target.value } : l,
                            ),
                          )
                        }
                      />
                    </div>
                    {mixLines.length > 1 ? (
                      <button
                        type="button"
                        className="text-zinc-400 hover:text-red-600 cursor-pointer shrink-0 p-1"
                        onClick={() =>
                          setMixLines((prev) => prev.filter((l) => l.id !== row.id))
                        }
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  Notes (optional)
                </label>
                <Input
                  value={mixNotes}
                  onChange={(e) => setMixNotes(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="e.g. morning blend"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMixModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isMixSubmitting}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-1.5"
                  size="sm"
                >
                  <Blend className="size-3.5" />
                  {isMixSubmitting ? 'Mixing…' : 'Save mix'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
          <DialogContent className="max-h-[92vh] w-[min(90vw,40rem)] max-w-[min(90vw,40rem)] overflow-y-auto p-4 sm:p-5 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:pt-[max(1.25rem,env(safe-area-inset-top))] max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <DialogHeader className="mb-0 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Issue to machine
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Select machine, product, and a saved mix.
              </DialogDescription>
            </DialogHeader>

            {issueModalError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                {issueModalError}
              </div>
            )}

            <form className="mt-3 space-y-4" onSubmit={handleExecuteIssueToMachine}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    Machine
                  </label>
                  <Select value={issueMachineId} onValueChange={setIssueMachineId}>
                    <SelectTrigger className="h-9 text-xs bg-white">
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
                    <SelectTrigger className="h-9 text-xs bg-white">
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem]">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    Mix
                  </label>
                  <Select
                    value={issueMixId || undefined}
                    onValueChange={(val) => {
                      setIssueMixId(val)
                      const mix = availableMixes.find((m) => String(m.id) === val)
                      if (mix) setIssueKg(String(mix.qtyRemaining))
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-white">
                      <SelectValue placeholder="Select mix…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMixes.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.mixNumber} · {m.sortColor} · {fmt(m.qtyRemaining, 1)} kg
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    KG
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    className="dgn-input font-semibold text-xs h-9 w-full"
                    placeholder="kg"
                    value={issueKg}
                    onChange={(e) => setIssueKg(e.target.value)}
                  />
                </div>
              </div>

              {selectedIssueMix?.lines?.length ? (
                <p className="text-[11px] text-zinc-500">
                  Contains{' '}
                  {selectedIssueMix.lines
                    .map(
                      (l) =>
                        `${fmt(l.qtyKg, 1)} kg ${l.color ? colorName(l.color) : l.batchNumber}`,
                    )
                    .join(' + ')}
                </p>
              ) : null}

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  Notes (optional)
                </label>
                <Input
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="Optional note"
                />
              </div>

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
                  disabled={isIssueSubmitting || availableMixes.length === 0}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-1.5"
                  size="sm"
                >
                  <Send className="size-3.5" />
                  {isIssueSubmitting ? 'Issuing…' : 'Issue'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Move to Recycle Store modal ── */}
        <Dialog open={Boolean(recycleTarget)} onOpenChange={(open) => { if (!open) closeRecycleModal() }}>
          <DialogContent className="max-h-[92vh] w-[min(90vw,28rem)] max-w-[min(90vw,28rem)] overflow-y-auto p-4 sm:p-5 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:pt-[max(1.25rem,env(safe-area-inset-top))] max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <DialogHeader className="mb-0 pb-2 border-b border-zinc-100">
              <DialogTitle className="text-base font-bold tracking-tight">
                Move back to Recycle Store
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Enter how many kg to move. The remainder stays in the Material Store.
              </DialogDescription>
            </DialogHeader>

            {recycleTarget && (
              <form className="mt-3 space-y-4" onSubmit={handleMoveToRecycle}>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-xs space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Lot</span>
                    <span className="font-mono font-semibold">{recycleTarget.batchNumber}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Color</span>
                    <span className="font-medium">{colorName(recycleTarget.color)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Available</span>
                    <span className="font-bold tabular-nums text-emerald-700">
                      {fmt(recycleTarget.qtyRemaining, 1)} kg
                    </span>
                  </div>
                </div>

                {recycleError && (
                  <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                    {recycleError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                    kg to move to Recycle Store
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    max={recycleTarget.qtyRemaining}
                    className="h-10 text-sm font-semibold tabular-nums"
                    value={recycleQty}
                    onChange={(e) => setRecycleQty(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="mt-1.5 text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer"
                    onClick={() => setRecycleQty(String(recycleTarget.qtyRemaining))}
                  >
                    Move all ({fmt(recycleTarget.qtyRemaining, 1)} kg)
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                  <Button type="button" variant="ghost" size="sm" disabled={recycling} onClick={closeRecycleModal}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={recycling}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5"
                    size="sm"
                  >
                    <RotateCcw className="size-3.5" />
                    {recycling ? 'Moving…' : 'Move to Recycle Store'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Write off batch modal ── */}
        <Dialog open={Boolean(writeOffTarget)} onOpenChange={(open) => { if (!open) closeWriteOffModal() }}>
          <DialogContent className="max-h-[92vh] w-[min(90vw,26rem)] max-w-[min(90vw,26rem)] overflow-y-auto p-4 sm:p-5 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:pt-[max(1.25rem,env(safe-area-inset-top))] max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <DialogHeader className="mb-0 pb-2 border-b border-zinc-100">
              <DialogTitle className="text-base font-bold tracking-tight text-red-700 flex items-center gap-1.5">
                <FileX className="size-4" />
                Write off lot line
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Adjust available balance for this lot line in the Material Store. The record and history will remain intact.
              </DialogDescription>
            </DialogHeader>

            {writeOffTarget && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleWriteOffBatch()
                }}
                className="mt-3 space-y-4"
              >
                <div className="rounded-xl border border-red-100 bg-red-50/60 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Lot</span>
                    <span className="font-mono font-semibold">{writeOffTarget.batchNumber}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Material</span>
                    <span className="font-medium text-zinc-900">{writeOffTarget.materialName}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Color</span>
                    <span className="font-medium">{colorName(writeOffTarget.color)}</span>
                  </div>
                  <div className="flex justify-between gap-2 pt-1 border-t border-red-100/80">
                    <span className="text-muted-foreground">Available balance</span>
                    <span className="font-bold tabular-nums text-emerald-700">
                      {fmt(writeOffTarget.qtyRemaining, 1)} kg
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-zinc-700">
                    Quantity to write off (kg)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0.001"
                    max={writeOffTarget.qtyRemaining}
                    value={writeOffQty}
                    onChange={(e) => setWriteOffQty(e.target.value)}
                    placeholder={String(writeOffTarget.qtyRemaining)}
                    required
                    className="h-9 text-xs font-semibold tabular-nums"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Remaining after write-off:{' '}
                    <span className="font-semibold text-zinc-700">
                      {fmt(
                        Math.max(
                          0,
                          writeOffTarget.qtyRemaining - (Number(writeOffQty) || 0)
                        ),
                        1
                      )}{' '}
                      kg
                    </span>
                  </p>
                </div>

                {writeOffError && (
                  <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                    {writeOffError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                  <Button type="button" variant="ghost" size="sm" disabled={writingOff} onClick={closeWriteOffModal}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={writingOff || !writeOffQty || Number(writeOffQty) <= 0}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5"
                    size="sm"
                  >
                    <FileX className="size-3.5" />
                    {writingOff ? 'Writing off…' : `Write off ${writeOffQty ? fmt(Number(writeOffQty), 1) : fmt(writeOffTarget.qtyRemaining, 1)} kg`}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  )
}
