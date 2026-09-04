import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, Field, PageHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/dates'
import { MATERIAL_CATEGORIES } from '@/lib/materials'

type MasterItem = {
  id: number
  code?: string
  name: string
  createdAt?: string
  uom?: string
  reorderLevel?: string | number
  ratedOutputPerHour?: string | number
  standardMaterialPerUnit?: string | number
  supplierType?: string
  customerType?: string
  phone?: string | null
  creditLimit?: string | number
}

type TabKey = 'materials' | 'suppliers' | 'products' | 'machines' | 'customers'

const TABS: Array<{ key: TabKey; label: string; path: string; extraLabel: string }> = [
  { key: 'materials', label: 'Materials', path: '/masters/materials', extraLabel: 'Category' },
  { key: 'suppliers', label: 'Suppliers', path: '/masters/suppliers', extraLabel: 'Supplier type' },
  { key: 'products', label: 'Products', path: '/masters/products', extraLabel: 'Unit of measure' },
  { key: 'machines', label: 'Machines', path: '/masters/machines', extraLabel: 'Machine type' },
  { key: 'customers', label: 'Customers', path: '/masters/customers', extraLabel: 'Customer type' },
]

export function MastersPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('materials')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [extra, setExtra] = useState('SCRAP')
  const [message, setMessage] = useState('')

  const active = TABS.find((t) => t.key === tab)!

  const rows = useQuery({
    queryKey: ['masters', tab],
    queryFn: async () => (await api.get(active.path)).data.data as MasterItem[],
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const payloads: Record<TabKey, Record<string, unknown>> = {
        materials: { code, name, category: extra, uom: 'kg', isActive: true },
        suppliers: { name, supplierType: extra, isActive: true },
        products: { code, name, uom: extra || 'pcs', isActive: true },
        machines: { code, name, machineType: extra || 'PRODUCTION', isActive: true },
        customers: { code, name, customerType: extra || 'WHOLESALE', isActive: true },
      }
      await api.post(active.path, payloads[tab])
    },
    onSuccess: async () => {
      setMessage('Saved')
      setCode('')
      setName('')
      await qc.invalidateQueries({ queryKey: ['masters', tab] })
      if (tab === 'suppliers') {
        await qc.invalidateQueries({ queryKey: ['suppliers'] })
      }
    },
    onError: () => setMessage('Failed to save'),
  })

  useEffect(() => {
    if (tab === 'suppliers') setExtra('PICKER')
    else if (tab === 'materials') setExtra('SCRAP')
    else if (tab === 'products') setExtra('pcs')
    else if (tab === 'machines') setExtra('PRODUCTION')
    else if (tab === 'customers') setExtra('WHOLESALE')
  }, [tab])

  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Masters"
        description="Materials, suppliers, products, machines and customers used across receiving, recycling, production and sales. Reorder levels here drive the inventory alerts."
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key)
                setMessage('')
              }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                tab === t.key ? 'bg-[var(--bg-sidebar)] text-white' : 'bg-zinc-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault()
            setMessage('')
            createMutation.mutate()
          }}
        >
          {tab !== 'suppliers' && (
            <Field label="Code">
              <input
                className="dgn-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </Field>
          )}
          <Field label="Name">
            <input
              className="dgn-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label={active.extraLabel}>
            {tab === 'suppliers' ? (
              <select className="dgn-input" value={extra} onChange={(e) => setExtra(e.target.value)}>
                <option value="PICKER">Picker</option>
                <option value="DEALER">Dealer</option>
                <option value="COMPANY">Company</option>
                <option value="OTHER">Other</option>
              </select>
            ) : tab === 'customers' ? (
              <select className="dgn-input" value={extra} onChange={(e) => setExtra(e.target.value)}>
                <option value="WHOLESALE">Wholesale</option>
                <option value="RETAIL">Retail</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            ) : tab === 'materials' ? (
              <select className="dgn-input" value={extra} onChange={(e) => setExtra(e.target.value)}>
                {MATERIAL_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="dgn-input"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                required
              />
            )}
          </Field>
          <div className="flex items-end">
            <button type="submit" className="dgn-btn dgn-btn-primary w-full">
              Add
            </button>
          </div>
          {message && <p className="text-sm text-[var(--ink-muted)] sm:col-span-4">{message}</p>}
        </form>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-zinc-50 text-xs text-[var(--ink-faint)]">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-3 py-3 font-semibold">Code</th>
                <th className="px-3 py-3 font-semibold">Name</th>
                <th className="px-3 py-3 font-semibold">
                  {tab === 'machines'
                    ? 'Rated output / hour'
                    : tab === 'customers'
                      ? 'Credit limit (₦)'
                      : tab === 'suppliers'
                        ? 'Supplier type'
                        : 'Reorder level'}
                </th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    Loading…
                  </td>
                </tr>
              )}
              {rows.data?.map((row) => (
                <MasterRow key={row.id} row={row} tab={tab} path={active.path} />
              ))}
              {!rows.isLoading && !rows.data?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                    Nothing configured yet.
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

function MasterRow({ row, tab, path }: { row: MasterItem; tab: TabKey; path: string }) {
  const qc = useQueryClient()
  const editableField =
    tab === 'materials' || tab === 'products'
      ? { key: 'reorderLevel', label: 'Reorder level', current: row.reorderLevel }
      : tab === 'machines'
        ? { key: 'ratedOutputPerHour', label: 'Rated output / hour', current: row.ratedOutputPerHour }
        : tab === 'customers'
          ? { key: 'creditLimit', label: 'Credit limit (₦)', current: row.creditLimit }
          : null

  const [value, setValue] = useState(
    editableField?.current != null ? String(Number(editableField.current)) : '',
  )
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      await api.patch(`${path}/${row.id}`, { [editableField!.key]: Number(value || 0) })
    },
    onSuccess: async () => {
      setSaved(true)
      await qc.invalidateQueries({ queryKey: ['masters', tab] })
      await qc.invalidateQueries({ queryKey: ['inventory-alerts'] })
    },
  })

  return (
    <tr className="border-b border-[var(--line)] hover:bg-zinc-50/80">
      <td className="px-4 py-3 text-[var(--ink-muted)] tabular-nums">
        {formatDateTime(row.createdAt)}
      </td>
      <td className="px-3 py-3 font-mono text-xs">{row.code || '—'}</td>
      <td className="px-3 py-3 font-medium">{row.name}</td>
      <td className="px-3 py-3">
        {editableField ? (
          <div className="max-w-48">
            <input
              inputMode="decimal"
              className="dgn-input"
              aria-label={editableField.label}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setSaved(false)
              }}
            />
          </div>
        ) : (
          <span className="text-[var(--ink-muted)]">{row.supplierType || '—'}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {editableField ? (
          <button
            type="button"
            className="text-sm font-semibold text-[var(--accent-strong)]"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        ) : (
          <span className="text-[var(--ink-faint)]">—</span>
        )}
      </td>
    </tr>
  )
}
