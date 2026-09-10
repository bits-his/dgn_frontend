import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectContextType {
  value?: string
  onValueChange?: (value: string) => void
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  labels: Map<string, React.ReactNode>
  registerLabel: (val: string, label: React.ReactNode) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const SelectContext = React.createContext<SelectContextType>({
  open: false,
  setOpen: () => {},
  labels: new Map(),
  registerLabel: () => {},
  triggerRef: { current: null },
})

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

function extractChildLabels(node: React.ReactNode, map: Map<string, React.ReactNode>) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: unknown; children?: React.ReactNode }
    if (props?.value !== undefined && props?.children !== undefined) {
      map.set(String(props.value), props.children)
    }
    if (props?.children) {
      extractChildLabels(props.children, map)
    }
  })
}

export function Select({ value, onValueChange, children, className }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const [registeredLabels, setRegisteredLabels] = React.useState<Map<string, React.ReactNode>>(() => new Map())

  const syncLabels = React.useMemo(() => {
    const map = new Map<string, React.ReactNode>()
    extractChildLabels(children, map)
    return map
  }, [children])

  const labels = React.useMemo(() => {
    const merged = new Map(registeredLabels)
    syncLabels.forEach((v, k) => merged.set(k, v))
    return merged
  }, [registeredLabels, syncLabels])

  const registerLabel = React.useCallback((val: string, label: React.ReactNode) => {
    setRegisteredLabels((prev) => {
      if (prev.get(val) === label) return prev
      const next = new Map(prev)
      next.set(val, label)
      return next
    })
  }, [])

  React.useEffect(() => {
    function handlePointerOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      const portal = document.getElementById("dgn-select-portal")
      if (portal?.contains(target)) return
      setOpen(false)
    }
    if (open) {
      document.addEventListener("mousedown", handlePointerOutside)
      document.addEventListener("touchstart", handlePointerOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handlePointerOutside)
      document.removeEventListener("touchstart", handlePointerOutside)
    }
  }, [open])

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, labels, registerLabel, triggerRef }}>
      <div ref={containerRef} className={cn("relative text-left w-full", className)}>
        {children}
      </div>
    </SelectContext.Provider>
  )
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen, triggerRef } = React.useContext(SelectContext)
  return (
    <button
      type="button"
      ref={(node) => {
        triggerRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      }}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 shadow-xs hover:bg-zinc-50 focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className={cn("size-3.5 opacity-50 shrink-0 transition-transform duration-150", open && "rotate-180")} />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

export function SelectValue({
  placeholder,
  children,
  className,
}: {
  placeholder?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const { value, labels } = React.useContext(SelectContext)
  if (children) {
    return <span className={cn("truncate block", className)}>{children}</span>
  }
  const displayLabel = value != null && value !== "" ? labels.get(String(value)) : undefined
  return <span className={cn("truncate block", className)}>{displayLabel ?? placeholder ?? value ?? null}</span>
}

export function SelectContent({
  children,
  side = "bottom",
  className,
}: {
  children: React.ReactNode
  side?: "top" | "bottom"
  className?: string
}) {
  const { open, triggerRef } = React.useContext(SelectContext)
  const [coords, setCoords] = React.useState<{
    top: number
    left: number
    width: number
    maxHeight: number
    placeAbove: boolean
  } | null>(null)

  const updatePosition = React.useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const gap = 4
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const preferAbove = side === "top" || (spaceBelow < 180 && spaceAbove > spaceBelow)
    const maxHeight = Math.min(240, Math.max(120, preferAbove ? spaceAbove : spaceBelow))
    setCoords({
      top: preferAbove ? Math.max(8, rect.top - gap) : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight,
      placeAbove: preferAbove,
    })
  }, [side, triggerRef])

  React.useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open, updatePosition])

  if (!open || !coords || typeof document === "undefined") return null

  return createPortal(
    <div
      id="dgn-select-portal"
      className={cn(
        "fixed z-[100] overflow-y-auto overscroll-contain rounded-md border border-zinc-200 bg-white p-1 text-zinc-950 shadow-md animate-in fade-in-80 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
        className
      )}
      style={{
        top: coords.placeAbove ? undefined : coords.top,
        bottom: coords.placeAbove ? window.innerHeight - coords.top : undefined,
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight,
      }}
    >
      {children}
    </div>,
    document.body
  )
}

export function SelectItem({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const { value: selectedValue, onValueChange, setOpen, registerLabel } = React.useContext(SelectContext)
  const isSelected = selectedValue === value

  React.useLayoutEffect(() => {
    if (registerLabel && value) {
      registerLabel(value, children)
    }
  }, [value, children, registerLabel])

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => {
        onValueChange?.(value)
        setOpen(false)
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-2 py-2.5 sm:py-1.5 text-xs outline-hidden hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-100",
        isSelected && "bg-zinc-100 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50",
        className
      )}
    >
      <span className="truncate">{children}</span>
      {isSelected && <Check className="size-3.5 text-zinc-700 shrink-0" />}
    </div>
  )
}
