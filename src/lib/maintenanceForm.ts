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
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => parsePhotoUrls(item)).filter(Boolean)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) || typeof parsed === 'string') {
        return parsePhotoUrls(parsed)
      }
    } catch {
      if (
        trimmed.startsWith('data:') ||
        trimmed.startsWith('/uploads/') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('blob:')
      ) {
        return [trimmed]
      }
    }
  }
  return []
}

export function mediaUrl(src: string) {
  if (!src) return ''
  if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http')) return src
  const base = String(api.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '')
  const path = src.startsWith('/') ? src : `/${src}`
  // Avoid /dgn_backend/dgn_backend/... if the stored path already includes the mount.
  if (base.endsWith('/dgn_backend') && path.startsWith('/dgn_backend/')) {
    return `${base.replace(/\/dgn_backend$/, '')}${path}`
  }
  return `${base}${path}`
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

const MAX_UPLOAD_BYTES = 450_000

function looksLikeImage(file: File) {
  const type = String(file.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  // iOS/Android sometimes omit MIME type for gallery HEIC/JPEG.
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name || '')
}

function isHeicFile(file: File) {
  const type = String(file.type || '').toLowerCase()
  if (type.includes('heic') || type.includes('heif')) return true
  return /\.(heic|heif)$/i.test(file.name || '')
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      if (!result.startsWith('data:')) reject(new Error('Could not read image'))
      else resolve(result)
    }
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

async function decodeWithHeic(file: File): Promise<Blob> {
  const { heicTo } = await import('heic-to')
  const result = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.86 })
  if (result instanceof Blob) return result
  return new Blob([result as BlobPart], { type: 'image/jpeg' })
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = src
  })
}

async function decodeToDrawable(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  let source: Blob = file
  if (isHeicFile(file)) {
    try {
      source = await decodeWithHeic(file)
    } catch {
      // Safari can often decode HEIC natively — fall through.
    }
  }

  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(source, { imageOrientation: 'from-image' })
    } catch {
      try {
        return await createImageBitmap(source)
      } catch {
        // fall through to <img>
      }
    }
  }

  const objectUrl = URL.createObjectURL(source)
  try {
    const img = await loadImageElement(objectUrl)
    return img
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function drawableSize(bitmap: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }) {
  const width = Number(bitmap.width || bitmap.naturalWidth || 0)
  const height = Number(bitmap.height || bitmap.naturalHeight || 0)
  return { width, height }
}

export async function compressImageFile(file: File, maxEdge = 1600, quality = 0.84): Promise<string> {
  if (!looksLikeImage(file)) {
    throw new Error('That file is not an image.')
  }

  const bitmap = await decodeToDrawable(file)
  const { width, height } = drawableSize(bitmap)
  if (!(width > 0 && height > 0)) {
    if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
      ;(bitmap as ImageBitmap).close()
    }
    throw new Error('Could not read that photo.')
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const alreadySmallJpeg =
    scale === 1 &&
    file.size <= MAX_UPLOAD_BYTES &&
    /jpe?g/i.test(file.type || file.name) &&
    !isHeicFile(file)

  if (alreadySmallJpeg) {
    if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
      ;(bitmap as ImageBitmap).close()
    }
    return readFileAsDataUrl(file)
  }

  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
      ;(bitmap as ImageBitmap).close()
    }
    throw new Error('Could not process image')
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
    ;(bitmap as ImageBitmap).close()
  }

  const qualities = [quality, 0.78, 0.7, 0.6, 0.5]
  let best = canvas.toDataURL('image/jpeg', qualities[0])
  for (const q of qualities) {
    const next = canvas.toDataURL('image/jpeg', q)
    best = next
    const bytes = Math.ceil((next.length - 22) * 0.75)
    if (bytes <= MAX_UPLOAD_BYTES) break
  }

  if (!best.startsWith('data:image/')) {
    throw new Error('Could not encode that photo.')
  }
  return best
}

export type PhotoUploadKind = 'scrap' | 'security' | 'maintenance'

/** Compress then upload one photo; returns a durable `/uploads/...` path. */
export async function uploadImageFile(file: File, kind: PhotoUploadKind = 'scrap'): Promise<string> {
  const dataUrl = await compressImageFile(file)
  const { data } = await api.post('/uploads/photos', { kind, photo: dataUrl })
  const url = data?.data?.url as string | undefined
  if (!url) throw new Error('Upload did not return a photo URL.')
  return url
}
