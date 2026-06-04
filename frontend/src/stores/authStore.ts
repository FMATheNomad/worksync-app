import { create } from 'zustand'
import type { User } from '@/types'
import { authService } from '@/services/authService'

interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  setUser: (user: User) => void
  setToken: (token: string | null) => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: localStorage.getItem('worksync_token'),
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const response = await authService.login(email, password)
    localStorage.setItem('worksync_token', response.access_token)
    localStorage.setItem('worksync_refresh_token', response.refresh_token)
    set({
      token: response.access_token,
      isAuthenticated: true,
      isLoading: false,
    })
    const user = await authService.getMe()
    set({ user })
  },

  logout: async () => {
    try {
      await authService.logout()
    } catch {
    } finally {
      localStorage.removeItem('worksync_token')
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  checkAuth: async () => {
    const token = get().token
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }
    try {
      const user = await authService.getMe()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('worksync_token')
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  setUser: (user: User) => set({ user }),

  setToken: (token: string | null) => {
    if (token) {
      localStorage.setItem('worksync_token', token)
    } else {
      localStorage.removeItem('worksync_token')
    }
    set({ token })
  },
}))
