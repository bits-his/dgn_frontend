import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  ChevronLeft,
  Clock,
  Cpu,
  RefreshCw,
  Wrench,
  Plus,
  Activity,
  Pencil,
  ExternalLink,
  Layers,
  Users,
} from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
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

type MachineMaster = {
  id: number
  code: string
  name: string
  machineType: string
  status: string
  ratedOutputPerHour: number | string | null
  isActive: boolean
  createdAt?: string
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
}

type Machine360Detail = {
  machine: MachineMaster
  maintenances: MaintenanceRecord[]
  downtimes: {
    production: Array<{
      id: number
      batchId: number
      downtimeMinutes: number
      downtimeReason: string
      startedAt: string
      endedAt: string
      operatorName: string
      batch?: { batchNumber: string }
    }>
    process: Array<{
      id: number
      batchId: number
      stage: string
      downtimeMinutes: number
      downtimeReason: string
      startedAt: string
      endedAt: string
      operatorName: string
      batch?: { batchNumber: string }
    }>
  }
  stats: {
    totalRuns: number
    totalProduced: number
    totalDowntimeMinutes: number
    totalMaintenanceCount: number
    totalMaintenanceCost: number
  }
}

type MachineInsight = {
  machineId: number | string
  machineName: string
  machineCode: string | null
  status: string | null
  ratedOutputPerHour: number | null
  runtimeMinutes: number
  downtimeMinutes: number
  availabilityPercent: number | null
  performancePercent: number | null
  qualityPercent: number | null
  oeePercent: number | null
  produced: number
  good: number
  reject: number
  products: Array<{
    productId: number
    name: string
    produced: number
    good: number
    reject: number
    downtimeMinutes: number
    runs: number
  }>
  operators: Array<{ name: string; count: number; minutes: number }>
  reasons: Array<{ name: string; count: number; minutes: number }>
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

function oeeBadgeColor(oee: number | null) {
  if (oee == null) return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
  if (oee >= 75) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
  if (oee >= 55) return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
  return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
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

export function MachineDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState<'maintenance' | 'downtime' | 'telemetry' | 'specs'>('maintenance')

  // Modals
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false)
  const [editingMaint, setEditingMaint] = useState<MaintenanceRecord | null>(null)
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false)

  // Maintenance form state
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

  // Query machine 360 detail with instant cached data + stale-while-revalidate background fetch
  const detailQuery = useQuery({
    queryKey: ['machine-360', id],
    queryFn: async () => {
      const { data } = await api.get(`/machines/${id}`)
      return data.data as Machine360Detail
    },
    initialData: () => {
      // 1. Check React Query cache for this machine
      const cachedMachines = qc.getQueryData<MachineMaster[]>(['masters-machines'])
      const match = cachedMachines?.find((m) => String(m.id) === String(id))

      // Check cached maintenance records
      const cachedMaint = qc.getQueryData<MaintenanceRecord[]>(['masters-maintenance'])
      const machineMaint = cachedMaint?.filter((m) => String(m.machineId) === String(id)) || []

      // 2. Check localStorage snapshot of full 360 detail
      try {
        const local = localStorage.getItem(`dgn_machine_360_${id}`)
        if (local) {
          const parsed = JSON.parse(local) as Machine360Detail
          if (parsed?.machine) return parsed
        }
      } catch {}

      // 3. Fallback to cached machine list in localStorage
      try {
        const localList = localStorage.getItem('dgn_cached_machines')
        if (localList) {
          const parsedList = JSON.parse(localList) as MachineMaster[]
          const found = parsedList.find((m) => String(m.id) === String(id))
          if (found) {
            return {
              machine: found,
              maintenances: machineMaint,
              downtimes: { production: [], process: [] },
              stats: {
                totalRuns: 0,
                totalProduced: 0,
                totalDowntimeMinutes: 0,
                totalMaintenanceCount: machineMaint.length,
                totalMaintenanceCost: machineMaint.reduce((sum, m) => sum + Number(m.cost || 0), 0),
              },
            }
          }
        }
      } catch {}

      if (match) {
        return {
          machine: match,
          maintenances: machineMaint,
          downtimes: { production: [], process: [] },
          stats: {
            totalRuns: 0,
            totalProduced: 0,
            totalDowntimeMinutes: 0,
            totalMaintenanceCount: machineMaint.length,
            totalMaintenanceCost: machineMaint.reduce((sum, m) => sum + Number(m.cost || 0), 0),
          },
        }
      }

      return undefined
    },
    initialDataUpdatedAt: 0,
    enabled: Boolean(id),
  })

  // Synchronize successful detail fetches to localStorage for instant offline/mobile retrieval
  useEffect(() => {
    if (detailQuery.data && id) {
      try {
        localStorage.setItem(`dgn_machine_360_${id}`, JSON.stringify(detailQuery.data))
      } catch {}
    }
  }, [detailQuery.data, id])

  // Query telemetry insights with cached initial data
  const insightsQuery = useQuery({
    queryKey: ['machine-insights'],
    queryFn: async () => {
      const { data } = await api.get('/production/machine-insights')
      return data.data as { machines: MachineInsight[] }
    },
    initialData: () => {
      try {
        const local = localStorage.getItem('dgn_cached_machine_insights')
        if (local) return JSON.parse(local) as { machines: MachineInsight[] }
      } catch {}
      return undefined
    },
    initialDataUpdatedAt: 0,
  })

  useEffect(() => {
    if (insightsQuery.data) {
      try {
        localStorage.setItem('dgn_cached_machine_insights', JSON.stringify(insightsQuery.data))
      } catch {}
    }
  }, [insightsQuery.data])

  const machine = detailQuery.data?.machine
  const maintenances = detailQuery.data?.maintenances || []
  const downtimes = detailQuery.data?.downtimes || { production: [], process: [] }
  const stats = detailQuery.data?.stats || {
    totalRuns: 0,
    totalProduced: 0,
    totalDowntimeMinutes: 0,
    totalMaintenanceCount: 0,
    totalMaintenanceCost: 0,
  }

  // Find telemetry for this machine if available
  const telemetry = useMemo(() => {
    if (!machine || !insightsQuery.data?.machines) return null
    return (
      insightsQuery.data.machines.find(
        (m) =>
          String(m.machineId) === String(machine.id) ||
          m.machineName.toLowerCase().trim() === machine.name.toLowerCase().trim() ||
          (machine.code && m.machineCode?.toLowerCase().trim() === machine.code.toLowerCase().trim())
      ) || null
    )
  }, [machine, insightsQuery.data])

  // Save Maintenance Mutation
  const saveMaintenanceMutation = useMutation({
    mutationFn: async () => {
      setMaintFormError('')
      const payload = {
        machineId: Number(id),
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
      if (!payload.title) {
        throw new Error('Title is required')
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
      qc.invalidateQueries({ queryKey: ['machine-360', id] })
      qc.invalidateQueries({ queryKey: ['masters-maintenance'] })
      qc.invalidateQueries({ queryKey: ['masters-machines'] })
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
      const { data } = await api.patch(`/machines/${id}`, payload)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machine-360', id] })
      qc.invalidateQueries({ queryKey: ['masters-machines'] })
      setIsMachineModalOpen(false)
    },
    onError: (err: any) => {
      setMachineFormError(err.response?.data?.err || err.message || 'Failed to save machine')
    },
  })

  function openCreateMaintenance() {
    setEditingMaint(null)
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

  function openEditMachineModal() {
    if (!machine) return
    setMachineFormName(machine.name)
    setMachineFormCode(machine.code || '')
    setMachineFormType(machine.machineType || 'PRODUCTION')
    setMachineFormStatus(machine.status || 'RUNNING')
    setMachineFormRatedOutput(machine.ratedOutputPerHour != null ? String(machine.ratedOutputPerHour) : '')
    setMachineFormError('')
    setIsMachineModalOpen(true)
  }

  // Maintenance Table Columns (CustomTable1 with card={true})
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

  if (detailQuery.isLoading && !machine) {
    return (
      <PageLayout
        back={true}
        backTo="/machines"
        backLabel="Machines"
        title="Machine 360° View"
        description="Loading equipment telemetry and history…"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4 space-y-2 animate-pulse">
                <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-20" />
                <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded w-16" />
                <div className="h-3 bg-zinc-100 dark:bg-zinc-900 rounded w-28" />
              </Card>
            ))}
          </div>
          <Card className="p-10 text-center space-y-3 border border-dashed border-zinc-200 dark:border-zinc-800">
            <RefreshCw className="size-6 text-zinc-400 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 font-semibold">Retrieving machine telemetry & history…</p>
          </Card>
        </div>
      </PageLayout>
    )
  }

  if (!machine) {
    return (
      <PageLayout
        back={true}
        backTo="/machines"
        backLabel="Machines"
        title="Machine Not Found"
        description="The requested machine could not be found."
      >
        <Card className="p-8 text-center space-y-3">
          <Cpu className="size-10 text-zinc-300 mx-auto" />
          <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">Machine #{id} does not exist</p>
          <Button size="sm" onClick={() => navigate('/machines')} className="gap-1.5 text-xs">
            <ChevronLeft className="size-4" />
            <span>Back to Machines</span>
          </Button>
        </Card>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      back={true}
      backTo="/machines"
      backLabel="Machines"
      title={
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <span className="truncate">{machine.name}</span>
          {machine.code && (
            <span className="font-mono text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
              {machine.code}
            </span>
          )}
          <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-black border uppercase', machineStatusColor(machine.status))}>
            {machine.status || 'RUNNING'}
          </span>
        </div>
      }
      description={`Category: ${machine.machineType} · Rated Speed: ${Number(machine.ratedOutputPerHour || 0) > 0 ? `${Number(machine.ratedOutputPerHour)} pcs/hr` : 'Standard'} · Registered: ${formatDateTime(machine.createdAt || '')}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5"
            onClick={() => detailQuery.refetch()}
            disabled={detailQuery.isFetching}
          >
            <RefreshCw className={cn('size-3.5', detailQuery.isFetching && 'animate-spin')} />
            <span>{detailQuery.isFetching ? 'Updating…' : 'Refresh'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5"
            onClick={openEditMachineModal}
          >
            <Pencil className="size-3.5" />
            <span>Edit Machine</span>
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#1a1205] shadow-xs"
            onClick={openCreateMaintenance}
          >
            <Wrench className="size-3.5" />
            <span>Log Maintenance</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 4 KPI Summary Cards (Full View Style like Batch Detail) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Maintenance Visits
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-zinc-900 dark:text-white tabular-nums">
                {stats.totalMaintenanceCount}
              </span>
              <span className="text-xs text-zinc-500">recorded</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Total Maint Spend
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tabular-nums truncate">
                {formatNgn(stats.totalMaintenanceCost)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Recorded Downtime
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-rose-600 tabular-nums">
                {formatMinutes(stats.totalDowntimeMinutes)}
              </span>
              <span className="text-xs text-zinc-500">lost run time</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              Production Output
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-zinc-900 dark:text-white tabular-nums">
                {stats.totalProduced.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-500">pcs ({stats.totalRuns} runs)</span>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <div className="flex gap-2">
            {[
              { id: 'maintenance', label: 'Maintenance History', icon: Wrench, count: maintenances.length },
              {
                id: 'downtime',
                label: 'Downtime & Stoppages',
                icon: Clock,
                count: (downtimes.production?.length || 0) + (downtimes.process?.length || 0),
              },
              { id: 'telemetry', label: 'Telemetry & OEE', icon: Activity },
              { id: 'specs', label: 'Equipment Specifications', icon: Cpu },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0',
                    isActive
                      ? 'border-[var(--accent-strong)] text-[var(--accent-strong)] bg-amber-500/5'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  )}
                >
                  <Icon className="size-4" />
                  <span>{tab.label}</span>
                  {tab.count != null && (
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                        isActive ? 'bg-[var(--accent)] text-[#1a1205]' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* TAB 1: MAINTENANCE HISTORY */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Maintenance Logbook</h3>
                <p className="text-xs text-zinc-500">Service visits, scheduled maintenance, and repairs for {machine.name}.</p>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#1a1205]"
                onClick={openCreateMaintenance}
              >
                <Plus className="size-3.5" />
                <span>Log Maintenance</span>
              </Button>
            </div>

            <CustomTable1<MaintenanceRecord>
              data={maintenances}
              columns={maintenanceColumns}
              card={true}
              pagination={true}
            />
          </div>
        )}

        {/* TAB 2: DOWNTIME & STOPPAGES */}
        {activeTab === 'downtime' && (
          <div className="space-y-6">
            {/* Production Stoppages */}
            <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-rose-600" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Production Run Stoppages</h3>
                </div>
                <span className="text-xs text-zinc-400">{downtimes.production?.length || 0} events recorded</span>
              </div>

              {!downtimes.production?.length ? (
                <p className="p-8 text-center text-xs text-zinc-400">No production stoppages logged for this machine.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                        <th className="py-2.5 pr-4">Batch / Run</th>
                        <th className="py-2.5 pr-4">Operator</th>
                        <th className="py-2.5 pr-4">Stoppage Reason</th>
                        <th className="py-2.5 pr-4">Duration</th>
                        <th className="py-2.5 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {downtimes.production.map((d) => (
                        <tr key={d.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                          <td className="py-3 pr-4">
                            {d.batch?.batchNumber ? (
                              <Link
                                to={`/batches/${d.batch.batchNumber}`}
                                className="font-mono text-xs font-bold text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
                              >
                                <span>#{d.batch.batchNumber}</span>
                                <ExternalLink className="size-3 text-zinc-400" />
                              </Link>
                            ) : (
                              <span className="font-mono text-xs text-zinc-400">Run #{d.id}</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 font-medium text-zinc-800 dark:text-zinc-200">
                            {d.operatorName || '—'}
                          </td>
                          <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-300 font-medium">
                            {d.downtimeReason || 'General stop'}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="font-black text-rose-600 tabular-nums bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                              {formatMinutes(d.downtimeMinutes)}
                            </span>
                          </td>
                          <td className="py-3 text-right text-zinc-400 text-[11px] tabular-nums">
                            {formatDateTime(d.startedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Process Stoppages */}
            {downtimes.process && downtimes.process.length > 0 && (
              <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Process Stoppages (Washing / Crushing / Drying)</h3>
                  </div>
                  <span className="text-xs text-zinc-400">{downtimes.process.length} events</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold tracking-wider">
                        <th className="py-2.5 pr-4">Stage</th>
                        <th className="py-2.5 pr-4">Batch</th>
                        <th className="py-2.5 pr-4">Stoppage Reason</th>
                        <th className="py-2.5 pr-4">Duration</th>
                        <th className="py-2.5 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {downtimes.process.map((d) => (
                        <tr key={d.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                          <td className="py-3 pr-4">
                            <span className="uppercase text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                              {d.stage}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            {d.batch?.batchNumber ? (
                              <Link
                                to={`/batches/${d.batch.batchNumber}`}
                                className="font-mono text-xs font-bold text-[var(--accent-strong)] hover:underline inline-flex items-center gap-1"
                              >
                                <span>#{d.batch.batchNumber}</span>
                                <ExternalLink className="size-3 text-zinc-400" />
                              </Link>
                            ) : (
                              <span className="text-zinc-400">Run #{d.id}</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-300 font-medium">
                            {d.downtimeReason || 'Stoppage'}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="font-black text-rose-600 tabular-nums bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                              {formatMinutes(d.downtimeMinutes)}
                            </span>
                          </td>
                          <td className="py-3 text-right text-zinc-400 text-[11px] tabular-nums">
                            {formatDateTime(d.startedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TELEMETRY & OEE */}
        {activeTab === 'telemetry' && (
          <div className="space-y-5">
            {telemetry ? (
              <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h3 className="text-base font-black text-zinc-900 dark:text-white">OEE & Equipment Effectiveness</h3>
                    <p className="text-xs text-zinc-400">Live operational telemetry across completed production runs.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Overall OEE</span>
                    <span className={cn('text-2xl font-black tabular-nums inline-block px-3 py-0.5 rounded-xl border mt-0.5', oeeBadgeColor(telemetry.oeePercent))}>
                      {telemetry.oeePercent != null ? `${telemetry.oeePercent}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* 3 Pillars */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">1. Availability</span>
                      <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">{telemetry.availabilityPercent != null ? `${telemetry.availabilityPercent}%` : '—'}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(telemetry.availabilityPercent || 0, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-zinc-400">Operating time vs scheduled runtime ({formatMinutes(telemetry.runtimeMinutes)})</p>
                  </div>

                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">2. Performance</span>
                      <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">{telemetry.performancePercent != null ? `${telemetry.performancePercent}%` : '—'}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(telemetry.performancePercent || 0, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-zinc-400">Actual run speed vs rated nameplate speed</p>
                  </div>

                  <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">3. Quality Yield</span>
                      <span className="text-xs font-black tabular-nums text-zinc-900 dark:text-white">{telemetry.qualityPercent != null ? `${telemetry.qualityPercent}%` : '—'}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(telemetry.qualityPercent || 0, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-zinc-400">Good output vs total ({telemetry.good.toLocaleString()} / {telemetry.produced.toLocaleString()} pcs)</p>
                  </div>
                </div>

                {/* Products & Operators */}
                <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-1.5">
                      <Layers className="size-3.5" />
                      <span>Products Produced</span>
                    </h4>
                    {!telemetry.products?.length ? (
                      <p className="text-xs text-zinc-400">No output recorded yet.</p>
                    ) : (
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                        {telemetry.products.map((p) => (
                          <div key={p.productId} className="py-2 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-zinc-900 dark:text-zinc-100">{p.name}</p>
                              <p className="text-[10px] text-zinc-400">{p.runs} runs</p>
                            </div>
                            <span className="font-black text-zinc-800 dark:text-zinc-200">{p.produced.toLocaleString()} pcs</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      <span>Operators Assigned</span>
                    </h4>
                    {!telemetry.operators?.length ? (
                      <p className="text-xs text-zinc-400">No operators recorded yet.</p>
                    ) : (
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                        {telemetry.operators.map((op) => (
                          <div key={op.name} className="py-2 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-zinc-900 dark:text-zinc-100">{op.name}</p>
                              <p className="text-[10px] text-zinc-400">{op.count} runs</p>
                            </div>
                            {op.minutes > 0 && (
                              <span className="text-rose-600 font-bold text-[11px]">{formatMinutes(op.minutes)} stop</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Card className="p-8 text-center space-y-2">
                <Activity className="size-8 text-zinc-300 mx-auto" />
                <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">No live telemetry runs yet</p>
                <p className="text-xs text-zinc-400">Run production jobs assigned to this machine to generate live OEE metrics.</p>
              </Card>
            )}
          </div>
        )}

        {/* TAB 4: SPECIFICATIONS */}
        {activeTab === 'specs' && (
          <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Machine Profile & Technical Specifications</h3>
                <p className="text-xs text-zinc-400">Registered hardware parameters and operating configurations.</p>
              </div>
              <Button variant="outline" size="sm" onClick={openEditMachineModal} className="gap-1.5 text-xs">
                <Pencil className="size-3" />
                <span>Edit Specs</span>
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Equipment Name</span>
                <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{machine.name}</p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Machine Code</span>
                <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-sm">{machine.code || '—'}</p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Equipment Type</span>
                <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{machine.machineType}</p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Operating Status</span>
                <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{machine.status}</p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Rated Output Speed</span>
                <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                  {Number(machine.ratedOutputPerHour || 0) > 0 ? `${Number(machine.ratedOutputPerHour)} pcs/hour` : 'Standard'}
                </p>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Registered On</span>
                <p className="font-medium text-zinc-600 dark:text-zinc-300 text-sm">{formatDateTime(machine.createdAt || '')}</p>
              </div>
            </div>
          </div>
        )}

        {/* LOG / EDIT MAINTENANCE MODAL (Shadcn Select) */}
        <Dialog open={isMaintModalOpen} onOpenChange={setIsMaintModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-zinc-900 dark:text-white">
                {editingMaint ? 'Edit Maintenance Record' : `Log Maintenance: ${machine.name}`}
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
                  placeholder="e.g. 2x O-Ring seal, 1x hydraulic oil filter"
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
                  placeholder="Notes on machine condition, observations, recommended follow-up..."
                  className="mt-1 text-xs min-h-[70px]"
                  value={maintNotes}
                  onChange={(e) => setMaintNotes(e.target.value)}
                />
              </div>

              {!editingMaint && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="updateMachineStatusDetail"
                    checked={updateMachineStatusOnMaint}
                    onChange={(e) => setUpdateMachineStatusOnMaint(e.target.checked)}
                    className="size-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="updateMachineStatusDetail" className="text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
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

        {/* EDIT MACHINE MODAL (Shadcn Select) */}
        <Dialog open={isMachineModalOpen} onOpenChange={setIsMachineModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-zinc-900 dark:text-white">
                Edit Machine
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Update equipment specifications and operating status.
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
                  className="mt-1 h-9 text-xs"
                  value={machineFormName}
                  onChange={(e) => setMachineFormName(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Machine Code
                </Label>
                <Input
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
                {saveMachineMutation.isPending ? 'Saving…' : 'Update Machine'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  )
}
