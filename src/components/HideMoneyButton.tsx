import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHideMoney } from '@/hooks/useHideMoney'

export function HideMoneyButton({ className }: { className?: string }) {
  const { hidden, toggle } = useHideMoney()
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
      }}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-black/5 hover:text-zinc-800',
        className,
      )}
      aria-label={hidden ? 'Show balances' : 'Hide balances'}
      title={hidden ? 'Show balances' : 'Hide balances'}
    >
      {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
    </button>
  )
}
