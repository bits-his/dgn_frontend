import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-muted)] sm:text-base">
            {description}
          </p>
        )}
      </div>
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
  return <section className={cn('dgn-card p-5 sm:p-6', className)}>{children}</section>
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
    <div className={cn('rounded-2xl px-4 py-3', tones[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] opacity-70">{hint}</p>}
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
