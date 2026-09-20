import { DATE_RANGE_OPTIONS, defaultCustomRange, type DateRangeState } from '@/lib/dateRange'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Props = {
  value: DateRangeState
  onChange: (next: DateRangeState) => void
  className?: string
  triggerClassName?: string
}

export function DateRangePreset({ value, onChange, className, triggerClassName }: Props) {
  const isCustom = value.rangePreset === 'custom'

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <Select
        value={value.rangePreset}
        onValueChange={(preset) => {
          if (preset === 'custom') {
            const defaults = defaultCustomRange()
            onChange({
              rangePreset: 'custom',
              from: value.from || defaults.from,
              to: value.to || defaults.to,
            })
            return
          }
          onChange({ rangePreset: preset, from: undefined, to: undefined })
        }}
      >
        <SelectTrigger
          className={cn(
            'h-8 w-[140px] sm:w-[160px] text-xs bg-white dark:bg-zinc-900',
            triggerClassName,
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_RANGE_OPTIONS.map((o) => (
            <SelectItem key={o.id} value={o.id} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isCustom ? (
        <>
          <Input
            type="date"
            className="h-8 w-[132px] text-xs bg-white dark:bg-zinc-900"
            value={value.from || ''}
            max={value.to || undefined}
            onChange={(e) =>
              onChange({
                rangePreset: 'custom',
                from: e.target.value,
                to: value.to,
              })
            }
            aria-label="From date"
          />
          <span className="text-[11px] text-muted-foreground shrink-0">to</span>
          <Input
            type="date"
            className="h-8 w-[132px] text-xs bg-white dark:bg-zinc-900"
            value={value.to || ''}
            min={value.from || undefined}
            onChange={(e) =>
              onChange({
                rangePreset: 'custom',
                from: value.from,
                to: e.target.value,
              })
            }
            aria-label="To date"
          />
        </>
      ) : null}
    </div>
  )
}
