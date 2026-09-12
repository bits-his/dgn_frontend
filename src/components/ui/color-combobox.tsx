/**
 * ColorCombobox — searchable colour picker
 * Self-contained: no cmdk / Radix / base-ui required.
 */
import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SORT_COLORS } from '@/lib/sortColors'

type Color = (typeof SORT_COLORS)[number]

interface ColorComboboxProps {
  /** Currently selected colour code (e.g. "RED"), or "" for none */
  value: string
  onChange: (code: string) => void
  /** Filter out already-used colours */
  exclude?: string[]
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
}

export function ColorCombobox({
  value,
  onChange,
  exclude = [],
  placeholder = 'Select colour…',
  className,
  disabled,
  id,
}: ColorComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selected = SORT_COLORS.find((c) => c.code === value) ?? null

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return SORT_COLORS.filter(
      (c) =>
        !exclude.includes(c.code) &&
        (q === '' || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)),
    )
  }, [query, exclude])

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleSelect = (color: Color) => {
    onChange(color.code)
    setOpen(false)
    setQuery('')
    // Return focus to the trigger so keyboard nav works after
    setTimeout(() => containerRef.current?.querySelector('button')?.focus(), 0)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
  }

  const handleToggle = () => {
    if (disabled) return
    const next = !open
    setOpen(next)
    if (next) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }

  const colorDot = (code: string) => {
    const dots: Record<string, string> = {
      WHITE: 'bg-white border border-zinc-300',
      CLEAR: 'bg-zinc-100 border border-zinc-300',
      TRANSPARENT: 'bg-transparent border border-zinc-300',
      RED: 'bg-red-500',
      PINK: 'bg-pink-400',
      ORANGE: 'bg-orange-400',
      YELLOW: 'bg-yellow-400',
      GREEN: 'bg-green-500',
      LIGHT_GREEN: 'bg-green-300',
      BLUE: 'bg-blue-500',
      LIGHT_BLUE: 'bg-sky-300',
      DARK_BLUE: 'bg-blue-900',
      PURPLE: 'bg-purple-500',
      VIOLET: 'bg-violet-600',
      BROWN: 'bg-amber-800',
      GREY: 'bg-zinc-400',
      SILVER: 'bg-zinc-300 border border-zinc-400',
      GOLD: 'bg-amber-400',
      BLACK: 'bg-zinc-900',
      MULTICOLOR:
        'bg-gradient-to-br from-red-400 via-green-400 to-blue-400',
      MIXED: 'bg-gradient-to-br from-zinc-300 to-zinc-600',
    }
    return dots[code] ?? 'bg-zinc-300'
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Trigger button */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'dgn-input flex w-full items-center justify-between gap-2 text-left',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span
              className={cn('inline-block h-3 w-3 shrink-0 rounded-full', colorDot(selected.code))}
            />
            <span className="truncate text-sm font-medium">{selected.name}</span>
          </span>
        ) : (
          <span className="text-sm text-[var(--ink-faint)]">{placeholder}</span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear"
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
              className="rounded p-0.5 text-zinc-400 hover:text-zinc-700"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={cn('h-4 w-4 text-zinc-400 transition-transform', open && 'rotate-180')}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-xl ring-1 ring-black/5"
        >
          {/* Search input */}
          <div className="border-b border-zinc-100 p-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search colours…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  if (filtered[0]) handleSelect(filtered[0])
                }
              }}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Options list */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-zinc-400">No colours found.</li>
            )}
            {filtered.map((color) => {
              const isSelected = color.code === value
              return (
                <li
                  key={color.code}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()} // keep focus in search
                  onClick={() => handleSelect(color)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                    isSelected
                      ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent-strong)]'
                      : 'hover:bg-zinc-50',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-3.5 w-3.5 shrink-0 rounded-full',
                      colorDot(color.code),
                    )}
                  />
                  <span className="flex-1">{color.name}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
