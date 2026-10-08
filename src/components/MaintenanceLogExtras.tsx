import { useState } from 'react'
import { Camera, ImagePlus, Images, Loader2, X } from 'lucide-react'
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DOWNTIME_DAY_OPTIONS,
  DOWNTIME_HOUR_OPTIONS,
  parsePhotoUrls,
  uploadImageFile,
  type DowntimeUnit,
  type PhotoUploadKind,
  mediaUrl,
} from '@/lib/maintenanceForm'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

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

export function PhotoGallery({
  photos,
  size = 'md',
}: {
  photos: string[]
  size?: 'sm' | 'md' | 'lg'
}) {
  if (!photos.length) return null
  const box =
    size === 'lg' ? 'size-24 sm:size-28' : size === 'sm' ? 'size-10' : 'size-16 sm:size-20'
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((src, idx) => (
        <a
          key={`${src.slice(0, 32)}-${idx}`}
          href={mediaUrl(src)}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800',
            box,
          )}
        >
          <img src={mediaUrl(src)} alt="" className="size-full object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  )
}

const PHOTO_ACCEPT = 'image/*,.heic,.heif,image/heic,image/heif'

export function MaintenancePhotoPicker({
  photos,
  onChange,
  label = 'Photos',
  variant = 'default',
  required = false,
  kind = 'maintenance',
}: {
  photos: string[]
  onChange: (next: string[]) => void
  label?: string
  /** Larger camera/gallery controls for phone use (security gate). */
  variant?: 'default' | 'phone'
  required?: boolean
  /** Folder used when uploading immediately after pick. */
  kind?: PhotoUploadKind
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function addFiles(files: FileList | null) {
    if (!files?.length || busy) return
    setError(null)
    setBusy(true)
    const next = [...photos]
    const failures: string[] = []
    try {
      for (const file of Array.from(files)) {
        if (next.length >= 8) break
        try {
          next.push(await uploadImageFile(file, kind))
        } catch (err) {
          const msg =
            (err as { response?: { data?: { err?: string; msg?: string } }; message?: string })
              .response?.data?.err ||
            (err as { response?: { data?: { msg?: string } } }).response?.data?.msg ||
            (err as { message?: string }).message ||
            'Could not upload photo'
          failures.push(msg)
        }
      }
      if (next.length !== photos.length) onChange(next)
      if (failures.length) {
        setError(failures[0])
      }
    } finally {
      setBusy(false)
    }
  }

  const phone = variant === 'phone'
  const canAdd = photos.length < 8 && !busy

  return (
    <div>
      <Label
        className={cn(
          'font-bold text-zinc-700 dark:text-zinc-300',
          phone ? 'text-sm' : 'text-xs',
        )}
      >
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </Label>

      {phone ? (
        <div className="mt-2 space-y-3">
          {canAdd && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                className={cn(
                  'flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-900 text-sm font-semibold text-white active:bg-zinc-800',
                  busy && 'pointer-events-none opacity-70',
                )}
              >
                {busy ? <Loader2 className="size-5 shrink-0 animate-spin" /> : <Camera className="size-5 shrink-0" />}
                {busy ? 'Uploading…' : 'Take photo'}
                <input
                  type="file"
                  accept={PHOTO_ACCEPT}
                  capture="environment"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    void addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
              <label
                className={cn(
                  'flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 active:bg-zinc-50',
                  busy && 'pointer-events-none opacity-70',
                )}
              >
                {busy ? <Loader2 className="size-5 shrink-0 animate-spin" /> : <Images className="size-5 shrink-0" />}
                {busy ? 'Uploading…' : 'From gallery'}
                <input
                  type="file"
                  accept={PHOTO_ACCEPT}
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    void addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {photos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
              Take a clear photo of the load, goods, or vehicle.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((src, idx) => (
                <div
                  key={`${src.slice(0, 48)}-${idx}`}
                  className="relative aspect-[4/3] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
                >
                  <img src={mediaUrl(src)} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-black/70 text-white"
                    onClick={() => onChange(photos.filter((_, i) => i !== idx))}
                    aria-label="Remove photo"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-1 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            {photos.map((src, idx) => (
              <div
                key={`${src.slice(0, 48)}-${idx}`}
                className="relative size-16 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
              >
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
            {canAdd && (
              <label className="flex size-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                <span className="text-[9px] font-semibold">{busy ? '…' : 'Add'}</span>
                <input
                  type="file"
                  accept={PHOTO_ACCEPT}
                  capture="environment"
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    void addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      )}
    </div>
  )
}

export type MaintenanceViewRecord = {
  id: number
  title: string
  maintenanceType?: string | null
  status?: string | null
  technician?: string | null
  cost?: number | string | null
  downtimeMinutes?: number | string | null
  partsReplaced?: string | null
  notes?: string | null
  photoUrls?: string[] | string | null
  startedAt?: string | null
  endedAt?: string | null
  performedDate?: string | null
  createdAt?: string | null
  machine?: { id?: number; name?: string; code?: string } | null
}

function money(n: number | string | null | undefined) {
  const v = Number(n || 0)
  return `₦${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function minsLabel(min: number | string | null | undefined) {
  const n = Number(min || 0)
  if (!(n > 0)) return '0 min'
  if (n >= 60) {
    const h = Math.floor(n / 60)
    const m = Math.round(n % 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${n} min`
}

export function MaintenanceViewDialog({
  record,
  open,
  onOpenChange,
  onEdit,
}: {
  record: MaintenanceViewRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (record: MaintenanceViewRecord) => void
}) {
  if (!record) return null
  const photos = parsePhotoUrls(record.photoUrls)
  const from = record.startedAt || record.performedDate || record.createdAt
  const to = record.endedAt || record.performedDate

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-zinc-900">
            {record.title || 'Maintenance'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            {record.maintenanceType ? (
              <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-700">
                {record.maintenanceType}
              </span>
            ) : null}
            {record.status ? (
              <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-700">
                {record.status}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">When</p>
              <p className="mt-0.5 font-semibold text-zinc-900">{formatDateTime(from || '')}</p>
              {to && from && String(to) !== String(from) ? (
                <p className="text-[11px] text-zinc-500">→ {formatDateTime(to)}</p>
              ) : null}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Machine</p>
              <p className="mt-0.5 font-semibold text-zinc-900">
                {record.machine?.name || '—'}
                {record.machine?.code ? ` (${record.machine.code})` : ''}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Technician</p>
              <p className="mt-0.5 font-semibold text-zinc-900">{record.technician || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Cost</p>
              <p className="mt-0.5 font-semibold text-zinc-900">{money(record.cost)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Downtime</p>
              <p className="mt-0.5 font-semibold text-zinc-900">{minsLabel(record.downtimeMinutes)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Parts</p>
              <p className="mt-0.5 font-semibold text-zinc-900">{record.partsReplaced || '—'}</p>
            </div>
          </div>

          {record.notes ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Notes</p>
              <p className="mt-1 text-xs text-zinc-700 whitespace-pre-wrap">{record.notes}</p>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Photos {photos.length ? `(${photos.length})` : ''}
            </p>
            {photos.length > 0 ? (
              <PhotoGallery photos={photos} size="lg" />
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-500">
                No photos attached to this record.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 text-xs"
              onClick={() => {
                onOpenChange(false)
                onEdit(record)
              }}
            >
              Edit
            </Button>
          ) : null}
          <Button type="button" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
