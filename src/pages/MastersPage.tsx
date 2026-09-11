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
  status?: string
  reorderLevel?: string | number
  standardMaterialPerUnit?: string | number
  startTime?: string | null
  endTime?: string | null
  isActive?: boolean
}

type TabKey = 'materials' | 'products' | 'shifts'

const TABS: Array<{ key: TabKey; label: string; singular: string; path: string; extraLabel: string }> = [
  { key: 'materials', label: 'Materials', singular: 'Material', path: '/masters/materials', extraLabel: 'Category' },
  { key: 'products', label: 'Products', singular: 'Product', path: '/masters/products', extraLabel: 'Unit of measure' },
  { key: 'shifts', label: 'Shifts', singular: 'Shift', path: '/masters/shifts', extraLabel: 'Shift Timing' },
]

function calculateShiftMinutes(startTime?: string | null, endTime?: string | null): number {
  if (!startTime || !endTime) return 0
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return 0

  let diff = eh * 60 + em - (sh * 60 + sm)
  if (diff < 0) {
    // Overnight shift (e.g. 23:00 to 07:00)
    diff += 24 * 60
  }
  return diff
}

function formatShiftHours(startTime?: string | null, endTime?: string | null): string {
  const mins = calculateShiftMinutes(startTime, endTime)
  if (!mins) return '—'
  const hrs = mins / 60
  return Number.isInteger(hrs) ? `${hrs} hrs` : `${hrs.toFixed(1)} hrs`
}

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
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('15:00')
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
        shifts: {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          startTime: startTime || '07:00',
          endTime: endTime || '15:00',
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
      setStartTime('07:00')
      setEndTime('15:00')
      await qc.invalidateQueries({ queryKey: ['masters', tab] })
      await qc.invalidateQueries({ queryKey: ['shifts'] })
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
    } else if (tab === 'shifts') {
      setStartTime('07:00')
      setEndTime('15:00')
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
            {tab === 'shifts' && (
              <p className="text-[10px] text-zinc-400">Working shift</p>
            )}
          </div>
        ),
      },
      {
        id: 'config',
        header: tab === 'shifts' ? 'Time & Shift Hours' : 'Reorder Level',
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
      description="Configuration · Manage materials, products, and shifts"
      actions={
        <Button
          size="sm"
          className="h-8 px-3 text-xs font-semibold gap-1.5 whitespace-nowrap inline-flex items-center"
          onClick={() => {
            setCode('')
            setName('')
            setReorderLevel('')
            setStartTime('07:00')
            setEndTime('15:00')
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
          <TabsList className="w-full grid grid-cols-3 sm:grid-cols-3 h-auto p-1 bg-zinc-100/90 rounded-xl gap-1">
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
                card
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

            {tab === 'shifts' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="shift-start" className="text-xs font-semibold">
                      Start Time <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="shift-start"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      className="h-8 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="shift-end" className="text-xs font-semibold">
                      End Time <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="shift-end"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      className="h-8 text-xs font-mono tabular-nums"
                    />
                  </div>
                </div>
                <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-950">Shift Duration</p>
                    <p className="text-[11px] text-amber-700">
                      {calculateShiftMinutes(startTime, endTime)} minutes total
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-200/80 text-amber-900 border border-amber-300/80 tabular-nums">
                    {formatShiftHours(startTime, endTime)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="master-extra" className="text-xs font-semibold">
                    {active.extraLabel}
                  </Label>
                  {tab === 'materials' ? (
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
                    Reorder Level
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
  const [reorderLevel, setReorderLevel] = useState(
    item.reorderLevel != null ? String(item.reorderLevel) : ''
  )
  const [standardMaterialPerUnit, setStandardMaterialPerUnit] = useState(
    item.standardMaterialPerUnit != null ? String(item.standardMaterialPerUnit) : ''
  )
  const [shiftStartTime, setShiftStartTime] = useState(item.startTime || '07:00')
  const [shiftEndTime, setShiftEndTime] = useState(item.endTime || '15:00')
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
      } else if (tab === 'shifts') {
        payload.startTime = shiftStartTime
        payload.endTime = shiftEndTime
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

          {tab === 'shifts' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Start Time</Label>
                  <Input
                    type="time"
                    value={shiftStartTime}
                    onChange={(e) => setShiftStartTime(e.target.value)}
                    className="h-8 text-xs font-mono tabular-nums"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">End Time</Label>
                  <Input
                    type="time"
                    value={shiftEndTime}
                    onChange={(e) => setShiftEndTime(e.target.value)}
                    className="h-8 text-xs font-mono tabular-nums"
                    required
                  />
                </div>
              </div>
              <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-950">Shift Duration</p>
                  <p className="text-[11px] text-amber-700">
                    {calculateShiftMinutes(shiftStartTime, shiftEndTime)} minutes total
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-200/80 text-amber-900 border border-amber-300/80 tabular-nums">
                  {formatShiftHours(shiftStartTime, shiftEndTime)}
                </span>
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

function EditableShiftCell({
  row,
  path,
}: {
  row: MasterItem
  path: string
}) {
  const qc = useQueryClient()
  const [startTime, setStartTime] = useState(row.startTime || '07:00')
  const [endTime, setEndTime] = useState(row.endTime || '15:00')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setStartTime(row.startTime || '07:00')
    setEndTime(row.endTime || '15:00')
    setSaved(false)
  }, [row.id, row.startTime, row.endTime])

  const mutation = useMutation({
    mutationFn: async () => {
      await api.patch(`${path}/${row.id}`, { startTime, endTime })
    },
    onSuccess: async () => {
      setSaved(true)
      await qc.invalidateQueries({ queryKey: ['masters', 'shifts'] })
      await qc.invalidateQueries({ queryKey: ['shifts'] })
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const durationStr = formatShiftHours(startTime, endTime)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-0.5">
        <Input
          type="time"
          aria-label="Start time"
          value={startTime}
          onChange={(e) => {
            setStartTime(e.target.value)
            setSaved(false)
          }}
          className="h-7 w-20 text-xs font-mono tabular-nums px-1 py-0 border-0 bg-transparent shadow-none focus-visible:ring-1"
        />
        <span className="text-zinc-400 text-xs font-semibold">→</span>
        <Input
          type="time"
          aria-label="End time"
          value={endTime}
          onChange={(e) => {
            setEndTime(e.target.value)
            setSaved(false)
          }}
          className="h-7 w-20 text-xs font-mono tabular-nums px-1 py-0 border-0 bg-transparent shadow-none focus-visible:ring-1"
        />
      </div>
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 border border-amber-200/80 whitespace-nowrap tabular-nums">
        {durationStr}
      </span>
      <Button
        type="button"
        variant={saved ? 'default' : 'outline'}
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className={`h-7 px-2.5 text-xs font-semibold whitespace-nowrap ${
          saved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
        }`}
      >
        {mutation.isPending ? 'Saving...' : saved ? 'Saved' : 'Save'}
      </Button>
    </div>
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

  if (tab === 'shifts') {
    return <EditableShiftCell row={row} path={path} />
  }

  const editableField =
    tab === 'materials' || tab === 'products'
      ? { key: 'reorderLevel', label: 'Reorder level', current: row.reorderLevel }
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
