/**
 * Axios HTTP client with interceptors for auth token management and
 * automatic refresh token rotation.
 *
 * WHY THIS EXISTS: Every authenticated API request needs a Bearer token
 * in the Authorization header. This module centralizes that logic so that
 * individual API service modules don't need to manage tokens themselves.
 *
 * INTERCEPTOR DESIGN:
 *   Request interceptor:
 *     - Reads the current access token from Zustand store (authStore).
 *     - Attaches it as Bearer token to every outgoing request.
 *     - This is stateless — the store is the single source of truth for tokens.
 *
 *   Response interceptor:
 *     - On 401 responses, attempts automatic token refresh before retrying.
 *     - Uses a queue pattern to prevent multiple simultaneous refresh attempts.
 *     - If refresh fails, logs the user out and rejects with a session-expired error.
 *
 * TOKEN REFRESH QUEUE:
 *   When multiple API calls fail simultaneously with 401 (e.g., page load with
 *   multiple data fetches), we don't want N concurrent refresh requests.
 *   Instead:
 *     1. First 401 triggers the refresh. Sets isRefreshing=true.
 *     2. Subsequent 401s (while isRefreshing=true) add their promises to a queue.
 *     3. When refresh completes, the queue is drained — all queued requests
 *        retry with the new token.
 *     4. If refresh fails, all queued requests are rejected and the user is logged out.
 *
 *   This is a well-known pattern from axios documentation and is widely used
 *   in production React applications.
 *
 * ERROR HANDLING STRATEGY:
 *   Non-401 errors are wrapped in an ApiError interface and rejected immediately.
 *   401 errors trigger the refresh flow (described above).
 *   Network errors (no response) are caught as generic 500 ApiErrors.
 *   The final error shape is consistent: { message, status, errors? }.
 *
 * WHY localStorage for refresh token:
 *   The refresh token needs to persist across page reloads. The access token
 *   is stored in Zustand (memory) for security — it's wiped on tab close.
 *   The refresh token in localStorage allows silent re-auth on page reload.
 *   See authStore.ts for the full discussion of this trade-off.
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import type { ApiError } from '@/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// --- Request interceptor: Attach Bearer token ---
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

// --- Token refresh queue state ---
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

// --- Response interceptor: Auto-refresh on 401 ---
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config

    // If not a 401, or already retried, reject immediately.
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      const apiError: ApiError = {
        message: error.response?.data?.message || error.message || 'An unexpected error occurred',
        status: error.response?.status || 500,
        errors: error.response?.data?.errors,
      }
      return Promise.reject(apiError)
    }

    // If a refresh is already in progress, queue this request.
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

    // First 401 — attempt refresh.
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
      // Update both localStorage (refresh) and store (access).
      localStorage.setItem('worksync_refresh_token', response.data.refresh_token)
      useAuthStore.getState().setToken(newToken)

      // Retry all queued requests with the new token.
      processQueue(null, newToken)

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
      }
      return api(originalRequest)
    } catch (refreshError) {
      // Refresh failed — reject all queued requests and force logout.
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
