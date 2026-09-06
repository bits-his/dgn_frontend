import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil } from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import CustomTable1 from '@/components/CustomTable1'
import { formatDateTime } from '@/lib/dates'
import { MATERIAL_CATEGORIES } from '@/lib/materials'

type MasterItem = {
  id: number
  code?: string
  name: string
  createdAt?: string
  uom?: string
  category?: string
  machineType?: string
  status?: string
  reorderLevel?: string | number
  ratedOutputPerHour?: string | number
  standardMaterialPerUnit?: string | number
  customerType?: string
  phone?: string | null
  address?: string | null
  creditLimit?: string | number
  isActive?: boolean
}

type TabKey = 'materials' | 'products' | 'machines' | 'customers'

const TABS: Array<{ key: TabKey; label: string; singular: string; path: string; extraLabel: string }> = [
  { key: 'materials', label: 'Materials', singular: 'Material', path: '/masters/materials', extraLabel: 'Category' },
  { key: 'products', label: 'Products', singular: 'Product', path: '/masters/products', extraLabel: 'Unit of measure' },
  { key: 'machines', label: 'Machines', singular: 'Machine', path: '/masters/machines', extraLabel: 'Machine type' },
  { key: 'customers', label: 'Customers', singular: 'Customer', path: '/masters/customers', extraLabel: 'Customer type' },
]

