/** Material types shown on Scrap buying. */
export const MATERIAL_BUY_TYPES = [
  { code: 'MAT-SCRAP', name: 'Scrap', category: 'SCRAP' },
  { code: 'MAT-WASHED-FLAKES', name: 'Washed flakes', category: 'WASHED_FLAKES' },
  { code: 'MAT-DRIED', name: 'Dried material', category: 'DRIED' },
  { code: 'MAT-PROCESSED', name: 'Processed/recycled material', category: 'PROCESSED' },
  { code: 'MAT-PURCHASED', name: 'Purchased material', category: 'PURCHASED' },
] as const

export const MATERIAL_CATEGORIES = MATERIAL_BUY_TYPES.map((item) => ({
  value: item.category,
  label: item.name,
}))
