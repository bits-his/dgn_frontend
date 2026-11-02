import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Phone, User, FileText, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { isOutletScoped } from '@/lib/outlet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type CreatedShopBuyer = {
  id: number
  name: string
  phone?: string | null
  notes?: string | null
}

export function CreateShopCustomerDialog({
  open,
  onOpenChange,
  outletId,
  initialName = '',
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  outletId?: number | null
  shopCode?: string | null
  initialName?: string
  onSuccess?: (buyer: CreatedShopBuyer) => void
}) {
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  // Sync initialName when opened
  useEffect(() => {
    if (open) {
      setName(initialName || '')
      setPhone('')
      setNotes('')
      setError('')
    }
  }, [open, initialName])

  // Resolve effective outlet ID (from scoped user or explicitly passed)
  const effectiveOutletId = isOutletScoped(user)
    ? Number(user?.outletCustomerId)
    : outletId
    ? Number(outletId)
    : null

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim()
      if (!trimmedName) throw new Error('Customer name is required')
      if (!effectiveOutletId) throw new Error('Shop identifier is missing')

      const { data } = await api.post('/outlet-sales/buyers', {
        outletCustomerId: effectiveOutletId,
        name: trimmedName,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })

      return data.data as CreatedShopBuyer
    },
    onSuccess: async (buyer) => {
      setError('')
      onOpenChange(false)
      // Invalidate queries so lists refresh immediately
      await qc.invalidateQueries({ queryKey: ['shop-buyers'] })
      await qc.invalidateQueries({ queryKey: ['outlet-buyers'] })
      await qc.invalidateQueries({ queryKey: ['outlet-overview'] })
      onSuccess?.(buyer)
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: { data?: { err?: string; errors?: { name?: string } } }
        message?: string
      }
      setError(
        axiosErr.response?.data?.errors?.name ||
          axiosErr.response?.data?.err ||
          axiosErr.message ||
          'Could not create customer',
      )
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter the customer name')
      return
    }
    createCustomerMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <UserPlus className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900">
                New shop customer
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Register a buyer to sell on credit, record payments, and keep account records.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          {error && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
              <User className="size-3.5 text-zinc-400" />
              Full Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError('')
              }}
              placeholder="e.g. Alhaji Musa, Mama Chinedu"
              className="h-9 text-xs"
              autoFocus
              disabled={createCustomerMutation.isPending}
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
              <Phone className="size-3.5 text-zinc-400" />
              Phone number <span className="text-[11px] font-normal text-zinc-400">(optional)</span>
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0803 123 4567"
              className="h-9 text-xs font-mono"
              inputMode="tel"
              disabled={createCustomerMutation.isPending}
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
              <FileText className="size-3.5 text-zinc-400" />
              Notes / Location <span className="text-[11px] font-normal text-zinc-400">(optional)</span>
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Stall C-12, Main Market"
              className="h-9 text-xs"
              disabled={createCustomerMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8.5 px-3 text-xs"
              onClick={() => onOpenChange(false)}
              disabled={createCustomerMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createCustomerMutation.isPending || !name.trim()}
              className="h-8.5 px-3.5 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white gap-1.5 shadow-xs"
            >
              {createCustomerMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" />
                  Save customer
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

