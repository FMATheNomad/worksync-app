import api from './api'
import { API_ENDPOINTS } from '@/constants'
import type { Attendance, CheckInData, CheckOutData, PaginatedResponse } from '@/types'

interface AttendanceParams {
  page?: number
  limit?: number
  date?: string
  userId?: string
  status?: string
}

export const attendanceService = {
  checkIn: async (data: CheckInData): Promise<Attendance> => {
    const formData = new FormData()
    formData.append('checkInLat', String(data.checkInLat))
    formData.append('checkInLng', String(data.checkInLng))
    formData.append('checkInAddress', data.checkInAddress)
    if (data.selfie) {
      formData.append('selfie', data.selfie)
    }
    const { data: response } = await api.post<Attendance>(API_ENDPOINTS.ATTENDANCES.CHECK_IN, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response
  },

  checkOut: async (data: CheckOutData): Promise<Attendance> => {
    const { data: response } = await api.post<Attendance>(API_ENDPOINTS.ATTENDANCES.CHECK_OUT, data)
    return response
  },

  getAttendances: async (params: AttendanceParams = {}): Promise<PaginatedResponse<Attendance>> => {
    const { data } = await api.get<PaginatedResponse<Attendance>>(API_ENDPOINTS.ATTENDANCES.BASE, { params })
    return data
  },

  getAttendanceSummary: async (): Promise<{ total: number; onTime: number; late: number; absent: number }> => {
    const { data } = await api.get(API_ENDPOINTS.ATTENDANCES.SUMMARY)
    return data
  },
}
