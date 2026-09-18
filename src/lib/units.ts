export function fmtDozenPcs(qty: number | null | undefined, perDozen = 12) {
  const pcsTotal = Math.round(Number(qty) || 0)
  const per = perDozen > 0 ? perDozen : 12
  const dz = Math.floor(pcsTotal / per)
  const rem = pcsTotal % per
  if (dz === 0 && rem === 0) return '0 pcs'
  if (dz === 0) return `${rem} pcs`
  if (rem === 0) return `${dz} dz`
  return `${dz} dz · ${rem} pcs`
}
