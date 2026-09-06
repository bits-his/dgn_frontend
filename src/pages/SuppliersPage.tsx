import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Search, Edit2, MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type Supplier = {
  id: number
  code?: string | null
  name: string
  createdAt?: string
  supplierType?: string | null
  phone?: string | null
  address?: string | null
  isActive?: boolean
}

type FormState = {
  name: string
  supplierType: string
  phone: string
  address: string
  isActive: boolean
}

const emptyForm: FormState = {
  name: '',
  supplierType: 'PICKER',
  phone: '',
  address: '',
  isActive: true,
}

const TYPE_LABEL: Record<string, string> = {
  PICKER: 'Picker',
  DEALER: 'Dealer',
  COMPANY: 'Company',
  OTHER: 'Other',
}

export function SuppliersPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Shadcn Filters state
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const suppliers = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: async () => {
      const { data } = await api.get('/masters/suppliers', {
        params: { includeInactive: '1' },
      })
      return data.data as Supplier[]
    },
  })

  const filtered = useMemo(() => {
    const rows = suppliers.data || []
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter === 'ACTIVE' && row.isActive === false) return false
      if (statusFilter === 'INACTIVE' && row.isActive !== false) return false
      if (typeFilter !== 'ALL' && row.supplierType !== typeFilter) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        String(row.code || '').toLowerCase().includes(q) ||
        String(row.phone || '').toLowerCase().includes(q) ||
        String(row.supplierType || '').toLowerCase().includes(q)
      )
    })
  }, [suppliers.data, query, statusFilter, typeFilter])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        supplierType: form.supplierType || 'PICKER',
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        isActive: form.isActive,
      }
      if (!payload.name) throw new Error('Name is required')
      if (editingId) {
        const { data } = await api.patch(`/masters/suppliers/${editingId}`, payload)
        return data.data as Supplier
      }
      const { data } = await api.post('/masters/suppliers', payload)
      return data.data as Supplier
    },
    onSuccess: async () => {
      setMessage(editingId ? 'Supplier updated' : 'Supplier added')
      setError('')
      setIsModalOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      await qc.invalidateQueries({ queryKey: ['suppliers-all'] })
      await qc.invalidateQueries({ queryKey: ['suppliers'] })
      await qc.invalidateQueries({ queryKey: ['masters', 'suppliers'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { err?: string; msg?: string } }; message?: string }
      setMessage('')
      setError(
        axiosErr.response?.data?.err ||
          axiosErr.response?.data?.msg ||
          axiosErr.message ||
          'Could not save supplier',
      )
    },
  })

  useEffect(() => {
    if (!message && !error) return
    const t = window.setTimeout(() => {
      setMessage('')
      setError('')
    }, 4000)
    return () => window.clearTimeout(t)
  }, [message, error])

  const openAddModal = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setIsModalOpen(true)
  }

  const startEdit = (row: Supplier) => {
    setEditingId(row.id)
    setForm({
      name: row.name || '',
      supplierType: row.supplierType || 'PICKER',
      phone: row.phone || '',
      address: row.address || '',
      isActive: row.isActive !== false,
    })
    setError('')
    setIsModalOpen(true)
  }

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        id: 'date',
        header: 'Registered',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500 tabular-nums">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'code',
        header: 'Code',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-zinc-900">
            {row.original.code || '—'}
          </span>
        ),
      },
      {
        id: 'name',
        header: 'Supplier Name',
        cell: ({ row }) => (
          <div>
            <span className="font-semibold text-xs text-zinc-900">
              {row.original.name}
            </span>
            {row.original.address && (
              <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate max-w-[200px]">{row.original.address}</span>
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => {
          const type = row.original.supplierType || ''
          const label = TYPE_LABEL[type] || type || '—'
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
              {label}
            </span>
          )
        },
      },
      {
        id: 'phone',
        header: 'Phone',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 tabular-nums">
            {row.original.phone || '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const active = row.original.isActive !== false
          return (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                active
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
              }`}
            >
              <span className={`size-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
              {active ? 'Active' : 'Inactive'}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
              onClick={() => startEdit(row.original)}
            >
              <Edit2 className="size-3.5 shrink-0" />
              <span>Edit</span>
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <PageLayout
      title="Suppliers"
      description="Master data · Manage pickers, dealers, and commercial scrap suppliers"
      actions={
        <Button
          size="sm"
          className="h-8 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
          onClick={openAddModal}
        >
          <Plus className="size-3.5 shrink-0" />
          <span>Add supplier</span>
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Feedback alert if any */}
        {(message || error) && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
              error
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <span>{error || message}</span>
          </div>
        )}

        {/* Shadcn Filters Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 size-4 text-zinc-400 pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, code, phone..."
                className="pl-8 h-9 text-xs"
              />
            </div>

            <div className="w-full sm:w-44">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="PICKER">Picker</SelectItem>
                  <SelectItem value="DEALER">Dealer</SelectItem>
                  <SelectItem value="COMPANY">Company</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-36">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(query || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-zinc-500 hover:text-zinc-800"
                onClick={() => {
                  setQuery('')
                  setTypeFilter('ALL')
                  setStatusFilter('ALL')
                }}
              >
                Reset
              </Button>
            )}
          </div>

          <div className="text-xs text-zinc-500 shrink-0">
            {filtered.length} shown · {suppliers.data?.length ?? 0} total
          </div>
        </div>

        {/* CustomTable1 with no card wrapper */}
        <CustomTable1
          data={filtered}
          columns={columns}
          loading={suppliers.isLoading}
        />
      </div>

      {/* Supplier Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit supplier' : 'Add new supplier'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update details and operational status for this supplier.'
                : 'Register a new scrap collector, dealer, or commercial partner.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveMutation.mutate()
            }}
            className="space-y-4"
          >
            {editingId && (
              <div className="rounded-lg bg-zinc-50 p-2.5 border border-zinc-200/80 text-xs">
                <span className="text-zinc-500">Supplier Code: </span>
                <span className="font-mono font-semibold text-zinc-900">
                  {suppliers.data?.find((s) => s.id === editingId)?.code || '—'}
                </span>
                <span className="text-zinc-400 ml-1">(auto-assigned)</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="supplier-name" className="text-xs font-semibold">
                Supplier Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="supplier-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Adebayo Scrap Trading"
                required
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="supplier-type" className="text-xs font-semibold">
                  Supplier Type
                </Label>
                <Select
                  value={form.supplierType}
                  onValueChange={(val) => setForm((f) => ({ ...f, supplierType: val }))}
                >
                  <SelectTrigger id="supplier-type" className="h-9 text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PICKER">Picker</SelectItem>
                    <SelectItem value="DEALER">Dealer</SelectItem>
                    <SelectItem value="COMPANY">Company</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="supplier-phone" className="text-xs font-semibold">
                  Phone Number
                </Label>
                <Input
                  id="supplier-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. 0801 234 5678"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplier-address" className="text-xs font-semibold">
                Address / Yard Location
              </Label>
              <Input
                id="supplier-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="e.g. 14 Industrial Way, Ikeja, Lagos"
                className="h-9 text-xs"
              />
            </div>

            {editingId && (
              <div className="space-y-1.5">
                <Label htmlFor="supplier-status" className="text-xs font-semibold">
                  Status
                </Label>
                <Select
                  value={form.isActive ? '1' : '0'}
                  onValueChange={(val) => setForm((f) => ({ ...f, isActive: val === '1' }))}
                >
                  <SelectTrigger id="supplier-status" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Active</SelectItem>
                    <SelectItem value="0">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {error}
              </p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-9 text-xs font-semibold"
                disabled={saveMutation.isPending || !form.name.trim()}
              >
                {saveMutation.isPending ? 'Saving...' : editingId ? 'Save changes' : 'Add supplier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
