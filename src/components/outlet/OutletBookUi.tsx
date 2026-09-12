import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function CompactStat({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  icon?: ComponentType<{ className?: string }>
  tone?: 'neutral' | 'warn' | 'ok' | 'info'
}) {
  const iconWrap =
    tone === 'warn'
      ? 'bg-amber-50 text-amber-700'
      : tone === 'ok'
        ? 'bg-teal-50 text-teal-700'
        : tone === 'info'
          ? 'bg-sky-50 text-sky-700'
          : 'bg-zinc-100 text-zinc-600'

  return (
    <div className="flex min-h-[4.25rem] flex-col justify-between rounded-lg border border-zinc-200/90 bg-white p-2.5 shadow-xs sm:rounded-xl sm:p-3">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {Icon ? (
          <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md', iconWrap)}>
            <Icon className="size-3" />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          'mt-1 truncate text-base font-black tabular-nums tracking-tight sm:text-lg',
          tone === 'warn' ? 'text-amber-800' : 'text-zinc-900',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  )
}

export function BookPanel({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-lg border border-zinc-200/90 bg-white p-2.5 sm:rounded-xl sm:p-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-tight text-zinc-900 sm:text-sm">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function DataRow({
  title,
  meta,
  value,
  hint,
}: {
  title: string
  meta?: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 py-2 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-zinc-900">{title}</p>
        {meta ? <p className="truncate text-[11px] text-zinc-500">{meta}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-semibold tabular-nums text-zinc-900">{value}</p>
        {hint ? <p className="text-[11px] text-amber-700">{hint}</p> : null}
      </div>
    </div>
  )
}

export function StatusChip({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'muted'
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
        tone === 'ok' && 'bg-teal-50 text-teal-800',
        tone === 'warn' && 'bg-amber-50 text-amber-800',
        tone === 'danger' && 'bg-red-50 text-red-700',
        tone === 'muted' && 'bg-zinc-100 text-zinc-600',
      )}
    >
      {children}
    </span>
  )
}
