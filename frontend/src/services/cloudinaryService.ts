import api from './api'
import { API_ENDPOINTS } from '@/constants'

export const cloudinaryService = {
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post<{ url: string }>(API_ENDPOINTS.CLOUDINARY.UPLOAD, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.url
  },
}
