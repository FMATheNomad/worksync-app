import api from './api'
import { API_ENDPOINTS } from '@/constants'
import type { Attendance } from '@/types'

export const attendanceService = {
  checkIn: async (lat: number, lng: number, selfieUrl?: string): Promise<Attendance> => {
    const { data } = await api.post<Attendance>(API_ENDPOINTS.ATTENDANCES.CHECK_IN, {
      lat, lng, selfie_url: selfieUrl || null,
    })
    return data
  },

  checkOut: async (lat: number, lng: number): Promise<Attendance> => {
    const { data } = await api.post<Attendance>(API_ENDPOINTS.ATTENDANCES.CHECK_OUT, { lat, lng })
    return data
  },

  getAttendances: async (params?: Record<string, any>): Promise<{ attendances: Attendance[]; total: number }> => {
    const { data } = await api.get(API_ENDPOINTS.ATTENDANCES.BASE, { params })
    return data
  },

  getAttendanceSummary: async (): Promise<{ date: string; total_employees: number; present: number; late: number; absent: number }> => {
    const { data } = await api.get(API_ENDPOINTS.ATTENDANCES.SUMMARY)
    return data
  },
}