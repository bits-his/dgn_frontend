/** Short factory labels for bought / in-process plastic — not the masters material name. */

export type InboundForm = 'RAW' | 'CRUSHED' | 'RECYCLED' | string | null | undefined

const BUY_LABELS: Record<string, string> = {
  RAW: 'Raw scrap',
  CRUSHED: 'Crushed scrap',
  RECYCLED: 'Recycled',
}

const TYPE_LABELS: Record<string, string> = {
  SCRAP: 'Raw scrap',
  SORT: 'Sorted scrap',
  CRUSH: 'Crushed scrap',
  WASH: 'Washed scrap',
  DRY: 'Store-ready scrap',
  DAMAGED: 'Damaged (re-crush)',
  RECYCLE: 'Recycled',
  MIX: 'Mix',
  LOT: 'In process',
  PROD: 'Finished goods',
}

/** Bought-as label used on scrap buying and batch lists. */
export function boughtAsLabel(inboundForm?: InboundForm): string {
  const form = String(inboundForm || 'RAW').toUpperCase()
  return BUY_LABELS[form] || 'Raw scrap'
}

/**
 * Display name for material on batches / process / store pages.
 * Prefers buy form, then batch type — never the long masters name like "Mixed Plastic Scrap".
 */
export function materialKindLabel(opts: {
  inboundForm?: InboundForm
  batchType?: string | null
  materialName?: string | null
  productName?: string | null
}): string {
  if (opts.productName) return opts.productName

  const form = opts.inboundForm ? String(opts.inboundForm).toUpperCase() : ''
  if (form && BUY_LABELS[form]) return BUY_LABELS[form]

  const type = String(opts.batchType || '').toUpperCase()
  if (type && TYPE_LABELS[type]) return TYPE_LABELS[type]

  const name = String(opts.materialName || '').trim()
  if (!name) return 'Material'
  const lower = name.toLowerCase()
  if (lower.includes('recycl')) return 'Recycled'
  if (lower.includes('crush')) return 'Crushed scrap'
  if (lower.includes('wash')) return 'Washed scrap'
  if (lower.includes('scrap') || lower.includes('plastic') || lower.includes('mixed')) {
    return 'Raw scrap'
  }
  return name
}

export function boughtAsBadgeClass(inboundForm?: InboundForm): string {
  const form = String(inboundForm || 'RAW').toUpperCase()
  if (form === 'RECYCLED') return 'bg-emerald-50 text-emerald-800 border-emerald-300'
  if (form === 'CRUSHED') return 'bg-indigo-50 text-indigo-800 border-indigo-300'
  return 'bg-amber-50 text-amber-800 border-amber-300'
}
