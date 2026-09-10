import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Page toolbar — sidebar already names the page, so no title block. */
export function PageHeader({
  actions,
  className,
}: {
  eyebrow?: string
  title?: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  if (!actions) return null
  return (
    <div className={cn('mb-5 flex flex-wrap items-center justify-end gap-2', className)}>
      {actions}
    </div>
  )
}

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={cn('dgn-card p-3 sm:p-3.5', className)}>{children}</section>
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="dgn-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--ink-faint)]">{hint}</span>}
    </label>
  )
}

export function StatPill({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string
  value: string
  tone?: 'default' | 'accent' | 'success' | 'danger'
  hint?: string
}) {
  const tones = {
    default: 'bg-zinc-50 text-zinc-900',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
    success: 'bg-teal-50 text-teal-800',
    danger: 'bg-red-50 text-red-700',
  }
  return (
    <div className={cn('rounded-xl px-3 py-2', tones[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] opacity-70">{hint}</p>}
    </div>
  )
}

export function formatAmountTyping(raw: string) {
  let s = raw.replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, 2)
  }
  const [whole = '', frac] = s.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (s.includes('.')) return `${grouped}.${frac ?? ''}`
  return grouped
}

export function parseAmountTyping(formatted: string) {
  return formatted.replace(/,/g, '')
}

export function NairaAmountInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string
  onChange: (numeric: string) => void
  placeholder?: string
  required?: boolean
}) {
  const display = formatAmountTyping(value)
  return (
    <div className="flex items-center rounded-xl border border-[var(--line)] bg-white transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
      <span className="pl-3 text-sm text-[var(--ink-muted)]">₦</span>
      <input
        className="min-w-0 flex-1 bg-transparent px-2 py-[0.85rem] outline-none"
        inputMode="decimal"
        value={display}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(parseAmountTyping(formatAmountTyping(e.target.value)))}
      />
    </div>
  )
}

export function ErrorBanner({
  title = 'Fix these before saving',
  items,
}: {
  title?: string
  items: Array<{ label: string; message: string }>
}) {
  if (!items.length) return null
  return (
    <Card className="border-red-200 bg-red-50 text-red-800 !p-4">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`}>
            <span className="font-semibold">{item.label}:</span> {item.message}
          </li>
        ))}
      </ul>
    </Card>
  )
}
