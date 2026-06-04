import { useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const { user, isAuthenticated, isLoading, token } = useAuthStore()

  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const checkAuth = useAuthStore((state) => state.checkAuth)

  const handleLogin = useCallback(async (email: string, password: string) => {
    await login(email, password)
  }, [login])

  const handleLogout = useCallback(async () => {
    await logout()
  }, [logout])

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
    checkAuth,
  }
}
