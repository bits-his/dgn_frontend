import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, Field, PageHeader } from '@/components/ui'
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
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showInactive, setShowInactive] = useState(true)

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
      if (!showInactive && row.isActive === false) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        String(row.code || '')
          .toLowerCase()
          .includes(q) ||
        String(row.phone || '')
          .toLowerCase()
          .includes(q) ||
        String(row.supplierType || '')
          .toLowerCase()
          .includes(q)
      )
    })
  }, [suppliers.data, query, showInactive])

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
    }, 3000)
    return () => window.clearTimeout(t)
  }, [message, error])

  const startEdit = (row: Supplier) => {
    setEditingId(row.id)
    setForm({
      name: row.name || '',
      supplierType: row.supplierType || 'PICKER',
      phone: row.phone || '',
      address: row.address || '',
      isActive: row.isActive !== false,
    })
    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Masters"
        title="Suppliers"
      />

      <Card className="mb-4 !p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            {editingId ? 'Edit supplier' : 'Add supplier'}
          </h2>
          {editingId && (
            <button type="button" className="text-sm font-semibold text-[var(--ink-muted)]" onClick={cancelEdit}>
              Cancel edit
            </button>
          )}
        </div>
        {editingId && (
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Code:{' '}
            <span className="font-mono font-medium text-[var(--ink)]">
              {suppliers.data?.find((s) => s.id === editingId)?.code || '—'}
            </span>{' '}
            (auto)
          </p>
        )}

        <form
          className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
        >
          <Field label="Name">
            <input
              className="dgn-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              placeholder="Supplier name"
            />
          </Field>
          <Field label="Type">
            <select
              className="dgn-input"
              value={form.supplierType}
              onChange={(e) => setForm((f) => ({ ...f, supplierType: e.target.value }))}
            >
              <option value="PICKER">Picker</option>
              <option value="DEALER">Dealer</option>
              <option value="COMPANY">Company</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Phone">
            <input
              className="dgn-input"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>
          <Field label="Address">
            <input
              className="dgn-input"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </Field>
          {editingId && (
            <Field label="Status">
              <select
                className="dgn-input"
                value={form.isActive ? '1' : '0'}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === '1' }))}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </Field>
          )}
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="dgn-btn dgn-btn-primary"
              disabled={saveMutation.isPending || !form.name.trim()}
            >
              {saveMutation.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add supplier'}
            </button>
            {(message || error) && (
              <p className={`ml-3 text-sm ${error ? 'text-red-600' : 'text-[var(--ink-muted)]'}`}>
                {error || message}
              </p>
            )}
          </div>
        </form>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Supplier list</h2>
            <p className="text-sm text-[var(--ink-muted)]">
              {filtered.length} shown
              {suppliers.data ? ` · ${suppliers.data.length} total` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
            <input
              className="dgn-input min-w-[200px]"
              placeholder="Search name, code, phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Code</th>
                <th className="px-3 py-3 font-semibold">Name</th>
                <th className="px-3 py-3 font-semibold">Type</th>
                <th className="px-3 py-3 font-semibold">Phone</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--line)] hover:bg-zinc-50/80"
                >
                  <td className="px-4 py-3 text-[var(--ink-muted)] tabular-nums">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{row.code || '—'}</td>
                  <td className="px-3 py-3 font-medium">{row.name}</td>
                  <td className="px-3 py-3 text-[var(--ink-muted)]">
                    {TYPE_LABEL[row.supplierType || ''] || row.supplierType || '—'}
                  </td>
                  <td className="px-3 py-3 text-[var(--ink-muted)]">{row.phone || '—'}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.isActive === false
                          ? 'bg-zinc-100 text-zinc-600'
                          : 'bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {row.isActive === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-sm font-semibold text-[var(--accent-strong)]"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!suppliers.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    No suppliers yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