export function MastersPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('materials')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null)

  // Add form states
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [extra, setExtra] = useState('SCRAP')
  const [uom, setUom] = useState('kg')
  const [reorderLevel, setReorderLevel] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const active = TABS.find((t) => t.key === tab)!

  const rows = useQuery({
    queryKey: ['masters', tab],
    queryFn: async () => (await api.get(active.path)).data.data as MasterItem[],
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const payloads: Record<TabKey, Record<string, unknown>> = {
        materials: {
          code,
          name,
          category: extra,
          uom: uom || 'kg',
          reorderLevel: reorderLevel ? Number(reorderLevel) : 0,
          isActive: true,
        },
        products: {
          code,
          name,
          uom: extra || 'pcs',
          reorderLevel: reorderLevel ? Number(reorderLevel) : 0,
          isActive: true,
        },
        machines: {
          code,
          name,
          machineType: extra || 'PRODUCTION',
          ratedOutputPerHour: reorderLevel ? Number(reorderLevel) : undefined,
          isActive: true,
        },
        customers: {
          code,
          name,
          customerType: extra || 'WHOLESALE',
          creditLimit: reorderLevel ? Number(reorderLevel) : 0,
          isActive: true,
        },
      }
      await api.post(active.path, payloads[tab])
    },
    onSuccess: async () => {
      setMessage(`Successfully added ${active.singular.toLowerCase()}`)
      setError('')
      setIsAddOpen(false)
      setCode('')
      setName('')
      setReorderLevel('')
      await qc.invalidateQueries({ queryKey: ['masters', tab] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { err?: string; msg?: string } }; message?: string }
      setError(
        axiosErr.response?.data?.err ||
          axiosErr.response?.data?.msg ||
          axiosErr.message ||
          `Failed to save ${active.singular.toLowerCase()}`
      )
    },
  })

  useEffect(() => {
    if (tab === 'materials') {
      setExtra('SCRAP')
      setUom('kg')
    } else if (tab === 'products') {
      setExtra('pcs')
      setUom('pcs')
    } else if (tab === 'machines') {
      setExtra('PRODUCTION')
    } else if (tab === 'customers') {
      setExtra('WHOLESALE')
    }
  }, [tab])

  useEffect(() => {
    if (!message && !error) return
    const t = window.setTimeout(() => {
      setMessage('')
      setError('')
    }, 4000)
    return () => window.clearTimeout(t)
  }, [message, error])

  const columns = useMemo<ColumnDef<MasterItem>[]>(
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
        header: 'Name',
        cell: ({ row }) => (
          <div>
            <p className="text-xs font-semibold text-zinc-900">{row.original.name}</p>
            {tab === 'materials' && row.original.category && (
              <p className="text-[10px] text-zinc-400 capitalize">Category: {row.original.category.toLowerCase()}</p>
            )}
            {tab === 'products' && row.original.uom && (
              <p className="text-[10px] text-zinc-400">UOM: {row.original.uom}</p>
            )}
            {tab === 'machines' && row.original.machineType && (
              <p className="text-[10px] text-zinc-400">Type: {row.original.machineType}</p>
            )}
            {tab === 'customers' && row.original.customerType && (
              <p className="text-[10px] text-zinc-400">Type: {row.original.customerType}</p>
            )}
          </div>
        ),
      },
      {
        id: 'config',
        header:
          tab === 'machines'
            ? 'Rated Output / Hr'
            : tab === 'customers'
              ? 'Credit Limit (₦)'
              : 'Reorder Level',
        cell: ({ row }) => (
          <EditableMasterCell row={row.original} tab={tab} path={active.path} />
        ),
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs font-medium gap-1 text-zinc-700 hover:text-zinc-900"
            onClick={() => setEditingItem(row.original)}
          >
            <Pencil className="size-3" />
            <span>Edit</span>
          </Button>
        ),
      },
    ],
    [tab, active.path]
  )

  return (
    <PageLayout
      title="Masters"
      description="Configuration · Manage materials, products, machines, and customers"
      actions={
        <Button
          size="sm"
          className="h-8 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
          onClick={() => {
            setCode('')
            setName('')
            setReorderLevel('')
            setError('')
            setIsAddOpen(true)
          }}
        >
          <Plus className="size-3.5 shrink-0" />
          <span>Add {active.singular}</span>
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Status messages */}
        {(message || error) && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium ${
              error
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {error || message}
          </div>
        )}

        {/* Tabs */}
        <Tabs
          value={tab}
          onValueChange={(val) => {
            setTab(val as TabKey)
            setMessage('')
            setError('')
          }}
          className="w-full space-y-4"
        >
          <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-zinc-100/90 rounded-xl gap-1">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="text-xs font-semibold py-2 px-3 rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs text-zinc-600 transition-all text-center"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-0">
              <CustomTable1
                data={rows.data || []}
                columns={columns}
                loading={rows.isLoading}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Add Master Item Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {active.singular}</DialogTitle>
            <DialogDescription>
              Create a new {active.singular.toLowerCase()} entry in system configuration.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              createMutation.mutate()
            }}
            className="space-y-3.5"
          >
            <div className="space-y-1">
              <Label htmlFor="master-code" className="text-xs font-semibold">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="master-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CODE-01"
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="master-name" className="text-xs font-semibold">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="master-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Name of ${active.singular.toLowerCase()}`}
                required
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="master-extra" className="text-xs font-semibold">
                {active.extraLabel}
              </Label>
              {tab === 'customers' ? (
                <Select value={extra} onValueChange={setExtra}>
                  <SelectTrigger id="master-extra" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                    <SelectItem value="RETAIL">Retail</SelectItem>
                    <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
                  </SelectContent>
                </Select>
              ) : tab === 'materials' ? (
                <Select value={extra} onValueChange={setExtra}>
                  <SelectTrigger id="master-extra" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : tab === 'machines' ? (
                <Select value={extra} onValueChange={setExtra}>
                  <SelectTrigger id="master-extra" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUCTION">Production Machine</SelectItem>
                    <SelectItem value="CRUSHER">Crusher</SelectItem>
                    <SelectItem value="WASHER">Washer</SelectItem>
                    <SelectItem value="DRYER">Dryer</SelectItem>
                    <SelectItem value="EXTRUSION">Extruder</SelectItem>
                    <SelectItem value="RECYCLING">General Recycling</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="master-extra"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="e.g. pcs, kg, rolls"
                  required
                  className="h-8 text-xs"
                />
              )}
            </div>

            {tab === 'materials' && (
              <div className="space-y-1">
                <Label htmlFor="master-uom" className="text-xs font-semibold">
                  Unit of Measure (UOM)
                </Label>
                <Input
                  id="master-uom"
                  value={uom}
                  onChange={(e) => setUom(e.target.value)}
                  placeholder="kg"
                  className="h-8 text-xs"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="master-reorder" className="text-xs font-semibold">
                {tab === 'machines'
                  ? 'Rated Output / Hr'
                  : tab === 'customers'
                    ? 'Credit Limit (₦)'
                    : 'Reorder Level'}
              </Label>
              <Input
                id="master-reorder"
                type="number"
                inputMode="decimal"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                placeholder="e.g. 100"
                className="h-8 text-xs"
              />
            </div>

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
                className="h-8 text-xs"
                onClick={() => setIsAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs font-semibold"
                disabled={createMutation.isPending || !name.trim() || !code.trim()}
              >
                {createMutation.isPending ? 'Saving...' : `Add ${active.singular}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Master Item Modal Dialog */}
      {editingItem && (
        <EditMasterDialog
          item={editingItem}
          tab={tab}
          path={active.path}
          singular={active.singular}
          onClose={() => setEditingItem(null)}
          onSaved={async () => {
            setEditingItem(null)
            setMessage(`Updated ${active.singular.toLowerCase()} successfully`)
            await qc.invalidateQueries({ queryKey: ['masters', tab] })
          }}
        />
      )}
    </PageLayout>
  )
}

function EditMasterDialog({
  item,
  tab,
  path,
  singular,
  onClose,
  onSaved,
}: {
  item: MasterItem
  tab: TabKey
  path: string
  singular: string
  onClose: () => void
  onSaved: () => void
}) {
  const [code, setCode] = useState(item.code || '')
  const [name, setName] = useState(item.name || '')
  const [category, setCategory] = useState(item.category || 'SCRAP')
  const [uom, setUom] = useState(item.uom || (tab === 'materials' ? 'kg' : 'pcs'))
  const [machineType, setMachineType] = useState(item.machineType || 'PRODUCTION')
  const [customerType, setCustomerType] = useState(item.customerType || 'WHOLESALE')
  const [phone, setPhone] = useState(item.phone || '')
  const [address, setAddress] = useState(item.address || '')
  const [reorderLevel, setReorderLevel] = useState(
    item.reorderLevel != null ? String(item.reorderLevel) : ''
  )
  const [ratedOutputPerHour, setRatedOutputPerHour] = useState(
    item.ratedOutputPerHour != null ? String(item.ratedOutputPerHour) : ''
  )
  const [creditLimit, setCreditLimit] = useState(
    item.creditLimit != null ? String(item.creditLimit) : ''
  )
  const [standardMaterialPerUnit, setStandardMaterialPerUnit] = useState(
    item.standardMaterialPerUnit != null ? String(item.standardMaterialPerUnit) : ''
  )
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        code,
        name,
      }
      if (tab === 'materials') {
        payload.category = category
        payload.uom = uom || 'kg'
        if (reorderLevel !== '') payload.reorderLevel = Number(reorderLevel)
      } else if (tab === 'products') {
        payload.uom = uom || 'pcs'
        if (reorderLevel !== '') payload.reorderLevel = Number(reorderLevel)
        if (standardMaterialPerUnit !== '') {
          payload.standardMaterialPerUnit = Number(standardMaterialPerUnit)
        }
      } else if (tab === 'machines') {
        payload.machineType = machineType
        if (ratedOutputPerHour !== '') {
          payload.ratedOutputPerHour = Number(ratedOutputPerHour)
        }
      } else if (tab === 'customers') {
        payload.customerType = customerType
        payload.phone = phone || null
        payload.address = address || null
        if (creditLimit !== '') payload.creditLimit = Number(creditLimit)
      }

      await api.patch(`${path}/${item.id}`, payload)
    },
    onSuccess: () => {
      onSaved()
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { err?: string; msg?: string } }; message?: string }
      setError(
        axiosErr.response?.data?.err ||
          axiosErr.response?.data?.msg ||
          axiosErr.message ||
          `Failed to update ${singular.toLowerCase()}`
      )
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {singular}</DialogTitle>
          <DialogDescription>
            Update configuration details for {item.name}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            mutation.mutate()
          }}
          className="space-y-3.5"
        >
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-8 text-xs font-mono"
              required
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs"
              required
            />
          </div>

          {tab === 'materials' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Unit of Measure (UOM)</Label>
                <Input
                  value={uom}
                  onChange={(e) => setUom(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="kg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Reorder Level (kg)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </>
          )}

          {tab === 'products' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Unit of Measure (UOM)</Label>
                <Input
                  value={uom}
                  onChange={(e) => setUom(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="pcs, rolls, kg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Standard Material Per Unit (kg)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={standardMaterialPerUnit}
                  onChange={(e) => setStandardMaterialPerUnit(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. 0.05"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Reorder Level</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </>
          )}

          {tab === 'machines' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Machine Type</Label>
                <Select value={machineType} onValueChange={setMachineType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUCTION">Production Machine</SelectItem>
                    <SelectItem value="CRUSHER">Crusher</SelectItem>
                    <SelectItem value="WASHER">Washer</SelectItem>
                    <SelectItem value="DRYER">Dryer</SelectItem>
                    <SelectItem value="EXTRUSION">Extruder</SelectItem>
                    <SelectItem value="RECYCLING">General Recycling</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Rated Output / Hour</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={ratedOutputPerHour}
                  onChange={(e) => setRatedOutputPerHour(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. 150"
                />
              </div>
            </>
          )}

          {tab === 'customers' && (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Customer Type</Label>
                <Select value={customerType} onValueChange={setCustomerType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                    <SelectItem value="RETAIL">Retail</SelectItem>
                    <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. 08012345678"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Customer address"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Credit Limit (₦)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. 500000"
                />
              </div>
            </>
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
              className="h-8 text-xs"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs font-semibold"
              disabled={mutation.isPending || !name.trim() || !code.trim()}
            >
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditableMasterCell({
  row,
  tab,
  path,
}: {
  row: MasterItem
  tab: TabKey
  path: string
}) {
  const qc = useQueryClient()
  const editableField =
    tab === 'materials' || tab === 'products'
      ? { key: 'reorderLevel', label: 'Reorder level', current: row.reorderLevel }
      : tab === 'machines'
        ? { key: 'ratedOutputPerHour', label: 'Rated output / hr', current: row.ratedOutputPerHour }
        : tab === 'customers'
          ? { key: 'creditLimit', label: 'Credit limit (₦)', current: row.creditLimit }
          : null

  const [val, setVal] = useState(
    editableField?.current != null ? String(Number(editableField.current)) : ''
  )
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setVal(editableField?.current != null ? String(Number(editableField.current)) : '')
    setSaved(false)
  }, [row.id, editableField?.current])

  const mutation = useMutation({
    mutationFn: async () => {
      await api.patch(`${path}/${row.id}`, { [editableField!.key]: Number(val || 0) })
    },
    onSuccess: async () => {
      setSaved(true)
      await qc.invalidateQueries({ queryKey: ['masters', tab] })
      await qc.invalidateQueries({ queryKey: ['inventory-alerts'] })
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (!editableField) return null

  return (
    <div className="flex items-center gap-2">
      <Input
        inputMode="decimal"
        aria-label={editableField.label}
        value={val}
        onChange={(e) => {
          setVal(e.target.value)
          setSaved(false)
        }}
        className="h-8 w-28 text-xs tabular-nums"
      />
      <Button
        type="button"
        variant={saved ? 'default' : 'outline'}
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className={`h-8 px-2.5 text-xs font-semibold whitespace-nowrap ${
          saved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
        }`}
      >
        {mutation.isPending ? 'Saving...' : saved ? 'Saved' : 'Save'}
      </Button>
    </div>
  )
}
