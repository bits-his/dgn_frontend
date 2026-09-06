import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextType | null>(null)

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [isControlled, onOpenChange]
  )

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, setOpen])

  return (
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

export interface DialogTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  DialogTriggerProps
>(({ asChild, children, onClick, ...props }, ref) => {
  const ctx = React.useContext(DialogContext)

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
      onClick: (e: React.MouseEvent) => {
        (children as React.ReactElement<{ onClick?: React.MouseEventHandler }>).props.onClick?.(e)
        onClick?.(e as React.MouseEvent<HTMLButtonElement>)
        ctx?.setOpen(true)
      },
    })
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        onClick?.(e)
        ctx?.setOpen(true)
      }}
      {...props}
    >
      {children}
    </button>
  )
})
DialogTrigger.displayName = "DialogTrigger"

export interface DialogCloseProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export const DialogClose = React.forwardRef<
  HTMLButtonElement,
  DialogCloseProps
>(({ asChild, children, onClick, ...props }, ref) => {
  const ctx = React.useContext(DialogContext)

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
      onClick: (e: React.MouseEvent) => {
        (children as React.ReactElement<{ onClick?: React.MouseEventHandler }>).props.onClick?.(e)
        onClick?.(e as React.MouseEvent<HTMLButtonElement>)
        ctx?.setOpen(false)
      },
    })
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        onClick?.(e)
        ctx?.setOpen(false)
      }}
      {...props}
    >
      {children}
    </button>
  )
})
DialogClose.displayName = "DialogClose"

export interface DialogContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  hideClose?: boolean
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(({ className, children, hideClose = false, ...props }, ref) => {
  const ctx = React.useContext(DialogContext)
  const overlayRef = React.useRef<HTMLDivElement>(null)

  if (!ctx?.open) return null

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          ctx.setOpen(false)
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in-0 duration-200"
    >
      <div
        ref={ref}
        role="document"
        className={cn(
          "relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:max-w-xl",
          className
        )}
        {...props}
      >
        {!hideClose && (
          <button
            type="button"
            onClick={() => ctx.setOpen(false)}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors focus:outline-none dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  )
})
DialogContent.displayName = "DialogContent"

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left mb-4",
        className
      )}
      {...props}
    />
  )
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-6",
        className
      )}
      {...props}
    />
  )
}

export const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-zinc-900 dark:text-zinc-100",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

export const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-zinc-500 dark:text-zinc-400 mt-1", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"
