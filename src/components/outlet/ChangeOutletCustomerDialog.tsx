import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, UserRound, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NairaAmountInput } from '@/components/ui'

type DistributorItem = {
  id: number
  code: string
  name: string
  phone?: string | null
  distributorKind?: string | null
}

type ShopBuyerItem = {
  id: number
  name: string
  phone?: string | null
  saleCount?: number
  balanceDue?: number
  linkedCustomerId?: number | null
}

type BuyerPick =
  | {
      kind: 'buyer'
      id: number
      name: string
      saleCount?: number
      balanceDue?: number
      linkedCustomerId?: number | null
    }
  | {
      kind: 'distributor'
      id: number
      name: string
      code: string
      phone?: string | null
    }

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function ChangeOutletCustomerDialog({
  open,
  onClose,
  saleId,
  currentBuyerName,
  outletId,
  totalAmount = 0,
  currentAmountPaid = 0,
  onUpdated,
}: {
  open: boolean
  onClose: () => void
  saleId: number
  currentBuyerName?: string | null
  outletId?: number | null
  totalAmount?: number
  currentAmountPaid?: number
  onUpdated?: () => void
}) {
  const queryClient = useQueryClient()

  // Selected customer state
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null)
  const [linkedCustomerId, setLinkedCustomerId] = useState<number | null>(null)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const [isWalkIn, setIsWalkIn] = useState(false)

  // Search & input state
  const [customerQuery, setCustomerQuery] = useState('')
  const [buyerPickerOpen, setBuyerPickerOpen] = useState(false)
  const [amountPaid, setAmountPaid] = useState(String(currentAmountPaid || 0))

  // Create customer sub-modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createError, setCreateError] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when opening dialog
  useEffect(() => {
    if (open) {
      setError(null)
      setCustomerQuery('')
      setAmountPaid(String(currentAmountPaid || 0))
      setBuyerPickerOpen(false)
      setCreateOpen(false)
      if (currentBuyerName) {
        setSelectedLabel(currentBuyerName)
        setIsWalkIn(false)
      } else {
        setSelectedLabel(null)
        setIsWalkIn(true)
      }
    }
  }, [open, currentBuyerName, currentAmountPaid])

  const distributorsQuery = useQuery({
    queryKey: ['distributors-list-active'],
    enabled: open,
    queryFn: async () => {
      const res = await api.get('/distributors')
      const payload = res.data?.data ?? res.data
      return Array.isArray(payload) ? (payload as DistributorItem[]) : []
    },
  })

  const buyersQuery = useQuery({
    queryKey: ['outlet-buyers-list', outletId],
    enabled: open && Boolean(outletId),
    queryFn: async () => {
      const res = await api.get(`/outlet-sales/buyers?outletId=${outletId}`)
      const payload = res.data?.data ?? res.data
      if (Array.isArray(payload)) return payload as ShopBuyerItem[]
      if (payload && Array.isArray((payload as { rows?: unknown[] }).rows)) {
        return (payload as { rows: ShopBuyerItem[] }).rows
      }
      return []
    },
  })

  const buyersRaw = buyersQuery.data
  const buyers: ShopBuyerItem[] = useMemo(() => {
    if (Array.isArray(buyersRaw)) return buyersRaw
    if (buyersRaw && typeof buyersRaw === 'object') {
      const obj = buyersRaw as Record<string, unknown>
      if (Array.isArray(obj.rows)) return obj.rows as ShopBuyerItem[]
      if (Array.isArray(obj.data)) return obj.data as ShopBuyerItem[]
    }
    return []
  }, [buyersRaw])

  const distsRaw = distributorsQuery.data
  const shopData = useMemo(() => {
    let list: DistributorItem[] = []
    if (Array.isArray(distsRaw)) list = distsRaw
    else if (distsRaw && typeof distsRaw === 'object') {
      const obj = distsRaw as Record<string, unknown>
      if (Array.isArray(obj.data)) list = obj.data as DistributorItem[]
      else if (Array.isArray(obj.rows)) list = obj.rows as DistributorItem[]
    }
    const ids = new Set<number>()
    const names = new Set<string>()
    if (outletId) ids.add(Number(outletId))
    for (const d of list) {
      if (String(d.distributorKind || '').toUpperCase() === 'SHOP') {
        ids.add(Number(d.id))
        if (d.name) names.add(d.name.trim().toLowerCase())
        if (d.code) names.add(d.code.trim().toLowerCase())
      }
    }
    return { ids, names }
  }, [distsRaw, outletId])

  const distributors: DistributorItem[] = useMemo(() => {
    let list: DistributorItem[] = []
    if (Array.isArray(distsRaw)) list = distsRaw
    else if (distsRaw && typeof distsRaw === 'object') {
      const obj = distsRaw as Record<string, unknown>
      if (Array.isArray(obj.data)) list = obj.data as DistributorItem[]
      else if (Array.isArray(obj.rows)) list = obj.rows as DistributorItem[]
    }
    // Never include shops in the customer select
    return list.filter(
      (d) =>
        String(d.distributorKind || '').toUpperCase() !== 'SHOP' &&
        !shopData.ids.has(Number(d.id)),
    )
  }, [distsRaw, shopData])

  const safeBuyers: ShopBuyerItem[] = useMemo(() => {
    const list = Array.isArray(buyers) ? buyers : []
    return list.filter((b) => {
      if (b.linkedCustomerId && shopData.ids.has(Number(b.linkedCustomerId))) return false
      if (shopData.names.has(b.name.trim().toLowerCase())) return false
      return true
    })
  }, [buyers, shopData])

  const hasNamedCustomer = Boolean(selectedLabel) && !isWalkIn

  const buyerSuggestions = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    const safeDistributors = Array.isArray(distributors) ? distributors : []

    const linkedDistributorIds = new Set(
      safeBuyers
        .map((b) => Number(b.linkedCustomerId || 0))
        .filter((id) => id > 0),
    )

    const local: BuyerPick[] = (q
      ? safeBuyers.filter((b) => b.name.toLowerCase().includes(q))
      : safeBuyers
    )
      .slice(0, 8)
      .map((b) => ({
        kind: 'buyer' as const,
        id: b.id,
        name: b.name,
        saleCount: b.saleCount,
        balanceDue: b.balanceDue,
        linkedCustomerId: b.linkedCustomerId,
      }))

    const dists: BuyerPick[] = (q
      ? safeDistributors.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            String(d.code || '')
              .toLowerCase()
              .includes(q),
        )
      : safeDistributors
    )
      .filter((d) => !linkedDistributorIds.has(Number(d.id)))
      .slice(0, 8)
      .map((d) => ({
        kind: 'distributor' as const,
        id: d.id,
        name: d.name,
        code: d.code,
        phone: d.phone,
      }))

    const merged = [...local, ...dists]
    const seen = new Set<string>()
    const unique: BuyerPick[] = []
    for (const row of merged) {
      const key =
        row.kind === 'distributor'
          ? `d-${row.id}`
          : row.linkedCustomerId
            ? `link-${row.linkedCustomerId}`
            : `b-${row.id}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(row)
      if (unique.length >= 10) break
    }
    return unique
  }, [safeBuyers, distributors, customerQuery])

  const canOfferCreate = useMemo(() => {
    const q = customerQuery.trim()
    if (!q || hasNamedCustomer) return false
    if (shopData.names.has(q.toLowerCase())) return false
    const exact = safeBuyers.some((b) => b.name.trim().toLowerCase() === q.toLowerCase())
    return !exact
  }, [customerQuery, safeBuyers, hasNamedCustomer, shopData])

  const pickBuyer = (pick: BuyerPick) => {
    if (pick.kind === 'buyer') {
      setSelectedBuyerId(pick.id)
      setLinkedCustomerId(pick.linkedCustomerId ? Number(pick.linkedCustomerId) : null)
      setSelectedLabel(pick.name)
    } else {
      setSelectedBuyerId(null)
      setLinkedCustomerId(pick.id)
      setSelectedLabel(pick.name)
    }
    setIsWalkIn(false)
    setCustomerQuery('')
    setBuyerPickerOpen(false)
    setError(null)
  }

  const clearBuyer = () => {
    setSelectedBuyerId(null)
    setLinkedCustomerId(null)
    setSelectedLabel(null)
    setIsWalkIn(true)
    setCustomerQuery('')
    setBuyerPickerOpen(false)
  }

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!outletId) throw new Error('Outlet ID is missing')
      const name = createName.trim()
      if (!name) throw new Error('Enter the customer name')
      const { data } = await api.post('/outlet-sales/buyers', {
        outletCustomerId: outletId,
        name,
        phone: createPhone.trim() || null,
      })
      return data.data as { id: number; name: string; phone: string | null }
    },
    onSuccess: async (buyer) => {
      setCreateOpen(false)
      setSelectedBuyerId(buyer.id)
      setLinkedCustomerId(null)
      setSelectedLabel(buyer.name)
      setIsWalkIn(false)
      setCustomerQuery('')
      setCreateError('')
      await queryClient.invalidateQueries({ queryKey: ['outlet-buyers', outletId] })
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: { data?: { err?: string; errors?: { name?: string } } }
        message?: string
      }
      setCreateError(
        axiosErr.response?.data?.err ||
          axiosErr.response?.data?.errors?.name ||
          axiosErr.message ||
          'Could not save customer',
      )
    },
  })

  const numericPaid = Number(amountPaid) || 0
  const balanceDueNow = Math.max(0, Math.round((totalAmount - numericPaid) * 100) / 100)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (customerQuery.trim() && !hasNamedCustomer) {
      setError('Please pick a customer from the dropdown, create them, or click Walk-in.')
      return
    }

    if (isWalkIn && balanceDueNow > 0.001) {
      setError('Walk-in customers must pay in full. Assign to a customer or distributor to leave a balance.')
      return
    }

    if (numericPaid > totalAmount + 0.001) {
      setError(`Amount paid cannot exceed sale total (${money(totalAmount)})`)
      return
    }

    let payload: Record<string, unknown> = {
      amountPaid: numericPaid,
    }

    if (isWalkIn) {
      payload.isWalkIn = true
    } else if (linkedCustomerId && !selectedBuyerId) {
      payload.distributorId = linkedCustomerId
    } else if (selectedBuyerId) {
      payload.outletBuyerId = selectedBuyerId
    } else if (selectedLabel) {
      payload.buyerName = selectedLabel
    } else {
      payload.isWalkIn = true
    }

    setSaving(true)
    try {
      await api.patch(`/outlet-sales/${saleId}/customer`, payload)
      await queryClient.invalidateQueries({ queryKey: ['outlet-sale'] })
      await queryClient.invalidateQueries({ queryKey: ['outlet-sales'] })
      await queryClient.invalidateQueries({ queryKey: ['outlet-sales-list'] })
      await queryClient.invalidateQueries({ queryKey: ['distributor'] })
      await queryClient.invalidateQueries({ queryKey: ['distributors'] })
      await queryClient.invalidateQueries({ queryKey: ['distributor-credit'] })
      await queryClient.invalidateQueries({ queryKey: ['sales'] })
      onUpdated?.()
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { err?: string } }; message?: string }
      setError(axiosErr.response?.data?.err || axiosErr.message || 'Could not update customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="dgn-card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Change / Reassign Customer</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Update buyer assignment and amount paid for this sale.
            </p>
          </div>
          <button type="button" className="dgn-btn dgn-btn-ghost text-xs" onClick={onClose}>
            Cancel
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 p-2.5 text-xs font-medium text-red-700">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Customer Selection like RecordOutletSalePage */}
          <div className="relative">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-zinc-700">Customer / Buyer</label>
              {hasNamedCustomer ? (
                <button
                  type="button"
                  onClick={clearBuyer}
                  className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800"
                >
                  Clear · walk-in
                </button>
              ) : !isWalkIn ? (
                <button
                  type="button"
                  onClick={clearBuyer}
                  className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800"
                >
                  Set as walk-in
                </button>
              ) : null}
            </div>

            {hasNamedCustomer ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <UserRound className="size-4 shrink-0 text-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-zinc-900">{selectedLabel}</p>
                    <p className="text-[10px] text-emerald-800">
                      {linkedCustomerId ? 'Distributor account' : 'Shop customer'} · credit allowed
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearBuyer}
                  className="rounded-md p-1 text-zinc-400 hover:bg-emerald-100 hover:text-zinc-700"
                  title="Remove customer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : isWalkIn ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
                  <span className="font-semibold text-zinc-800">Walk-in Customer</span>
                  <button
                    type="button"
                    onClick={() => setIsWalkIn(false)}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Change to named customer
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500">
                  Walk-in sales must be paid in full. To leave a balance due, assign to a customer.
                </p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value)
                      setBuyerPickerOpen(true)
                    }}
                    onFocus={() => setBuyerPickerOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setBuyerPickerOpen(false), 200)
                    }}
                    placeholder="Search shop customer or factory distributor…"
                    className="h-9 pl-8 text-xs"
                    autoFocus
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Type to search or create</span>
                  <button
                    type="button"
                    onClick={clearBuyer}
                    className="font-medium text-zinc-600 hover:text-zinc-900"
                  >
                    Set as walk-in
                  </button>
                </div>
              </>
            )}

            {!hasNamedCustomer && !isWalkIn && buyerPickerOpen && (buyerSuggestions.length > 0 || canOfferCreate) && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-md">
                {buyerSuggestions.map((b) => (
                  <li key={b.kind === 'distributor' ? `d-${b.id}` : `b-${b.id}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickBuyer(b)}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-zinc-900">{b.name}</span>
                        {b.kind === 'distributor' ? (
                          <span className="mt-0.5 block font-mono text-[10px] text-violet-600">
                            App distributor · {b.code}
                          </span>
                        ) : b.linkedCustomerId ? (
                          <span className="mt-0.5 block text-[10px] text-teal-700">
                            Shop account · linked distributor
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-[10px] text-zinc-500">
                        {b.kind === 'distributor'
                          ? 'Distributor'
                          : `${b.saleCount || 0}×${
                              (b.balanceDue || 0) > 0.001
                                ? ` · owes ${money(b.balanceDue || 0)}`
                                : ''
                            }`}
                      </span>
                    </button>
                  </li>
                ))}
                {canOfferCreate && (
                  <li className="border-t border-zinc-100">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCreateName(customerQuery.trim())
                        setCreatePhone('')
                        setCreateError('')
                        setCreateOpen(true)
                      }}
                    >
                      <Plus className="size-3.5 shrink-0" />
                      Create «{customerQuery.trim()}»
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Amount Paid section */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Sale total:</span>
              <span className="font-bold text-zinc-900">{money(totalAmount)}</span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-zinc-700">
                Amount paid now
              </label>
              <div className="flex gap-2">
                <NairaAmountInput
                  value={amountPaid}
                  onChange={setAmountPaid}
                  className="h-9 flex-1 text-xs bg-white"
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => setAmountPaid(String(totalAmount))}
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Full
                </button>
                <button
                  type="button"
                  onClick={() => setAmountPaid('0')}
                  className="rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Zero
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200/60 pt-2 text-xs">
              <span className="text-zinc-500">Balance due:</span>
              <span
                className={`font-bold tabular-nums ${
                  balanceDueNow > 0.001 ? 'text-amber-800' : 'text-emerald-700'
                }`}
              >
                {money(balanceDueNow)}
                {balanceDueNow <= 0.001 && ' (Paid in full)'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? 'Updating…' : 'Save Changes'}
            </Button>
          </div>
        </form>

        {/* Create new customer modal */}
        {createOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="dgn-card w-full max-w-sm rounded-xl p-5 shadow-lg bg-white">
              <h3 className="text-sm font-bold text-zinc-900">New Shop Customer</h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Register a customer for this shop stall.
              </p>

              {createError && (
                <p className="mt-2.5 rounded bg-red-50 p-2 text-xs text-red-700">
                  {createError}
                </p>
              )}

              <div className="mt-3 space-y-2.5">
                <div>
                  <Label className="text-xs">Full Name</Label>
                  <Input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Customer name"
                    className="h-8 text-xs mt-1"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs">Phone (optional)</Label>
                  <Input
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="080…"
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={createCustomerMutation.isPending || !createName.trim()}
                  onClick={() => createCustomerMutation.mutate()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {createCustomerMutation.isPending ? 'Creating…' : 'Create & Select'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
