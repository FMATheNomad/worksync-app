import api from './api'
import { API_ENDPOINTS } from '@/constants'
import type { AIConversation } from '@/types'

export const aiService = {
  generateReport: async (userMessage: string): Promise<{ report_content: string }> => {
    const { data } = await api.post(API_ENDPOINTS.AI.GENERATE_REPORT, { user_message: userMessage })
    return data
  },

  askAnalytics: async (question: string): Promise<{ answer: string }> => {
    const { data } = await api.post(API_ENDPOINTS.AI.ANALYTICS, { question })
    return data
  },

  getConversations: async (): Promise<{ conversations: AIConversation[]; total: number }> => {
    const { data } = await api.get(API_ENDPOINTS.AI.CONVERSATIONS)
    return data
  },
}
