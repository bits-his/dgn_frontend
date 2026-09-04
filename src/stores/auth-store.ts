import { create } from 'zustand'
import {
  type AuthUser,
  clearSession,
  getStoredToken,
  getStoredUser,
  storeSession,
} from '@/lib/auth'
import { api } from '@/lib/api'

type AuthState = {
  user: AuthUser | null
  token: string | null
  hydrated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,
  hydrate: () => {
    set({
      user: getStoredUser(),
      token: getStoredToken(),
      hydrated: true,
    })
  },
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    storeSession(data.token, data.user)
    set({ user: data.user, token: data.token })
  },
  logout: () => {
    clearSession()
    set({ user: null, token: null })
  },
}))
