import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Clock,
  Cpu,
  Layers,
  Search,
  Users,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Wrench,
  Plus,
  Activity,
  Pencil,
  Gauge,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import CustomTable1 from '@/components/CustomTable1'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

type NamedStat = { name: string; count: number; minutes: number }

type MachineMaster = {
  id: number
  code: string
  name: string
  machineType: string
  status: string
  ratedOutputPerHour: number | string | null
  isActive: boolean
  createdAt?: string
  maintenances?: MaintenanceRecord[]
}

type MaintenanceRecord = {
  id: number
  machineId: number
  maintenanceType: 'PREVENTIVE' | 'CORRECTIVE' | 'OVERHAUL' | 'INSPECTION' | 'EMERGENCY'
  title: string
  description?: string | null
  cost: number | string
  technician?: string | null
  downtimeMinutes: number | string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  partsReplaced?: string | null
  scheduledDate?: string | null
  performedDate?: string | null
  notes?: string | null
  createdAt?: string
  machine?: {
    id: number
    name: string
    code: string
    machineType: string
    status: string
  }
}

type MachineInsight = {
  machineId: number | string
  machineName: string
  machineCode: string | null
  status: string | null
  ratedOutputPerHour: number | null
  productionRuns: number
  processRuns: number
  runs: number
  produced: number
  good: number
  reject: number
  runtimeMinutes: number
  downtimeMinutes: number
  downtimeEvents: number
  downtimeSharePercent: number
  availabilityPercent: number | null
  performancePercent: number | null
  qualityPercent: number | null
  oeePercent: number | null
  products: Array<{
    productId: number
    name: string
    produced: number
    good: number
    reject: number
    downtimeMinutes: number
    runs: number
  }>
  operators: NamedStat[]
  reasons: NamedStat[]
  stages: NamedStat[]
}

type InsightsPayload = {
  summary: {
    machinesTracked: number
    totalDowntimeMinutes: number
    downtimeEvents: number
    avgOeePercent: number | null
    topDowntimeMachine: { name: string; minutes: number } | null
    topDowntimeOperator: { name: string; minutes: number } | null
    topProduct: { name: string; produced: number } | null
  }
  machines: MachineInsight[]
  operators: Array<{
    operatorName: string
    downtimeMinutes: number
    downtimeEvents: number
    runs: number
    machines: string[]
    products: string[]
  }>
  products: Array<{
    productId: number
    name: string
    produced: number
    good: number
    reject: number
    runs: number
    downtimeMinutes: number
    machines: string[]
    rejectPercent: number
  }>
  reasons: NamedStat[]
  recentDowntime: Array<{
    source: string
    at: string
    machineName: string
    operatorName: string
    minutes: number
    reason: string
    productOrStage: string
    batchNumber: string | null
  }>
}

type PageTab = 'machines' | 'maintenance' | 'insights'

function oeeBadgeColor(oee: number | null) {
  if (oee == null) return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
  if (oee >= 75) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
  if (oee >= 55) return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
  return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
}

function oeeBarColor(oee: number | null) {
  if (oee == null) return 'bg-zinc-300'
  if (oee >= 75) return 'bg-emerald-500'
  if (oee >= 55) return 'bg-amber-500'
  return 'bg-rose-500'
}

function machineStatusColor(status: string | null | undefined) {
  const s = String(status || '').toUpperCase()
  if (s === 'RUNNING' || s === 'ACTIVE') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
  }
  if (s === 'MAINTENANCE') {
    return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
  }
  if (s === 'STOPPED' || s === 'CRITICAL' || s === 'DOWN') {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
  }
  return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
}

function maintenanceStatusColor(status: string) {
  const s = String(status || '').toUpperCase()
  if (s === 'COMPLETED') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
  }
  if (s === 'IN_PROGRESS') {
    return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
  }
  if (s === 'SCHEDULED') {
    return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
  }
  return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
}

function maintenanceTypeColor(type: string) {
  const t = String(type || '').toUpperCase()
  if (t === 'PREVENTIVE') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
  if (t === 'CORRECTIVE') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  if (t === 'EMERGENCY') return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
  if (t === 'OVERHAUL') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
  return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
}

