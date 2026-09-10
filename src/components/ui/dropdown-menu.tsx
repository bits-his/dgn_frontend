import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface DropdownContextType {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const DropdownContext = React.createContext<DropdownContextType>({
  open: false,
  setOpen: () => {},
})

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

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
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

export function DropdownMenuTrigger({
  asChild,
  children,
}: {
  asChild?: boolean
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>
}) {
  const { open, setOpen } = React.useContext(DropdownContext)

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        children.props.onClick?.(e)
        setOpen(!open)
      },
    })
  }

  return (
    <button type="button" onClick={() => setOpen(!open)}>
      {children}
    </button>
  )
}

export function DropdownMenuContent({
  align = "end",
  className,
  children,
}: {
  align?: "start" | "end" | "center"
  className?: string
  children: React.ReactNode
}) {
  const { open } = React.useContext(DropdownContext)
  if (!open) return null

  return (
    <div
      className={cn(
        "absolute z-50 mt-1.5 min-w-[8rem] overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 text-zinc-950 shadow-lg animate-in fade-in-80 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
        align === "end" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  )
}

export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  children,
  className,
}: {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg py-1.5 pl-7 pr-2 text-xs font-medium outline-hidden hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
        className
      )}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <Check className="size-3.5 text-zinc-900 dark:text-zinc-50" />}
      </span>
      {children}
    </div>
  )
}
