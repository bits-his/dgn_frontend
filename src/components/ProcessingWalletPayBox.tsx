import { useQuery } from '@tanstack/react-query'
import { Banknote } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useHideMoney } from '@/hooks/useHideMoney'

function money(n: number) {
  return `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

type MeWallet = {
  data: { remaining: number }
  hasWallet: boolean
}

export function ProcessingWalletPayBox({
  checked,
  onChange,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  className?: string
}) {
  const wallet = useQuery({
    queryKey: ['processing-wallet-me'],
    queryFn: async () => {
      const { data } = await api.get('/processing-wallets/me')
      return data as MeWallet
    },
  })

  const remaining = Number(wallet.data?.data?.remaining || 0)
  const hasWallet = Boolean(wallet.data?.hasWallet)
  const { maskMoney } = useHideMoney()

  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-2xl border p-3 sm:p-4',
        checked ? 'border-emerald-200 bg-emerald-50/80' : 'border-zinc-200 bg-white',
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-1 size-4 accent-emerald-700"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
          <Banknote className="size-4 text-emerald-700" />
          Pay from my processing money
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {hasWallet
            ? `Remaining ${maskMoney(money(remaining))}. Cash on this save comes off that balance.`
            : 'No processing money has been given to this account yet. Leave this off, or ask admin to give money first.'}
        </p>
      </div>
    </label>
  )
}
