import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Edit2, Landmark, Plus, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLayout } from '@/components/PageLayout'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import CustomTable1 from '@/components/CustomTable1'
import { Field } from '@/components/ui'

type BankAccount = {
  id: number
  name: string
  bankName?: string | null
  accountName?: string | null
  accountNumber?: string | null
  currency?: string | null
  notes?: string | null
  isActive?: boolean
}

type FormState = {
  name: string
  bankName: string
  accountName: string
  accountNumber: string
  currency: string
  notes: string
  isActive: boolean
}

const emptyForm: FormState = {
  name: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  currency: 'NGN',
  notes: '',
  isActive: true,
}

export function BankAccountsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const accounts = useQuery({
    queryKey: ['bank-accounts-all'],
    queryFn: async () => {
      const { data } = await api.get('/bank-accounts', {
        params: { includeInactive: '1' },
      })
      return data.data as BankAccount[]
    },
  })

  const filtered = useMemo(() => {
    const rows = accounts.data || []
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter === 'ACTIVE' && row.isActive === false) return false
      if (statusFilter === 'INACTIVE' && row.isActive !== false) return false
      if (!q) return true
      return [
        row.name,
        row.bankName,
        row.accountName,
        row.accountNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [accounts.data, query, statusFilter])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        bankName: form.bankName.trim() || null,
        accountName: form.accountName.trim() || null,
        accountNumber: form.accountNumber.trim() || null,
        currency: form.currency.trim() || 'NGN',
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      }
      if (!payload.name) throw new Error('Account name is required')
      if (editingId) {
        const { data } = await api.patch(`/bank-accounts/${editingId}`, payload)
        return data.data as BankAccount
      }
      const { data } = await api.post('/bank-accounts', payload)
      return data.data as BankAccount
    },
    onSuccess: async () => {
      setMessage(editingId ? 'Bank account updated' : 'Bank account added')
      setError('')
      setIsModalOpen(false)
      setEditingId(null)
      setForm(emptyForm)
      await qc.invalidateQueries({ queryKey: ['bank-accounts-all'] })
      await qc.invalidateQueries({ queryKey: ['bank-accounts'] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { err?: string; msg?: string } }; message?: string }
      setMessage('')
      setError(
        axiosErr.response?.data?.err ||
          axiosErr.response?.data?.msg ||
          axiosErr.message ||
          'Could not save bank account',
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

  const startEdit = (row: BankAccount) => {
    setEditingId(row.id)
    setForm({
      name: row.name || '',
      bankName: row.bankName || '',
      accountName: row.accountName || '',
      accountNumber: row.accountNumber || '',
      currency: row.currency || 'NGN',
      notes: row.notes || '',
      isActive: row.isActive !== false,
    })
    setError('')
    setIsModalOpen(true)
  }

  const columns = useMemo<ColumnDef<BankAccount>[]>(
    () => [
      {
        id: 'name',
        header: 'Account',
        cell: ({ row }) => (
          <div>
            <span className="text-xs font-semibold text-zinc-900">{row.original.name}</span>
            {row.original.bankName ? (
              <p className="mt-0.5 text-[11px] text-zinc-400">{row.original.bankName}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'accountName',
        header: 'Account name',
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600">{row.original.accountName || '—'}</span>
        ),
      },
      {
        id: 'accountNumber',
        header: 'Number',
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums text-zinc-700">
            {row.original.accountNumber || '—'}
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
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                active
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-zinc-200 bg-zinc-100 text-zinc-500'
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
              className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap px-2.5 text-xs font-semibold"
              onClick={() => startEdit(row.original)}
            >
              <Edit2 className="size-3.5 shrink-0" />
              <span>Edit</span>
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <PageLayout
      title="Bank accounts"
      description="Accounts used when issuing wallet money · match these to your PV / accounting software"
      actions={
        <Button
          size="sm"
          className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold"
          onClick={openAddModal}
        >
          <Plus className="size-3.5 shrink-0" />
          <span>Add account</span>
        </Button>
      }
    >
      <div className="space-y-4">
        {(message || error) && (
          <div
            className={`flex items-center justify-between rounded-xl border p-3 text-xs font-medium ${
              error
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            <span>{error || message}</span>
          </div>
        )}

        <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-zinc-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, bank, number…"
                className="h-9 pl-8 text-xs"
              />
            </div>
            <div className="w-full sm:w-36">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <CustomTable1
          columns={columns}
          data={filtered}
          loading={accounts.isLoading}
        />
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="size-4" />
              {editingId ? 'Edit bank account' : 'Add bank account'}
            </DialogTitle>
            <DialogDescription>
              Staff choose this account when money is issued from the wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Display name">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. GTBank operations"
              />
            </Field>
            <Field label="Bank">
              <Input
                value={form.bankName}
                onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                placeholder="Bank name"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account name">
                <Input
                  value={form.accountName}
                  onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                />
              </Field>
              <Field label="Account number">
                <Input
                  value={form.accountNumber}
                  onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Active (can be selected when issuing money)
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saveMutation.isPending || !form.name.trim()}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
