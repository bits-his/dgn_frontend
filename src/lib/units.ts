export function fmtDozenPcs(qty: number | null | undefined, perDozen?: number | null) {
  const pcsTotal = Math.round(Number(qty) || 0)
  const per = perDozenOf(perDozen)
  const dz = Math.floor(pcsTotal / per)
  const rem = pcsTotal % per
  if (dz === 0 && rem === 0) return '0 pcs'
  if (dz === 0) return `${rem} pcs`
  if (rem === 0) return `${dz} dz`
  return `${dz} dz · ${rem} pcs`
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
  const pcsTotal = Math.round(Number(qty) || 0)
  const per = perDozenOf(perDozen)
  const dz = Math.floor(pcsTotal / per)
  return `${dz} dz`
}

export function dozenCount(qty: number | null | undefined, perDozen?: number | null) {
  const pcsTotal = Math.round(Number(qty) || 0)
  const per = perDozenOf(perDozen)
  return Math.floor(pcsTotal / per)
}

export function pcsFromDozen(dozen: number | string, perDozen?: number | null) {
  const per = perDozenOf(perDozen)
  return Math.round((Number(dozen) || 0) * per)
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
  return fmtDozen(qty, perDozen)
}
