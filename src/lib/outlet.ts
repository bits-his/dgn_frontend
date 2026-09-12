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
