import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import type { ApiError } from '@/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      const apiError: ApiError = {
        message: error.response?.data?.message || error.message || 'An unexpected error occurred',
        status: error.response?.status || 500,
        errors: error.response?.data?.errors,
      }
      return Promise.reject(apiError)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`
        }
        return api(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const refreshToken = localStorage.getItem('worksync_refresh_token')
      if (!refreshToken) throw new Error('No refresh token')

      const response = await axios.post(
        `${api.defaults.baseURL}/auth/refresh`,
        { refresh_token: refreshToken }
      )

      const { access_token: newToken } = response.data
      localStorage.setItem('worksync_refresh_token', response.data.refresh_token)
      useAuthStore.getState().setToken(newToken)

      processQueue(null, newToken)

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
      }
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      useAuthStore.getState().logout()
      const apiError: ApiError = {
        message: 'Session expired. Please login again.',
        status: 401,
      }
      return Promise.reject(apiError)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
