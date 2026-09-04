import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, Field, PageHeader } from '@/components/ui'

type MasterItem = {
  id: number
  code?: string
  name: string
  uom?: string
  reorderLevel?: string | number
  ratedOutputPerHour?: string | number
  standardMaterialPerUnit?: string | number
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

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.data?.map((row) => (
          <MasterCard key={row.id} row={row} tab={tab} path={active.path} />
        ))}
        {!rows.isLoading && !rows.data?.length && (
          <p className="text-sm text-[var(--ink-muted)]">Nothing configured yet.</p>
        )}
      </div>
    </div>
  )
}

function MasterCard({ row, tab, path }: { row: MasterItem; tab: TabKey; path: string }) {
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
    <Card className="!p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
        {row.code}
      </p>
      <p className="mt-1 font-semibold tracking-tight">{row.name}</p>

      {editableField && (
        <div className="mt-3 flex items-end gap-2">
          <Field label={editableField.label}>
            <input
              inputMode="decimal"
              className="dgn-input"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setSaved(false)
              }}
            />
          </Field>
          <button
            type="button"
            className="dgn-btn dgn-btn-secondary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      )}
    </Card>
  )
}
