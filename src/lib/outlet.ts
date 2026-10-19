import type { AuthUser } from '@/lib/auth'

export type OutletRef = {
  id: number
  code: string
  name: string
  kind?: string | null
}

export function isOutletScoped(user: AuthUser | null | undefined) {
  return Boolean(user?.outletCustomerId && user.outlet?.code)
}

export function outletHomePath(user: AuthUser | null | undefined) {
  if (!isOutletScoped(user) || !user?.outlet?.code) return '/distributors'
  return `/distributors/${user.outlet.code}`
}

export function outletNavLabel(user: AuthUser | null | undefined) {
  if (!isOutletScoped(user)) return 'Distributors'
  return String(user?.outlet?.kind || '').toUpperCase() === 'SHOP' ? 'My shop' : 'My outlet'
}

/** Query params for unscoped admin viewing a specific shop. */
export function outletQuery(outletId?: number | null) {
  if (!outletId) return {}
  return { outletId }
}

export function shopBuyerPath(
  buyerId: number,
  outletId?: number | null,
  shopCode?: string | null,
) {
  const params = new URLSearchParams()
  if (outletId) params.set('outletId', String(outletId))
  if (shopCode) params.set('shopCode', shopCode)
  const q = params.toString()
  return q ? `/shop/customers/${buyerId}?${q}` : `/shop/customers/${buyerId}`
}

export function shopRecordSalePath(outletId?: number | null) {
  if (!outletId) return '/shop/sales/new'
  return `/shop/sales/new?outletId=${outletId}`
}

export function shopSalesListPath(outletId?: number | null, shopCode?: string | null) {
  const params = new URLSearchParams()
  if (outletId) params.set('outletId', String(outletId))
  if (shopCode) params.set('shopCode', shopCode)
  const q = params.toString()
  return q ? `/shop/sales?${q}` : '/shop/sales'
}

export function shopSalePath(saleNumber: string) {
  return `/shop/sales/${encodeURIComponent(saleNumber)}`
}

export function shopSaleInvoicePath(saleNumber: string) {
  return `/shop/sales/${encodeURIComponent(saleNumber)}/invoice`
}

export function shopSaleReceiptPath(saleNumber: string) {
  return `/shop/sales/${encodeURIComponent(saleNumber)}/receipt`
}
