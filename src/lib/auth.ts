export type AuthUser = {
  id: number
  firstname: string
  lastname: string
  username: string
  email: string
  roleCode: string
  employeeId?: number | null
  menuAccess?: string[]
  permissions: string[]
}

const TOKEN_KEY = 'dgn_token'
const USER_KEY = 'dgn_user'

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function storeSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function hasPermission(user: AuthUser | null, permission: string) {
  return Boolean(user?.permissions?.includes(permission))
}
