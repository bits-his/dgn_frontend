import { cn } from '@/lib/utils'

export const DGN_LOGO_SRC = '/dgn-logo.png'

type BrandMarkProps = {
  className?: string
  size?: number
  alt?: string
}

export function BrandMark({ className, size = 44, alt = 'DGN' }: BrandMarkProps) {
  return (
    <img
      src={DGN_LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}
