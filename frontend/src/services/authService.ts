import api from './api'
import { API_ENDPOINTS } from '@/constants'
import type { User } from '@/types'

interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export const authService = {
  login: async (email: string, password: string): Promise<TokenResponse> => {
    const { data } = await api.post<TokenResponse>(API_ENDPOINTS.AUTH.LOGIN, { email, password })
    return data
  },

  refreshToken: async (refresh_token: string): Promise<TokenResponse> => {
    const { data } = await api.post<TokenResponse>(API_ENDPOINTS.AUTH.REFRESH, { refresh_token })
    return data
  },

  logout: async (): Promise<void> => {
    await api.post(API_ENDPOINTS.AUTH.LOGOUT)
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get<User>(API_ENDPOINTS.AUTH.ME)
    return data
  },
}
