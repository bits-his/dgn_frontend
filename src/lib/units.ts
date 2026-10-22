/**
 * Whole pieces for dz/pcs display. Truncate — never Math.round —
 * so 220.6 stays 220 (18 dz · 4 pcs), not 221 (18 dz · 5 pcs).
 */
export function toWholePcs(qty: number | null | undefined) {
  const n = Number(qty)
  if (!Number.isFinite(n) || n === 0) return 0
  // Tiny epsilon clears float dust (219.999999 → 220) without rounding up real fractions
  return Math.trunc(n + (n >= 0 ? 1e-9 : -1e-9))
}

export function fmtDozenPcs(qty: number | null | undefined, perDozen?: number | null) {
  const pcsTotal = toWholePcs(qty)
  const per = perDozenOf(perDozen)
  const dz = Math.floor(pcsTotal / per)
  const rem = pcsTotal % per
  const pcUnit = rem === 1 ? 'pc' : 'pcs'
  if (dz === 0 && rem === 0) return '0 pc'
  if (dz === 0) return `${rem} ${pcUnit}`
  if (rem === 0) return `${dz} dz`
  return `${dz} dz · ${rem} ${pcUnit}`
}

export function perDozenOf(value?: number | string | null) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 12
}

export function isPieceUom(uom?: string | null) {
  const u = String(uom || 'pcs').toLowerCase()
  return u === 'pcs' || u === 'pc' || u === 'unit' || u === 'units' || u === 'piece' || u === 'pieces'
}

export function fmtDozen(qty: number | null | undefined, perDozen?: number | null) {
  const pcsTotal = toWholePcs(qty)
  const per = perDozenOf(perDozen)
  const dz = Math.floor(pcsTotal / per)
  return `${dz} dz`
}

export function dozenCount(qty: number | null | undefined, perDozen?: number | null) {
  const pcsTotal = toWholePcs(qty)
  const per = perDozenOf(perDozen)
  return Math.floor(pcsTotal / per)
}

export function pcsFromDozen(dozen: number | string, perDozen?: number | null) {
  const per = perDozenOf(perDozen)
  return toWholePcs((Number(dozen) || 0) * per)
}

export function dozenPriceFromUnit(unitPrice: number, perDozen?: number | null) {
  const per = perDozenOf(perDozen)
  if (!(unitPrice > 0) || !(per > 0)) return 0
  return +(unitPrice * per).toFixed(2)
}

export function unitPriceFromDozen(pricePerDozen: number, perDozen?: number | null) {
  const per = perDozenOf(perDozen)
  if (!(pricePerDozen > 0) || !(per > 0)) return 0
  return +(pricePerDozen / per).toFixed(2)
}

export function qtyDozenLabel(
  qty: number | null | undefined,
  uom?: string | null,
  perDozen?: number | null,
) {
  if (!isPieceUom(uom)) {
    const n = Number(qty) || 0
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${uom || ''}`.trim()
  }
  return fmtDozenPcs(qty, perDozen)
}

