/** Shared date-range presets for ops dashboards and work pages. */

export const DATE_RANGE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_year', label: 'Year to date' },
  { id: 'custom', label: 'Custom' },
] as const

export type DateRangePresetId = (typeof DATE_RANGE_OPTIONS)[number]['id']

export type DateRangeState = {
  rangePreset: string
  /** ISO YYYY-MM-DD when custom */
  from?: string
  /** ISO YYYY-MM-DD when custom */
  to?: string
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Local calendar date → YYYY-MM-DD */
export function toIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function monthStartIso(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-01`
}

/** YYYY-MM-DD → YYMMDD for API */
export function isoToBiz(iso?: string | null) {
  if (!iso) return null
  const m = String(iso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return `${m[1].slice(2)}${m[2]}${m[3]}`
}

/** YYMMDD → YYYY-MM-DD */
export function bizToIso(biz?: string | null) {
  if (!biz || String(biz).length !== 6) return null
  const raw = String(biz)
  const yy = Number(raw.slice(0, 2))
  const mm = raw.slice(2, 4)
  const dd = raw.slice(4, 6)
  if (!yy || !mm || !dd) return null
  return `${2000 + yy}-${mm}-${dd}`
}

export function defaultCustomRange(): { from: string; to: string } {
  return { from: monthStartIso(), to: toIsoDate() }
}

/** Params to send to APIs that use resolveDashboardRange */
export function dateRangeApiParams(state: DateRangeState): {
  rangePreset: string
  from?: string
  to?: string
} {
  if (state.rangePreset === 'custom') {
    const from = isoToBiz(state.from)
    const to = isoToBiz(state.to)
    if (from && to) return { rangePreset: 'custom', from, to }
    // Incomplete custom → fall back to this month until both dates are set
    return { rangePreset: 'this_month' }
  }
  return { rangePreset: state.rangePreset || 'this_month' }
}

export function dateRangeLabel(
  state: DateRangeState,
  serverLabel?: string | null,
): string {
  if (serverLabel) return serverLabel
  if (state.rangePreset === 'custom' && state.from && state.to) {
    const a = new Date(state.from)
    const b = new Date(state.to)
    if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
      const fmt = (d: Date) =>
        d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      return state.from === state.to ? fmt(a) : `${fmt(a)} – ${fmt(b)}`
    }
  }
  return (
    DATE_RANGE_OPTIONS.find((o) => o.id === state.rangePreset)?.label || 'This month'
  )
}
