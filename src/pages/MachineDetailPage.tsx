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
  Activity,
  Pencil,
  ExternalLink,
  Layers,
  Users,
  Trash2,
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
import { fmtDozenPcs } from '@/lib/units'
import { MaintenanceCostAndDowntime, MaintenancePhotoPicker } from '@/components/MaintenanceLogExtras'
import {
  downtimeToMinutes,
  minutesToDowntime,
  minutesBetweenDateTimes,
  combineDateAndTime,
  parsePhotoUrls,
  toDateInputValue,
  toTimeInputValue,
  type DowntimeUnit,
} from '@/lib/maintenanceForm'

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
  startedAt?: string | null
  endedAt?: string | null
  notes?: string | null
  photoUrls?: string[] | string | null
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
  if (min >= 1440) {
    const d = Math.floor(min / 1440)
    const rem = min % 1440
    const h = Math.floor(rem / 60)
    return h ? `${d}d ${h}h` : `${d}d`
  }
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

  const [activeTab, setActiveTab] = useState<'maintenance' | 'downtime' | 'telemetry'>('maintenance')

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
  const [maintDownUnit, setMaintDownUnit] = useState<DowntimeUnit>('hours')
  const [maintDownValue, setMaintDownValue] = useState('0')
  const [maintPhotos, setMaintPhotos] = useState<string[]>([])
  const [maintParts, setMaintParts] = useState('')
  const [maintNotes, setMaintNotes] = useState('')
  const [maintDate, setMaintDate] = useState('')
  const [maintFromTime, setMaintFromTime] = useState('')
  const [maintToTime, setMaintToTime] = useState('')
  const [updateMachineStatusOnMaint, setUpdateMachineStatusOnMaint] = useState(true)
  const [maintFormError, setMaintFormError] = useState('')

  // Machine form state
  const [machineFormName, setMachineFormName] = useState('')
  const [machineFormCode, setMachineFormCode] = useState('')
  const [machineFormType, setMachineFormType] = useState('PRODUCTION')
  const [machineFormStatus, setMachineFormStatus] = useState('RUNNING')
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
      if (!maintDate) throw new Error('Select a date')
      if (!maintFromTime || !maintToTime) throw new Error('Select from and to time')
      const fromLocal = combineDateAndTime(maintDate, maintFromTime)
      const toLocal = combineDateAndTime(maintDate, maintToTime)
      if (new Date(toLocal) < new Date(fromLocal)) {
        throw new Error('End time must be after start time')
      }
      const fromMins = minutesBetweenDateTimes(maintDate, maintFromTime, maintToTime)
      const downtimeMinutes =
        fromMins > 0 ? fromMins : downtimeToMinutes(maintDownUnit, maintDownValue)
      const endIso = new Date(toLocal).toISOString()
      const payload = {
        machineId: Number(id),
        title: maintTitle.trim(),
        maintenanceType: maintType,
        status: maintStatus,
        technician: maintTechnician.trim() || null,
        cost: maintCost ? Number(maintCost) : 0,
        downtimeMinutes,
        photoUrls: maintPhotos,
        partsReplaced: maintParts.trim() || null,
        notes: maintNotes.trim() || null,
        startedAt: new Date(fromLocal).toISOString(),
        endedAt: endIso,
        performedDate: endIso,
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

  const deleteMaintenanceMutation = useMutation({
    mutationFn: async (maintenanceId: number) => {
      const { data } = await api.delete(`/maintenance/${maintenanceId}`)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machine-360', id] })
      qc.invalidateQueries({ queryKey: ['masters-maintenance'] })
      qc.invalidateQueries({ queryKey: ['masters-machines'] })
    },
  })

  function confirmDeleteMaintenance(rec: MaintenanceRecord) {
    if (!window.confirm(`Delete maintenance “${rec.title}”?`)) return
    deleteMaintenanceMutation.mutate(rec.id)
  }

  const deleteMachineMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete(`/machines/${id}`)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['masters-machines'] })
      qc.invalidateQueries({ queryKey: ['machine-insights'] })
      navigate('/machines')
    },
  })

  function syncMaintDowntime(date: string, fromTime: string, toTime: string) {
    const mins = minutesBetweenDateTimes(date, fromTime, toTime)
    if (mins > 0) {
      const down = minutesToDowntime(mins)
      setMaintDownUnit(down.unit)
      setMaintDownValue(down.value)
    }
  }

  function openCreateMaintenance() {
    setEditingMaint(null)
    setMaintTitle('')
    setMaintType('PREVENTIVE')
    setMaintStatus('COMPLETED')
    setMaintTechnician('')
    setMaintCost('')
    setMaintDownUnit('hours')
    setMaintDownValue('0')
    setMaintPhotos([])
    setMaintParts('')
    setMaintNotes('')
    const now = new Date()
    setMaintDate(toDateInputValue(now))
    setMaintFromTime(toTimeInputValue(now))
    setMaintToTime(toTimeInputValue(now))
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
    const down = minutesToDowntime(rec.downtimeMinutes)
    setMaintDownUnit(down.unit)
    setMaintDownValue(down.value)
    setMaintPhotos(parsePhotoUrls(rec.photoUrls))
    setMaintParts(rec.partsReplaced || '')
    setMaintNotes(rec.notes || '')
    const startRaw = rec.startedAt || rec.performedDate
    const endRaw = rec.endedAt || rec.performedDate
    setMaintDate(toDateInputValue(startRaw || endRaw))
    setMaintFromTime(toTimeInputValue(startRaw))
    setMaintToTime(toTimeInputValue(endRaw))
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
    setMachineFormError('')
    setIsMachineModalOpen(true)
  }

  // Maintenance Table Columns (CustomTable1 with card={true})
  const maintenanceColumns = useMemo<ColumnDef<MaintenanceRecord>[]>(
    () => [
      {
        id: 'date',
        header: 'From → To',
        cell: ({ row }) => {
          const from = row.original.startedAt || row.original.performedDate || row.original.createdAt
          const to = row.original.endedAt || row.original.performedDate
          return (
            <div className="text-xs text-zinc-500 tabular-nums whitespace-nowrap">
              <p>{formatDateTime(from || '')}</p>
              {to && from && String(to) !== String(from) && (
                <p className="text-[10px] text-zinc-400">→ {formatDateTime(to)}</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'title',
        header: 'Service Title & Type',
        cell: ({ row }) => {
          const photos = parsePhotoUrls(row.original.photoUrls)
          return (
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={cn('px-1.5 py-0.2 rounded text-[9px] font-extrabold border', maintenanceTypeColor(row.original.maintenanceType))}>
                {row.original.maintenanceType}
              </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">{row.original.title}</span>
            </div>
            {photos.length > 0 && (
              <p className="text-[11px] text-zinc-500">
                {photos.length} photo{photos.length === 1 ? '' : 's'}
              </p>
            )}
            {row.original.partsReplaced && (
              <p className="text-[11px] text-zinc-500 truncate max-w-xs">
                Parts: {row.original.partsReplaced}
              </p>
            )}
          </div>
          )
        },
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
          <div className="flex flex-nowrap items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs font-semibold"
              onClick={() => openEditMaintenance(row.original)}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50"
              onClick={() => confirmDeleteMaintenance(row.original)}
              disabled={deleteMaintenanceMutation.isPending}
            >
              Delete
            </Button>
          </div>
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
        title="Machine"
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate">{machine.name}</span>
          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black border uppercase', machineStatusColor(machine.status))}>
            {machine.status || 'RUNNING'}
          </span>
        </div>
      }
      description={
        <span className="hidden sm:inline">
          {machine.machineType}
          {machine.createdAt ? ` · Registered ${formatDateTime(machine.createdAt)}` : ''}
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 px-0 sm:w-auto sm:px-3 text-xs font-semibold gap-1.5"
            onClick={() => detailQuery.refetch()}
            disabled={detailQuery.isFetching}
          >
            <RefreshCw className={cn('size-3.5', detailQuery.isFetching && 'animate-spin')} />
            <span className="hidden sm:inline">{detailQuery.isFetching ? 'Updating…' : 'Refresh'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 px-0 sm:w-auto sm:px-3 text-xs font-semibold gap-1.5"
            onClick={openEditMachineModal}
          >
            <Pencil className="size-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 px-0 text-zinc-400 hover:text-rose-600"
            onClick={() => {
              if (!window.confirm(`Delete ${machine.name}? It will be removed from the machine list.`)) return
              deleteMachineMutation.mutate()
            }}
            disabled={deleteMachineMutation.isPending}
          >
            <Trash2 className="size-3.5" />
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5 px-2.5 sm:px-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[#1a1205] shadow-xs"
            onClick={openCreateMaintenance}
          >
            <Wrench className="size-3.5" />
            <span>Log Maintenance</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
          <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-2 shadow-xs">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">
              Visits
            </span>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
              {stats.totalMaintenanceCount}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-2 shadow-xs">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">
              Spend
            </span>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white truncate">
              {formatNgn(stats.totalMaintenanceCost)}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-2 shadow-xs">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">
              Downtime
            </span>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-rose-600">
              {formatMinutes(stats.totalDowntimeMinutes)}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-2 shadow-xs">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 block">
              Output
            </span>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
              {fmtDozenPcs(stats.totalProduced)}
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <div className="flex gap-2">
            {[
              { id: 'maintenance', label: 'Maintenance', icon: Wrench, count: maintenances.length },
              {
                id: 'downtime',
                label: 'Downtime',
                icon: Clock,
                count: (downtimes.production?.length || 0) + (downtimes.process?.length || 0),
              },
              { id: 'telemetry', label: 'OEE', icon: Activity },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all shrink-0',
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
          <CustomTable1<MaintenanceRecord>
            data={maintenances}
            columns={maintenanceColumns}
            card={true}
            pagination={true}
          />
        )}

        {/* TAB 2: DOWNTIME & STOPPAGES */}
        {activeTab === 'downtime' && (
          <div className="space-y-3">
            {/* Production Stoppages */}
            <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 sm:p-4 shadow-xs space-y-3">
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
              <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 sm:p-4 shadow-xs space-y-3">
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
          <div className="space-y-3">
            {telemetry ? (
              <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 sm:p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 dark:text-white">OEE</h3>
                    <p className="text-xs text-zinc-400">Output in dozen and pieces</p>
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
                    <p className="text-[10px] text-zinc-400">Good vs total ({fmtDozenPcs(telemetry.good)} / {fmtDozenPcs(telemetry.produced)})</p>
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
                            <span className="font-black text-zinc-800 dark:text-zinc-200">{fmtDozenPcs(p.produced)}</span>
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

        <Dialog open={isMaintModalOpen} onOpenChange={setIsMaintModalOpen}>
          <DialogContent className="sm:max-w-lg">
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Date *
                  </Label>
                  <Input
                    type="date"
                    className="mt-1 h-9 text-xs"
                    value={maintDate}
                    onChange={(e) => {
                      setMaintDate(e.target.value)
                      syncMaintDowntime(e.target.value, maintFromTime, maintToTime)
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    From time *
                  </Label>
                  <Input
                    type="time"
                    className="mt-1 h-9 text-xs"
                    value={maintFromTime}
                    onChange={(e) => {
                      setMaintFromTime(e.target.value)
                      syncMaintDowntime(maintDate, e.target.value, maintToTime)
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    To time *
                  </Label>
                  <Input
                    type="time"
                    className="mt-1 h-9 text-xs"
                    value={maintToTime}
                    onChange={(e) => {
                      setMaintToTime(e.target.value)
                      syncMaintDowntime(maintDate, maintFromTime, e.target.value)
                    }}
                  />
                </div>
              </div>
              {minutesBetweenDateTimes(maintDate, maintFromTime, maintToTime) > 0 && (
                <p className="text-[11px] text-zinc-500 -mt-2">
                  Duration:{' '}
                  {minutesBetweenDateTimes(maintDate, maintFromTime, maintToTime).toLocaleString()} min
                  {minutesBetweenDateTimes(maintDate, maintFromTime, maintToTime) >= 60
                    ? ` (${(minutesBetweenDateTimes(maintDate, maintFromTime, maintToTime) / 60).toFixed(1)} h)`
                    : ''}
                </p>
              )}

              <MaintenanceCostAndDowntime
                cost={maintCost}
                onCost={setMaintCost}
                downUnit={maintDownUnit}
                downValue={maintDownValue}
                onDownUnit={setMaintDownUnit}
                onDownValue={setMaintDownValue}
              />

              <MaintenancePhotoPicker photos={maintPhotos} onChange={setMaintPhotos} />

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
          <DialogContent className="sm:max-w-md">
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
