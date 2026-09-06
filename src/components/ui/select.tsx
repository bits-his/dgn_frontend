import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectContextType {
  value?: string
  onValueChange?: (value: string) => void
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  labels: Map<string, React.ReactNode>
  registerLabel: (val: string, label: React.ReactNode) => void
}

const SelectContext = React.createContext<SelectContextType>({
  open: false,
  setOpen: () => {},
  labels: new Map(),
  registerLabel: () => {},
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
  const [registeredLabels, setRegisteredLabels] = React.useState<Map<string, React.ReactNode>>(() => new Map())

  // Synchronously extract labels from JSX tree on every render
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
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, labels, registerLabel }}>
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
  const { open, setOpen } = React.useContext(SelectContext)
  return (
    <button
      type="button"
      ref={ref}
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
  const { open } = React.useContext(SelectContext)

  return (
    <div
      className={cn(
        "absolute z-50 min-w-full w-full max-h-60 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 text-zinc-950 shadow-md animate-in fade-in-80 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
        side === "top" ? "bottom-full mb-1" : "top-full mt-1",
        !open && "hidden pointer-events-none",
        className
      )}
    >
      {children}
    </div>
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
      onClick={() => {
        onValueChange?.(value)
        setOpen(false)
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-xs outline-hidden hover:bg-zinc-100 dark:hover:bg-zinc-800",
        isSelected && "bg-zinc-100 font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50",
        className
      )}
    >
      <span className="truncate">{children}</span>
      {isSelected && <Check className="size-3.5 text-zinc-700 shrink-0" />}
    </div>
  )
}

