import * as React from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SearchableSelectOption = {
  value: string
  label: string
  sublabel?: string
  badge?: string
  icon?: React.ReactNode
}

export interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  label?: string
  className?: string
  triggerClassName?: string
  size?: 'sm' | 'default' | 'lg'
  disabled?: boolean
  allowClear?: boolean
  emptyMessage?: string
  id?: string
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search options…',
  label,
  className,
  triggerClassName,
  size = 'default',
  disabled,
  allowClear = true,
  emptyMessage = 'No options found.',
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const selected = options.find((opt) => opt.value === value) ?? null

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q)
      const matchSub = opt.sublabel?.toLowerCase().includes(q)
      const matchBadge = opt.badge?.toLowerCase().includes(q)
      const matchVal = opt.value.toLowerCase().includes(q)
      return matchLabel || matchSub || matchBadge || matchVal
    })
  }, [options, query])

  // Close on click outside
  React.useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleToggle = () => {
    if (disabled) return
    const next = !open
    setOpen(next)
    if (next) {
      setTimeout(() => searchInputRef.current?.focus(), 60)
    } else {
      setQuery('')
    }
  }

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white shadow-2xs transition-colors hover:bg-zinc-50/70 focus:outline-hidden focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/70 dark:focus:ring-zinc-300 text-left',
          size === 'sm' && 'h-8 px-2.5 py-1 text-xs',
          size === 'default' && 'h-9 px-3 py-1.5 text-xs',
          size === 'lg' && 'h-11 px-3.5 py-2 text-sm',
          disabled && 'opacity-50 cursor-not-allowed',
          triggerClassName
        )}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {label && (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {label}:
            </span>
          )}
          {selected ? (
            <span className="truncate flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
              {selected.icon && <span className="shrink-0">{selected.icon}</span>}
              <span className="truncate">{selected.label}</span>
              {selected.sublabel && (
                <span className="text-[11px] font-normal text-zinc-400 dark:text-zinc-500 shrink-0">
                  ({selected.sublabel})
                </span>
              )}
              {selected.badge && (
                <span className="ml-1 rounded px-1.5 py-0.2 text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {selected.badge}
                </span>
              )}
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500 truncate">{placeholder}</span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1 text-zinc-400">
          {allowClear && selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
              className="rounded p-0.5 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')}
          />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-xl ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {/* Search input */}
          <div className="flex items-center border-b border-zinc-100 dark:border-zinc-800 px-2.5 py-1.5">
            <Search className="size-3.5 text-zinc-400 mr-2 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (filtered.length > 0) {
                    handleSelect(filtered[0].value)
                  }
                }
              }}
              className="w-full bg-transparent text-xs outline-hidden placeholder:text-zinc-400 dark:text-zinc-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Options list */}
          <ul className="max-h-60 overflow-y-auto p-1 text-xs">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-zinc-400 dark:text-zinc-500">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelect(opt.value)
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelect(opt.value)
                    }}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors',
                      isSelected
                        ? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                        : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="min-w-0">
                        <p className="truncate">{opt.label}</p>
                        {opt.sublabel && (
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                            {opt.sublabel}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="size-3.5 text-zinc-900 dark:text-zinc-100" />}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
