/**
 * Zustand store for authentication state management.
 *
 * WHY THIS EXISTS: Centralizes all auth-related state (user, token, auth status)
 * so that any component can access the current user without prop drilling.
 * Uses Zustand (not Redux) for simplicity — single-store architecture is
 * adequate for this application's scale.
 *
 * LOCALSTORAGE VS. COOKIE DECISION:
 *   Access token: Stored in memory (Zustand state) only.
 *     - More secure: XSS cannot read in-memory state (unless the attacker
 *       has access to the JS runtime, at which point all bets are off).
 *     - Trade-off: Lost on page refresh. CheckAuth re-fetches on load.
 *   Refresh token: Stored in localStorage.
 *     - Survives page refresh for silent re-authentication.
 *     - Less secure than httpOnly cookies (accessible to any JS).
 *     - WHY not httpOnly cookies: Would require the backend to set cookies,
 *       adding CSRF concerns and complicating the API architecture.
 *       For an MVP, localStorage is acceptable.
 *
 *   In a highly sensitive environment, the ideal approach is:
 *     - Access token: memory (as-is).
 *     - Refresh token: httpOnly secure cookie (set by backend).
 *     This requires backend changes to set cookies and handle CSRF.
 *
 * TOKEN LIFECYCLE:
 *   login()  → stores access token in memory, refresh token in localStorage.
 *   logout() → calls /auth/logout (revokes access token), clears all storage.
 *   checkAuth() → on page load, reads token from memory (or null), tries /auth/me.
 *   setToken() → called by api.ts interceptor after successful refresh.
 *
 *   The token itself is a JWT that expires in 30 minutes (access) or 7 days (refresh).
 *   The frontend doesn't decode the JWT — it relies on server-side validation
 *   via /auth/me and the 401 interceptor in api.ts.
 */

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
  // Initialize token from localStorage (survives page refresh).
  // user is NOT restored from localStorage — must re-fetch via /auth/me.
  user: null,
  token: localStorage.getItem('worksync_token'),
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const response = await authService.login(email, password)
    // Access token goes to memory + localStorage (localStorage enables
    // the interceptor to retry on page load before checkAuth completes).
    localStorage.setItem('worksync_token', response.access_token)
    // Refresh token goes to localStorage only (used by api.ts interceptor).
    localStorage.setItem('worksync_refresh_token', response.refresh_token)
    set({
      token: response.access_token,
      isAuthenticated: true,
      isLoading: false,
    })
    // Fetch user profile after successful login.
    const user = await authService.getMe()
    set({ user })
  },

  logout: async () => {
    try {
      // Best-effort: revoke token server-side.
      await authService.logout()
    } catch {
      // Even if server call fails, clear local state.
    } finally {
      localStorage.removeItem('worksync_token')
      // Note: we do NOT remove worksync_refresh_token here — the interceptor
      // will clear it if a refresh attempt fails. If we cleared it here,
      // a concurrent in-flight refresh could cause issues.
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  checkAuth: async () => {
    /**
     * Called on app mount (from App.tsx or Router). Tries to verify the
     * existing token by calling /auth/me.
     *
     * If the token is expired, /auth/me returns 401, the interceptor
     * attempts refresh, and if that also fails, we land in the catch block
     * and clear auth state.
     */
    const token = get().token
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }
    try {
      const user = await authService.getMe()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      // Token invalid or refresh failed — clear state.
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
    /**
     * Called by the api.ts interceptor after a successful token refresh.
     * Updates both memory and localStorage.
     *
     * WHY update localStorage: So that a page refresh immediately after
     * a token refresh doesn't lose the new token.
     */
    if (token) {
      localStorage.setItem('worksync_token', token)
    } else {
      localStorage.removeItem('worksync_token')
    }
    set({ token })
  },
}))
