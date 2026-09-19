import { api } from '@/lib/api'

export type DowntimeUnit = 'hours' | 'days'

export const DOWNTIME_HOUR_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'None' },
  { value: '0.25', label: '15 min' },
  { value: '0.5', label: '30 min' },
  { value: '1', label: '1 hour' },
  { value: '1.5', label: '1.5 hours' },
  { value: '2', label: '2 hours' },
  { value: '3', label: '3 hours' },
  { value: '4', label: '4 hours' },
  { value: '5', label: '5 hours' },
  { value: '6', label: '6 hours' },
  { value: '8', label: '8 hours' },
  { value: '10', label: '10 hours' },
  { value: '12', label: '12 hours' },
  { value: '16', label: '16 hours' },
  { value: '18', label: '18 hours' },
  { value: '24', label: '24 hours' },
]

export const DOWNTIME_DAY_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 day' },
  { value: '2', label: '2 days' },
  { value: '3', label: '3 days' },
  { value: '4', label: '4 days' },
  { value: '5', label: '5 days' },
  { value: '6', label: '6 days' },
  { value: '7', label: '7 days' },
  { value: '10', label: '10 days' },
  { value: '14', label: '14 days' },
  { value: '21', label: '21 days' },
  { value: '30', label: '30 days' },
]

export function downtimeToMinutes(unit: DowntimeUnit, value: string) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return unit === 'days' ? Math.round(n * 1440) : Math.round(n * 60)
}

export function minutesToDowntime(minutes: number | string | null | undefined): {
  unit: DowntimeUnit
  value: string
} {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  if (m <= 0) return { unit: 'hours', value: '0' }
  if (m >= 1440) {
    const days = m / 1440
    const snapped = snapTo(days, DOWNTIME_DAY_OPTIONS.map((o) => Number(o.value)))
    return { unit: 'days', value: String(snapped) }
  }
  const hours = m / 60
  const snapped = snapTo(hours, DOWNTIME_HOUR_OPTIONS.map((o) => Number(o.value)))
  return { unit: 'hours', value: String(snapped) }
}

function snapTo(n: number, options: number[]) {
  return options.reduce((best, cur) => (Math.abs(cur - n) < Math.abs(best - n) ? cur : best), options[0])
}

export function parsePhotoUrls(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0)
      }
    } catch {
      if (raw.startsWith('data:') || raw.startsWith('/') || raw.startsWith('http')) return [raw]
    }
  }
  return []
}

export function mediaUrl(src: string) {
  if (!src) return ''
  if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) return src
  const base = String(api.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '')
  return `${base}${src.startsWith('/') ? src : `/${src}`}`
}

export function toDatetimeLocalValue(raw?: string | Date | null) {
  if (!raw) return ''
  const d = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function toDateInputValue(raw?: string | Date | null) {
  if (!raw) return ''
  const d = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toTimeInputValue(raw?: string | Date | null) {
  if (!raw) return ''
  const d = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function combineDateAndTime(date: string, time: string) {
  if (!date) return ''
  const t = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '00:00'
  return `${date}T${t}`
}

export function minutesBetweenLocal(from: string, to: string) {
  if (!from || !to) return 0
  const a = new Date(from).getTime()
  const b = new Date(to).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 60_000)
}

export function minutesBetweenDateTimes(date: string, fromTime: string, toTime: string) {
  return minutesBetweenLocal(combineDateAndTime(date, fromTime), combineDateAndTime(date, toTime))
}

export async function compressImageFile(file: File, maxEdge = 2048, quality = 0.9): Promise<string> {
  const bitmap =
    'createImageBitmap' in window
      ? await createImageBitmap(file)
      : await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error('Could not read image'))
          img.src = URL.createObjectURL(file)
        })
  const width = 'width' in bitmap ? bitmap.width : (bitmap as HTMLImageElement).naturalWidth
  const height = 'height' in bitmap ? bitmap.height : (bitmap as HTMLImageElement).naturalHeight
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const alreadySmallJpeg =
    scale === 1 &&
    file.size <= 700_000 &&
    /jpe?g$/i.test(file.type)

  if (alreadySmallJpeg) {
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Could not read image'))
      reader.readAsDataURL(file)
    })
  }

  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process image')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

  const qualities = [quality, 0.86, 0.8]
  let best = canvas.toDataURL('image/jpeg', qualities[0])
  for (const q of qualities) {
    const next = canvas.toDataURL('image/jpeg', q)
    best = next
    const bytes = Math.ceil((next.length - 22) * 0.75)
    if (bytes <= 900_000) break
  }
  return best
}
