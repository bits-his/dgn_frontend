import { ImagePlus, X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { NairaAmountInput } from '@/components/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  compressImageFile,
  DOWNTIME_DAY_OPTIONS,
  DOWNTIME_HOUR_OPTIONS,
  type DowntimeUnit,
  mediaUrl,
} from '@/lib/maintenanceForm'

export function MaintenanceCostAndDowntime({
  cost,
  onCost,
  downUnit,
  downValue,
  onDownUnit,
  onDownValue,
}: {
  cost: string
  onCost: (v: string) => void
  downUnit: DowntimeUnit
  downValue: string
  onDownUnit: (u: DowntimeUnit) => void
  onDownValue: (v: string) => void
}) {
  const durationOptions = downUnit === 'days' ? DOWNTIME_DAY_OPTIONS : DOWNTIME_HOUR_OPTIONS

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Cost (₦)</Label>
        <NairaAmountInput
          value={cost}
          onChange={onCost}
          placeholder="0"
          className="mt-1 h-9"
          inputClassName="h-9 text-xs font-mono"
        />
      </div>
      <div>
        <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Downtime</Label>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <Select
            value={downUnit}
            onValueChange={(val) => {
              const unit = val as DowntimeUnit
              onDownUnit(unit)
              onDownValue(unit === 'days' ? '1' : '1')
            }}
          >
            <SelectTrigger className="w-full h-9 text-xs font-semibold bg-white dark:bg-zinc-950">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={downValue} onValueChange={onDownValue}>
            <SelectTrigger className="w-full h-9 text-xs font-semibold bg-white dark:bg-zinc-950">
              <SelectValue placeholder="Duration" />
            </SelectTrigger>
            <SelectContent>
              {durationOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

export function PhotoGallery({ photos }: { photos: string[] }) {
  if (!photos.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((src, idx) => (
        <a
          key={`${src.slice(0, 32)}-${idx}`}
          href={mediaUrl(src)}
          target="_blank"
          rel="noreferrer"
          className="size-16 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
        >
          <img src={mediaUrl(src)} alt="" className="size-full object-cover" />
        </a>
      ))}
    </div>
  )
}

export function MaintenancePhotoPicker({
  photos,
  onChange,
  label = 'Photos',
}: {
  photos: string[]
  onChange: (next: string[]) => void
  label?: string
}) {
  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    const next = [...photos]
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      if (next.length >= 8) break
      try {
        next.push(await compressImageFile(file))
      } catch {
        // skip unreadable files
      }
    }
    onChange(next)
  }

  return (
    <div>
      <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{label}</Label>
      <div className="mt-1 flex flex-wrap gap-2">
        {photos.map((src, idx) => (
          <div key={`${src.slice(0, 24)}-${idx}`} className="relative size-16 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <img src={mediaUrl(src)} alt="" className="size-full object-cover" />
            <button
              type="button"
              className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/70 text-white"
              onClick={() => onChange(photos.filter((_, i) => i !== idx))}
              aria-label="Remove photo"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {photos.length < 8 && (
          <label className="flex size-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700">
            <ImagePlus className="size-4" />
            <span className="text-[9px] font-semibold">Add</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                void addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
    </div>
  )
}
