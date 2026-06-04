import api from './api'
import { API_ENDPOINTS } from '@/constants'
import type { DailyReport, PaginatedResponse } from '@/types'

interface ReportParams {
  page?: number
  limit?: number
  date?: string
  userId?: string
  status?: string
}

export const reportService = {
  createReport: async (data: { content: string; isAiGenerated?: boolean }): Promise<DailyReport> => {
    const { data: response } = await api.post<DailyReport>(API_ENDPOINTS.REPORTS.BASE, data)
    return response
  },

  getReports: async (params: ReportParams = {}): Promise<PaginatedResponse<DailyReport>> => {
    const { data } = await api.get<PaginatedResponse<DailyReport>>(API_ENDPOINTS.REPORTS.BASE, { params })
    return data
  },

  getReport: async (id: string): Promise<DailyReport> => {
    const { data } = await api.get<DailyReport>(`${API_ENDPOINTS.REPORTS.BASE}/${id}`)
    return data
  },

  updateReport: async (id: string, data: { content?: string; status?: 'draft' | 'submitted' }): Promise<DailyReport> => {
    const { data: response } = await api.patch<DailyReport>(`${API_ENDPOINTS.REPORTS.BASE}/${id}`, data)
    return response
  },
}
