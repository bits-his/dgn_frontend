/** Absolute URL encoded into store-batch QR codes (phone camera → verify page). */
export function batchVerifyUrl(batchNumber: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : ''
  return `${origin}/v/${encodeURIComponent(batchNumber)}`
}

export type PublicBatchLabel = {
  ok: boolean
  batchNumber: string
  businessDate?: string | null
  date?: string | null
  batchType?: string | null
  stage?: string | null
  materialName?: string | null
  location?: { code?: string; name?: string } | null
  qtyRemaining?: number
  usableKg?: number
  wasteKg?: number
  colors: Array<{ color: string | null; colorName: string | null; qtyKg: number }>
  verifiedAt?: string
}
