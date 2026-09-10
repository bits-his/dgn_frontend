import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"

export default function BackButton({
  text = "Back",
  to,
  className,
  onClick,
}: {
  text?: string
  to?: string
  className?: string
  onClick?: () => void
}) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (to) {
      navigate(to)
    } else {
      navigate(-1)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-strong)] hover:underline cursor-pointer",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{text}</span>
    </button>
  )
}