function formatMinutes(min: number) {
  if (!min) return '0 min'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function formatNgn(amount: number | string | null | undefined) {
  const n = Number(amount || 0)
  return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function MachinePerformancePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<PageTab>('machines')

  // Search & Filter state for Machines tab
  const [machineSearch, setMachineSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')

  // Search & Filter state for Maintenance tab
  const [maintSearch, setMaintSearch] = useState('')
  const [maintStatusFilter, setMaintStatusFilter] = useState('ALL')
  const [maintMachineFilter, setMaintMachineFilter] = useState('ALL')

  // Telemetry state
  const [telemetrySelectedId, setTelemetrySelectedId] = useState<string | number | null>(null)
  const [oeeFilter, setOeeFilter] = useState<'ALL' | 'HEALTHY' | 'WATCH' | 'CRITICAL'>('ALL')
  const [detailTab, setDetailTab] = useState<'overview' | 'people' | 'stops'>('overview')

  // Modals state
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false)
  const [editingMaint, setEditingMaint] = useState<MaintenanceRecord | null>(null)
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false)
  const [editingMachine, setEditingMachine] = useState<MachineMaster | null>(null)

  // Maintenance form state
  const [maintMachineId, setMaintMachineId] = useState<string>('')
  const [maintTitle, setMaintTitle] = useState('')
  const [maintType, setMaintType] = useState('PREVENTIVE')
  const [maintStatus, setMaintStatus] = useState('COMPLETED')
  const [maintTechnician, setMaintTechnician] = useState('')
  const [maintCost, setMaintCost] = useState('')
  const [maintDowntime, setMaintDowntime] = useState('')
  const [maintParts, setMaintParts] = useState('')
  const [maintNotes, setMaintNotes] = useState('')
  const [maintPerformedDate, setMaintPerformedDate] = useState('')
  const [updateMachineStatusOnMaint, setUpdateMachineStatusOnMaint] = useState(true)
  const [maintFormError, setMaintFormError] = useState('')

  // Machine form state
  const [machineFormName, setMachineFormName] = useState('')
  const [machineFormCode, setMachineFormCode] = useState('')
  const [machineFormType, setMachineFormType] = useState('PRODUCTION')
  const [machineFormStatus, setMachineFormStatus] = useState('RUNNING')
  const [machineFormRatedOutput, setMachineFormRatedOutput] = useState('')
  const [machineFormError, setMachineFormError] = useState('')

  // Queries with instant cached data + background refetch
  const machinesQuery = useQuery({
    queryKey: ['masters-machines'],
    queryFn: async () => {
      const { data } = await api.get('/machines')
      return data.data as MachineMaster[]
    },
    initialData: () => {
      try {
        const local = localStorage.getItem('dgn_cached_machines')
        if (local) return JSON.parse(local) as MachineMaster[]
      } catch {}
      return undefined
    },
    initialDataUpdatedAt: 0,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (machinesQuery.data) {
      try {
        localStorage.setItem('dgn_cached_machines', JSON.stringify(machinesQuery.data))
      } catch {}
    }
  }, [machinesQuery.data])

  const maintenanceQuery = useQuery({
    queryKey: ['masters-maintenance'],
    queryFn: async () => {
      const { data } = await api.get('/maintenance')
      return data.data as MaintenanceRecord[]
    },
    initialData: () => {
      try {
        const local = localStorage.getItem('dgn_cached_maintenance')
        if (local) return JSON.parse(local) as MaintenanceRecord[]
      } catch {}
      return undefined
    },
    initialDataUpdatedAt: 0,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (maintenanceQuery.data) {
      try {
        localStorage.setItem('dgn_cached_maintenance', JSON.stringify(maintenanceQuery.data))
      } catch {}
    }
  }, [maintenanceQuery.data])

  const insightsQ = useQuery({
    queryKey: ['machine-insights'],
    queryFn: async () => {
      const { data } = await api.get('/production/machine-insights')
      return data.data as InsightsPayload
    },
    initialData: () => {
      try {
        const local = localStorage.getItem('dgn_cached_machine_insights')
        if (local) return JSON.parse(local) as InsightsPayload
      } catch {}
      return undefined
    },
    initialDataUpdatedAt: 0,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (insightsQ.data) {
      try {
        localStorage.setItem('dgn_cached_machine_insights', JSON.stringify(insightsQ.data))
      } catch {}
    }
  }, [insightsQ.data])

  const allMachines = machinesQuery.data ?? []
  const allMaintenances = maintenanceQuery.data ?? []
  const insightsData = insightsQ.data
  const telemetryMachines = insightsData?.machines ?? []

  // Map of telemetry by machine name or code
  const telemetryMap = useMemo(() => {
    const map = new Map<string, MachineInsight>()
    for (const m of telemetryMachines) {
      map.set(String(m.machineId), m)
      map.set(m.machineName.toLowerCase().trim(), m)
      if (m.machineCode) map.set(m.machineCode.toLowerCase().trim(), m)
    }
    return map
  }, [telemetryMachines])

  // Filtered Machines List
  const filteredMachines = useMemo(() => {
    return allMachines.filter((m) => {
      if (machineSearch.trim()) {
        const q = machineSearch.toLowerCase()
        const matchName = m.name.toLowerCase().includes(q)
        const matchCode = (m.code || '').toLowerCase().includes(q)
        if (!matchName && !matchCode) return false
      }
      if (statusFilter !== 'ALL' && m.status?.toUpperCase() !== statusFilter) return false
      if (typeFilter !== 'ALL' && m.machineType?.toUpperCase() !== typeFilter) return false
      return true
    })
  }, [allMachines, machineSearch, statusFilter, typeFilter])

  // Filtered Maintenance List
  const filteredMaintenances = useMemo(() => {
    return allMaintenances.filter((rec) => {
      if (maintMachineFilter !== 'ALL' && String(rec.machineId) !== maintMachineFilter) return false
      if (maintStatusFilter !== 'ALL' && rec.status !== maintStatusFilter) return false
      if (maintSearch.trim()) {
        const q = maintSearch.toLowerCase()
        const matchTitle = rec.title.toLowerCase().includes(q)
        const matchTech = (rec.technician || '').toLowerCase().includes(q)
        const matchMachine = (rec.machine?.name || '').toLowerCase().includes(q)
        const matchParts = (rec.partsReplaced || '').toLowerCase().includes(q)
        if (!matchTitle && !matchTech && !matchMachine && !matchParts) return false
      }
      return true
    })
  }, [allMaintenances, maintMachineFilter, maintStatusFilter, maintSearch])

  // Telemetry selected machine
  const selectedTelemetry = useMemo(() => {
    if (!telemetryMachines.length) return null
    if (telemetrySelectedId != null) {
      const found = telemetryMachines.find((m) => String(m.machineId) === String(telemetrySelectedId))
      if (found) return found
    }
    return telemetryMachines[0]
  }, [telemetryMachines, telemetrySelectedId])

  // Save Maintenance Mutation
  const saveMaintenanceMutation = useMutation({
    mutationFn: async () => {
      setMaintFormError('')
      const payload = {
        machineId: Number(maintMachineId),
        title: maintTitle.trim(),
        maintenanceType: maintType,
        status: maintStatus,
        technician: maintTechnician.trim() || null,
        cost: maintCost ? Number(maintCost) : 0,
        downtimeMinutes: maintDowntime ? Number(maintDowntime) : 0,
        partsReplaced: maintParts.trim() || null,
        notes: maintNotes.trim() || null,
        performedDate: maintPerformedDate ? new Date(maintPerformedDate).toISOString() : new Date().toISOString(),
        updateMachineStatus: updateMachineStatusOnMaint,
      }
      if (!payload.machineId || !payload.title) {
        throw new Error('Machine and title are required')
      }
      if (editingMaint) {
        const { data } = await api.patch(`/maintenance/${editingMaint.id}`, payload)
        return data.data
      } else {
        const { data } = await api.post('/maintenance', payload)
        return data.data
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['masters-maintenance'] })
      qc.invalidateQueries({ queryKey: ['masters-machines'] })
      qc.invalidateQueries({ queryKey: ['machine-360'] })
      qc.invalidateQueries({ queryKey: ['machine-insights'] })
      setIsMaintModalOpen(false)
      setEditingMaint(null)
    },
    onError: (err: any) => {
      setMaintFormError(err.response?.data?.err || err.message || 'Failed to save maintenance')
    },
  })

  // Save Machine Mutation
  const saveMachineMutation = useMutation({
    mutationFn: async () => {
      setMachineFormError('')
      const payload = {
        name: machineFormName.trim(),
        code: machineFormCode.trim() || undefined,
        machineType: machineFormType,
        status: machineFormStatus,
        ratedOutputPerHour: machineFormRatedOutput ? Number(machineFormRatedOutput) : 0,
        isActive: true,
      }
      if (!payload.name) {
        throw new Error('Machine name is required')
      }
      if (editingMachine) {
        const { data } = await api.patch(`/machines/${editingMachine.id}`, payload)
        return data.data
      } else {
        const { data } = await api.post('/machines', payload)
        return data.data
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['masters-machines'] })
      qc.invalidateQueries({ queryKey: ['machine-360'] })
      qc.invalidateQueries({ queryKey: ['machine-insights'] })
      setIsMachineModalOpen(false)
      setEditingMachine(null)
    },
    onError: (err: any) => {
      setMachineFormError(err.response?.data?.err || err.message || 'Failed to save machine')
    },
  })

  function openCreateMaintenance(preselectedMachineId?: number) {
    setEditingMaint(null)
    setMaintMachineId(preselectedMachineId ? String(preselectedMachineId) : (allMachines[0]?.id ? String(allMachines[0].id) : ''))
    setMaintTitle('')
    setMaintType('PREVENTIVE')
    setMaintStatus('COMPLETED')
    setMaintTechnician('')
    setMaintCost('')
    setMaintDowntime('')
    setMaintParts('')
    setMaintNotes('')
    setMaintPerformedDate(new Date().toISOString().slice(0, 16))
    setUpdateMachineStatusOnMaint(true)
    setMaintFormError('')
    setIsMaintModalOpen(true)
  }

  function openEditMaintenance(rec: MaintenanceRecord) {
    setEditingMaint(rec)
    setMaintMachineId(String(rec.machineId))
    setMaintTitle(rec.title || '')
    setMaintType(rec.maintenanceType || 'PREVENTIVE')
    setMaintStatus(rec.status || 'COMPLETED')
    setMaintTechnician(rec.technician || '')
    setMaintCost(rec.cost != null ? String(rec.cost) : '')
    setMaintDowntime(rec.downtimeMinutes != null ? String(rec.downtimeMinutes) : '')
    setMaintParts(rec.partsReplaced || '')
    setMaintNotes(rec.notes || '')
    setMaintPerformedDate(rec.performedDate ? new Date(rec.performedDate).toISOString().slice(0, 16) : '')
    setUpdateMachineStatusOnMaint(false)
    setMaintFormError('')
    setIsMaintModalOpen(true)
  }

  function openCreateMachine() {
    setEditingMachine(null)
    setMachineFormName('')
    setMachineFormCode('')
    setMachineFormType('PRODUCTION')
    setMachineFormStatus('RUNNING')
    setMachineFormRatedOutput('')
    setMachineFormError('')
    setIsMachineModalOpen(true)
  }

  function openEditMachine(m: MachineMaster) {
    setEditingMachine(m)
    setMachineFormName(m.name)
    setMachineFormCode(m.code || '')
    setMachineFormType(m.machineType || 'PRODUCTION')
    setMachineFormStatus(m.status || 'RUNNING')
    setMachineFormRatedOutput(m.ratedOutputPerHour != null ? String(m.ratedOutputPerHour) : '')
    setMachineFormError('')
    setIsMachineModalOpen(true)
  }

  function open360View(machineId: number) {
    navigate(`/machines/${machineId}`)
  }

  // Columns for Machines CustomTable1
  const machineColumns = useMemo<ColumnDef<MachineMaster>[]>(
    () => [
      {
        id: 'code',
        header: 'Code',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
            {row.original.code || '—'}
          </span>
        ),
      },
      {
        id: 'name',
        header: 'Machine Name',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => open360View(row.original.id)}
            className="text-left font-bold text-xs text-zinc-900 dark:text-zinc-100 hover:text-[var(--accent-strong)] hover:underline flex items-center gap-1.5"
          >
            <span>{row.original.name}</span>
          </button>
        ),
      },
      {
        id: 'machineType',
        header: 'Type / Line',
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            {row.original.machineType || 'PRODUCTION'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-black border uppercase',
              machineStatusColor(row.original.status)
            )}
          >
            {row.original.status || 'RUNNING'}
          </span>
        ),
      },
      {
        id: 'ratedOutputPerHour',
        header: 'Rated Speed',
        cell: ({ row }) => (
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {Number(row.original.ratedOutputPerHour || 0) > 0
              ? `${Number(row.original.ratedOutputPerHour)} / hr`
              : 'Standard'}
          </span>
        ),
      },
      {
        id: 'oee',
        header: 'Health / OEE',
        cell: ({ row }) => {
          const telem = telemetryMap.get(String(row.original.id)) ||
            telemetryMap.get(row.original.name.toLowerCase().trim()) ||
            (row.original.code ? telemetryMap.get(row.original.code.toLowerCase().trim()) : null)
          if (!telem || telem.oeePercent == null) {
            return <span className="text-xs text-zinc-400 font-medium">Ready</span>
          }
          return (
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-black border',
                oeeBadgeColor(telem.oeePercent)
              )}
            >
              {telem.oeePercent}% OEE
            </span>
          )
        },
      },
      {
        id: 'latestMaintenance',
        header: 'Latest Service',
        cell: ({ row }) => {
          const m = row.original.maintenances?.[0]
          if (!m) return <span className="text-xs text-zinc-400 italic">None logged</span>
          return (
            <div className="space-y-0.5 text-xs">
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-xs">{m.title}</p>
              <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                <span>{formatDateTime(m.performedDate || m.createdAt || '')}</span>
                <span>·</span>
                <span className={cn('px-1.5 py-0.2 rounded text-[9px] font-bold border', maintenanceStatusColor(m.status))}>
                  {m.status}
                </span>
              </div>
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs font-semibold gap-1 bg-zinc-50 hover:bg-amber-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
              onClick={() => open360View(row.original.id)}
            >
              <Activity className="size-3 text-amber-600" />
              <span>360°</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs font-semibold gap-1"
              onClick={() => openCreateMaintenance(row.original.id)}
            >
              <Wrench className="size-3" />
              <span>Maint</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-zinc-400 hover:text-zinc-700"
              onClick={() => openEditMachine(row.original.id ? row.original : row.original)}
            >
              <Pencil className="size-3" />
            </Button>
          </div>
        ),
      },
    ],
    [telemetryMap]
  )

  // Columns for Maintenance CustomTable1
  const maintenanceColumns = useMemo<ColumnDef<MaintenanceRecord>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 tabular-nums whitespace-nowrap">
            {formatDateTime(row.original.performedDate || row.original.createdAt || '')}
          </span>
        ),
      },
      {
        id: 'machine',
        header: 'Machine',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => open360View(row.original.machineId)}
            className="font-bold text-xs text-zinc-900 dark:text-zinc-100 hover:text-[var(--accent-strong)] hover:underline flex items-center gap-1.5"
          >
            <span>{row.original.machine?.name || `Machine #${row.original.machineId}`}</span>
            {row.original.machine?.code && (
              <span className="font-mono text-[10px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded">
                {row.original.machine.code}
              </span>
            )}
          </button>
        ),
      },
      {
        id: 'title',
        header: 'Service Title & Type',
        cell: ({ row }) => (
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={cn('px-1.5 py-0.2 rounded text-[9px] font-extrabold border', maintenanceTypeColor(row.original.maintenanceType))}>
                {row.original.maintenanceType}
              </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">{row.original.title}</span>
            </div>
            {row.original.partsReplaced && (
              <p className="text-[11px] text-zinc-500 truncate max-w-xs">
                Parts: {row.original.partsReplaced}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black border uppercase', maintenanceStatusColor(row.original.status))}>
            {row.original.status}
          </span>
        ),
      },
      {
        id: 'technician',
        header: 'Technician',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
            {row.original.technician || '—'}
          </span>
        ),
      },
      {
        id: 'downtime',
        header: 'Downtime',
        cell: ({ row }) => (
          Number(row.original.downtimeMinutes) > 0 ? (
            <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900 text-xs">
              {formatMinutes(Number(row.original.downtimeMinutes))}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">0 min</span>
          )
        ),
      },
      {
        id: 'cost',
        header: 'Cost (₦)',
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-xs text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
            {formatNgn(row.original.cost)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-semibold gap-1"
            onClick={() => openEditMaintenance(row.original)}
          >
            <Pencil className="size-3 text-zinc-400" />
            <span>Edit</span>
          </Button>
        ),
      },
    ],
    []
  )

  const recent = (insightsData?.recentDowntime || []).slice(0, 15)

  return (
    <PageLayout
      title={
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <span className="truncate">Machines & Maintenance</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 shrink-0">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500 shrink-0" />
            <span>Factory floor</span>
          </span>
        </div>
      }
      description="Manage factory equipment, log and schedule maintenance, track downtimes and review OEE telemetry."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5"
            onClick={() => {
              machinesQuery.refetch()
              maintenanceQuery.refetch()
              insightsQ.refetch()
            }}
            disabled={machinesQuery.isFetching || maintenanceQuery.isFetching || insightsQ.isFetching}
          >
            <RefreshCw className={cn('size-3.5', (machinesQuery.isFetching || insightsQ.isFetching) && 'animate-spin')} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5"
            onClick={() => openCreateMachine()}
          >
            <Plus className="size-3.5" />
            <span>Add Machine</span>
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#1a1205] shadow-xs"
            onClick={() => openCreateMaintenance()}
          >
            <Wrench className="size-3.5" />
            <span>Log Maintenance</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <div className="flex gap-2">
            {[
              { id: 'machines', label: 'Machines Overview', icon: Cpu, count: allMachines.length },
              { id: 'maintenance', label: 'Maintenance Logs', icon: Wrench, count: allMaintenances.length },
              { id: 'insights', label: 'Telemetry & OEE', icon: Gauge, count: telemetryMachines.length },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as PageTab)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0',
                    isActive
                      ? 'border-[var(--accent-strong)] text-[var(--accent-strong)] bg-amber-500/5'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  )}
                >
                  <Icon className="size-4" />
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                      isActive ? 'bg-[var(--accent)] text-[#1a1205]' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* TAB 1: MACHINES OVERVIEW (CustomTable1, No stat cards, Shadcn Select) */}
        {/* ==================================================================== */}
        {activeTab === 'machines' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <Input
                  placeholder="Search machine by name or code…"
                  className="h-9 pl-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  value={machineSearch}
                  onChange={(e) => setMachineSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase">Status:</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-36 text-xs font-semibold bg-zinc-50 dark:bg-zinc-900">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="RUNNING">Running</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      <SelectItem value="IDLE">Idle</SelectItem>
                      <SelectItem value="STOPPED">Stopped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase">Type:</span>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 w-36 text-xs font-semibold bg-zinc-50 dark:bg-zinc-900">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="PRODUCTION">Production</SelectItem>
                      <SelectItem value="EXTRUDER">Extruder</SelectItem>
                      <SelectItem value="CRUSHER">Crusher</SelectItem>
                      <SelectItem value="WASHER">Washer</SelectItem>
                      <SelectItem value="DRYER">Dryer</SelectItem>
                      <SelectItem value="RECYCLING">Recycling</SelectItem>
                      <SelectItem value="GENERAL">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* CustomTable1 for Machines Overview */}
            <CustomTable1<MachineMaster>
              data={filteredMachines}
              columns={machineColumns}
              loading={machinesQuery.isLoading}
              card={true}
              filter={false}
              pagination={true}
            />
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: MAINTENANCE LOGS (CustomTable1, Shadcn Select) */}
        {/* ==================================================================== */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <Input
                  placeholder="Search maintenance title, technician, parts…"
                  className="h-9 pl-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  value={maintSearch}
                  onChange={(e) => setMaintSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase">Machine:</span>
                  <Select value={maintMachineFilter} onValueChange={setMaintMachineFilter}>
                    <SelectTrigger className="h-9 w-44 text-xs font-semibold bg-zinc-50 dark:bg-zinc-900">
                      <SelectValue placeholder="All Machines" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Machines</SelectItem>
                      {allMachines.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name} ({m.code || 'NO-CODE'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 uppercase">Status:</span>
                  <Select value={maintStatusFilter} onValueChange={setMaintStatusFilter}>
                    <SelectTrigger className="h-9 w-36 text-xs font-semibold bg-zinc-50 dark:bg-zinc-900">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  size="sm"
                  className="h-9 text-xs font-semibold gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#1a1205]"
                  onClick={() => openCreateMaintenance()}
                >
                  <Plus className="size-3.5" />
                  <span>Log Maintenance</span>
                </Button>
              </div>
            </div>

            {/* CustomTable1 for Maintenance */}
            <CustomTable1<MaintenanceRecord>
              data={filteredMaintenances}
              columns={maintenanceColumns}
              loading={maintenanceQuery.isLoading}
              card={true}
              filter={false}
              pagination={true}
            />
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: TELEMETRY & INSIGHTS (OEE & Root Causes) */}
        {/* ==================================================================== */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            {/* 2-Column Machine Telemetry Panel */}
            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] items-start">
              {/* Left Column: Fleet List */}
              <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="size-4 text-zinc-600 dark:text-zinc-400" />
                      <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Telemetry Units</h2>
                    </div>
                    <span className="text-xs font-semibold text-zinc-500">
                      {telemetryMachines.length} unit{telemetryMachines.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Health Filter */}
                  <div className="flex items-center gap-1">
                    {(['ALL', 'HEALTHY', 'WATCH', 'CRITICAL'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setOeeFilter(filter)}
                        className={cn(
                          'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
                          oeeFilter === filter
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* List */}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-[560px] overflow-y-auto">
                  {!telemetryMachines.length ? (
                    <div className="p-8 text-center text-xs text-zinc-500 space-y-1">
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">No telemetry records</p>
                      <p>Run production or process jobs to generate telemetry.</p>
                    </div>
                  ) : (
                    telemetryMachines.map((m) => {
                      const isSelected = selectedTelemetry && String(selectedTelemetry.machineId) === String(m.machineId)
                      return (
                        <button
                          key={String(m.machineId)}
                          type="button"
                          onClick={() => {
                            setTelemetrySelectedId(m.machineId)
                            setDetailTab('overview')
                          }}
                          className={cn(
                            'w-full text-left p-3.5 transition-all flex items-center justify-between gap-3 group',
                            isSelected
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-l-4 border-l-emerald-600'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                          )}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                {m.machineName}
                              </p>
                              {m.machineCode && (
                                <span className="font-mono text-[10px] text-zinc-400 font-semibold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
                                  {m.machineCode}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                              <span>{m.runs} runs</span>
                              <span>·</span>
                              <span>{m.produced > 0 ? `${m.produced.toLocaleString()} pcs` : 'No output'}</span>
                              {m.downtimeMinutes > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-rose-600 font-medium">
                                    {formatMinutes(m.downtimeMinutes)} DT
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Mini progress bar */}
                            <div className="w-36 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                              <div
                                className={cn('h-full rounded-full', oeeBarColor(m.oeePercent))}
                                style={{ width: `${Math.min(m.oeePercent || 0, 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={cn(
                                'inline-block px-2 py-0.5 rounded-md text-xs font-black tabular-nums border',
                                oeeBadgeColor(m.oeePercent)
                              )}
                            >
                              {m.oeePercent != null ? `${m.oeePercent}%` : '—'}
                            </span>
                            <ChevronRight className="size-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform mt-1 ml-auto" />
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Detailed Selected Machine Telemetry */}
              {selectedTelemetry ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                            {selectedTelemetry.machineName}
                          </h2>
                          {selectedTelemetry.machineCode && (
                            <span className="font-mono text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                              {selectedTelemetry.machineCode}
                            </span>
                          )}
                          <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                            {selectedTelemetry.status || 'ACTIVE'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          {selectedTelemetry.ratedOutputPerHour
                            ? `Rated output capacity: ${selectedTelemetry.ratedOutputPerHour} units/hour`
                            : 'Standard floor machine specification'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-bold gap-1 text-amber-700 dark:text-amber-300"
                          onClick={() => {
                            const found = allMachines.find((m) => String(m.id) === String(selectedTelemetry.machineId) || m.name === selectedTelemetry.machineName)
                            if (found) open360View(found.id)
                          }}
                        >
                          <Activity className="size-3.5" />
                          <span>Full 360° Specs</span>
                        </Button>

                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                            Overall OEE
                          </span>
                          <span
                            className={cn(
                              'text-2xl font-black tabular-nums inline-block px-2.5 py-0.5 rounded-xl border mt-0.5',
                              oeeBadgeColor(selectedTelemetry.oeePercent)
                            )}
                          >
                            {selectedTelemetry.oeePercent != null ? `${selectedTelemetry.oeePercent}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3 OEE Pillars */}
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {/* Availability */}
                      <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            1. Availability
                          </span>
                          <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">
                            {selectedTelemetry.availabilityPercent != null ? `${selectedTelemetry.availabilityPercent}%` : '—'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.min(selectedTelemetry.availabilityPercent || 0, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400">
                          Runtime ({formatMinutes(selectedTelemetry.runtimeMinutes)}) vs total scheduled
                        </p>
                      </div>

                      {/* Performance */}
                      <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            2. Performance
                          </span>
                          <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">
                            {selectedTelemetry.performancePercent != null ? `${selectedTelemetry.performancePercent}%` : '—'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{ width: `${Math.min(selectedTelemetry.performancePercent || 0, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400">
                          Actual run speed vs rated capacity
                        </p>
                      </div>

                      {/* Quality */}
                      <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            3. Quality Yield
                          </span>
                          <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">
                            {selectedTelemetry.qualityPercent != null ? `${selectedTelemetry.qualityPercent}%` : '—'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(selectedTelemetry.qualityPercent || 0, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400">
                          Good pieces ({selectedTelemetry.good.toLocaleString()}) vs total output
                        </p>
                      </div>
                    </div>

                    {/* Sub-tabs */}
                    <div className="mt-5 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                      <div className="flex items-center gap-1.5">
                        {[
                          { id: 'overview', label: 'Products & Output', icon: Layers },
                          { id: 'people', label: 'Assigned Operators', icon: Users },
                          { id: 'stops', label: 'Root Causes & Stops', icon: Clock },
                        ].map((tab) => {
                          const Icon = tab.icon
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setDetailTab(tab.id as 'overview' | 'people' | 'stops')}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                detailTab === tab.id
                                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                              )}
                            >
                              <Icon className="size-3.5" />
                              <span>{tab.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Products */}
                      {detailTab === 'overview' && (
                        <div className="mt-4 space-y-2">
                          {!selectedTelemetry.products?.length ? (
                            <p className="p-4 text-center text-xs text-zinc-400">No product output logged.</p>
                          ) : (
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                              {selectedTelemetry.products.map((p) => (
                                <div key={p.productId} className="py-2.5 flex items-center justify-between text-xs">
                                  <div>
                                    <p className="font-bold text-zinc-900 dark:text-zinc-100">{p.name}</p>
                                    <p className="text-[10px] text-zinc-400">{p.runs} production runs</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-black text-zinc-800 dark:text-zinc-200">{p.produced.toLocaleString()} pcs</span>
                                    {p.downtimeMinutes > 0 && (
                                      <p className="text-[10px] text-rose-600">{formatMinutes(p.downtimeMinutes)} DT</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Operators */}
                      {detailTab === 'people' && (
                        <div className="mt-4 space-y-2">
                          {!selectedTelemetry.operators?.length ? (
                            <p className="p-4 text-center text-xs text-zinc-400">No operators recorded.</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {selectedTelemetry.operators.map((op) => (
                                <div key={op.name} className="p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
                                  <p className="font-bold text-zinc-900 dark:text-zinc-100">{op.name}</p>
                                  <p className="text-[10px] text-zinc-400">{op.count} runs assigned</p>
                                  {op.minutes > 0 && (
                                    <p className="text-[10px] text-rose-600 font-semibold mt-1">{formatMinutes(op.minutes)} stoppage</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Root causes */}
                      {detailTab === 'stops' && (
                        <div className="mt-4 space-y-2">
                          {!selectedTelemetry.reasons?.length ? (
                            <p className="p-4 text-center text-xs text-zinc-400">No stoppage reasons logged.</p>
                          ) : (
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                              {selectedTelemetry.reasons.map((r) => (
                                <div key={r.name} className="py-2 flex items-center justify-between text-xs">
                                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{r.name}</span>
                                  <div className="text-right">
                                    <span className="font-bold text-rose-600 tabular-nums">{formatMinutes(r.minutes)}</span>
                                    <span className="text-[10px] text-zinc-400 ml-1">({r.count}x)</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Stoppages Breakdown Table */}
            <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-rose-600" />
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Recent Stoppages & Root Causes</h2>
                </div>
                <span className="text-xs text-zinc-400">Last 15 downtime events</span>
              </div>

              <div className="overflow-x-auto">
                {recent.length ? (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                        <th className="py-2.5 pr-4">Machine & Batch</th>
                        <th className="py-2.5 pr-4">Operator</th>
                        <th className="py-2.5 pr-4">Stoppage Reason</th>
                        <th className="py-2.5 pr-4">Duration</th>
                        <th className="py-2.5 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {recent.map((row, idx) => (
                        <tr key={`${row.at}-${idx}`} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                          <td className="py-3 pr-4">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">{row.machineName}</p>
                            {row.batchNumber ? (
                              <Link
                                to={`/batches/${row.batchNumber}`}
                                className="font-mono text-[11px] text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
                              >
                                <span>#{row.batchNumber}</span>
                                <ExternalLink className="size-2.5 text-zinc-400" />
                              </Link>
                            ) : (
                              <span className="text-[11px] text-zinc-400">{row.productOrStage}</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 font-medium text-zinc-800 dark:text-zinc-200">
                            {row.operatorName}
                          </td>
                          <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-300 font-medium">
                            {row.reason}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="font-black text-rose-600 tabular-nums bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                              {formatMinutes(row.minutes)}
                            </span>
                          </td>
                          <td className="py-3 text-right text-zinc-400 text-[11px] tabular-nums">
                            {formatDateTime(row.at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-8 text-center text-xs text-zinc-400">No downtime events recorded.</p>
                )}
              </div>
            </div>
          </div>
        )}



        {/* ==================================================================== */}
        {/* LOG / EDIT MAINTENANCE MODAL (Shadcn Select) */}
        {/* ==================================================================== */}
        <Dialog open={isMaintModalOpen} onOpenChange={setIsMaintModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-zinc-900 dark:text-white">
                {editingMaint ? 'Edit Maintenance Record' : 'Log Machine Maintenance'}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Record service, scheduled inspections, part replacements, or emergency repairs.
              </DialogDescription>
            </DialogHeader>

            {maintFormError && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/60 p-2.5 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {maintFormError}
              </div>
            )}

            <div className="space-y-3.5 py-2">
              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Select Machine *
                </Label>
                <div className="mt-1">
                  <Select value={maintMachineId} onValueChange={setMaintMachineId}>
                    <SelectTrigger className="w-full h-9 text-xs font-semibold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                      <SelectValue placeholder="-- Choose Machine --" />
                    </SelectTrigger>
                    <SelectContent>
                      {allMachines.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.name} ({m.code || 'NO-CODE'}) - {m.machineType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Maintenance Title / Service Summary *
                </Label>
                <Input
                  placeholder="e.g. Monthly hydraulic oil change & motor filter check"
                  className="mt-1 h-9 text-xs"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Maintenance Type
                  </Label>
                  <div className="mt-1">
                    <Select value={maintType} onValueChange={setMaintType}>
                      <SelectTrigger className="w-full h-9 text-xs font-semibold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PREVENTIVE">PREVENTIVE</SelectItem>
                        <SelectItem value="CORRECTIVE">CORRECTIVE</SelectItem>
                        <SelectItem value="OVERHAUL">OVERHAUL</SelectItem>
                        <SelectItem value="INSPECTION">INSPECTION</SelectItem>
                        <SelectItem value="EMERGENCY">EMERGENCY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Status
                  </Label>
                  <div className="mt-1">
                    <Select value={maintStatus} onValueChange={(val: any) => setMaintStatus(val)}>
                      <SelectTrigger className="w-full h-9 text-xs font-semibold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                        <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                        <SelectItem value="SCHEDULED">SCHEDULED</SelectItem>
                        <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Technician / Contractor
                  </Label>
                  <Input
                    placeholder="e.g. Isaac Kwesi / MechTech"
                    className="mt-1 h-9 text-xs"
                    value={maintTechnician}
                    onChange={(e) => setMaintTechnician(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Date & Time
                  </Label>
                  <Input
                    type="datetime-local"
                    className="mt-1 h-9 text-xs"
                    value={maintPerformedDate}
                    onChange={(e) => setMaintPerformedDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Cost (₦)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="mt-1 h-9 text-xs font-mono"
                    value={maintCost}
                    onChange={(e) => setMaintCost(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Downtime Caused (min)
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    className="mt-1 h-9 text-xs font-mono"
                    value={maintDowntime}
                    onChange={(e) => setMaintDowntime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Parts Replaced / Installed (optional)
                </Label>
                <Input
                  placeholder="e.g. 2x O-Ring seal, 1x hydraulic oil filter 40μm"
                  className="mt-1 h-9 text-xs"
                  value={maintParts}
                  onChange={(e) => setMaintParts(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Detailed Notes / Findings
                </Label>
                <Textarea
                  placeholder="Notes on machine condition, test run observations, recommended follow-up..."
                  className="mt-1 text-xs min-h-[70px]"
                  value={maintNotes}
                  onChange={(e) => setMaintNotes(e.target.value)}
                />
              </div>

              {!editingMaint && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="updateMachineStatus"
                    checked={updateMachineStatusOnMaint}
                    onChange={(e) => setUpdateMachineStatusOnMaint(e.target.checked)}
                    className="size-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="updateMachineStatus" className="text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    Sync machine status (set machine to MAINTENANCE if in progress, or RUNNING if completed)
                  </label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold"
                onClick={() => setIsMaintModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#1a1205]"
                onClick={() => saveMaintenanceMutation.mutate()}
                disabled={saveMaintenanceMutation.isPending}
              >
                {saveMaintenanceMutation.isPending ? 'Saving…' : editingMaint ? 'Update Record' : 'Save Maintenance'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ==================================================================== */}
        {/* ADD / EDIT MACHINE MODAL (Shadcn Select) */}
        {/* ==================================================================== */}
        <Dialog open={isMachineModalOpen} onOpenChange={setIsMachineModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-zinc-900 dark:text-white">
                {editingMachine ? 'Edit Machine' : 'Add New Machine'}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Configure equipment code, name, category, and standard rated output speed.
              </DialogDescription>
            </DialogHeader>

            {machineFormError && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/60 p-2.5 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {machineFormError}
              </div>
            )}

            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Machine Name *
                </Label>
                <Input
                  placeholder="e.g. Crusher Line 1, Extruder A"
                  className="mt-1 h-9 text-xs"
                  value={machineFormName}
                  onChange={(e) => setMachineFormName(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Machine Code (Optional, auto-generated if blank)
                </Label>
                <Input
                  placeholder="e.g. MCH-001"
                  className="mt-1 h-9 text-xs font-mono uppercase"
                  value={machineFormCode}
                  onChange={(e) => setMachineFormCode(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Machine Type
                  </Label>
                  <div className="mt-1">
                    <Select value={machineFormType} onValueChange={setMachineFormType}>
                      <SelectTrigger className="w-full h-9 text-xs font-semibold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRODUCTION">PRODUCTION</SelectItem>
                        <SelectItem value="EXTRUDER">EXTRUDER</SelectItem>
                        <SelectItem value="CRUSHER">CRUSHER</SelectItem>
                        <SelectItem value="WASHER">WASHER</SelectItem>
                        <SelectItem value="DRYER">DRYER</SelectItem>
                        <SelectItem value="RECYCLING">RECYCLING</SelectItem>
                        <SelectItem value="GENERAL">GENERAL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Current Status
                  </Label>
                  <div className="mt-1">
                    <Select value={machineFormStatus} onValueChange={setMachineFormStatus}>
                      <SelectTrigger className="w-full h-9 text-xs font-semibold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RUNNING">RUNNING</SelectItem>
                        <SelectItem value="MAINTENANCE">MAINTENANCE</SelectItem>
                        <SelectItem value="IDLE">IDLE</SelectItem>
                        <SelectItem value="STOPPED">STOPPED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Rated Output Capacity (units per hour)
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  className="mt-1 h-9 text-xs font-mono"
                  value={machineFormRatedOutput}
                  onChange={(e) => setMachineFormRatedOutput(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold"
                onClick={() => setIsMachineModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#1a1205]"
                onClick={() => saveMachineMutation.mutate()}
                disabled={saveMachineMutation.isPending}
              >
                {saveMachineMutation.isPending ? 'Saving…' : editingMachine ? 'Update Machine' : 'Create Machine'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  )
}
