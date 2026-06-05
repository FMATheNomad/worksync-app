import api from './api'
import { API_ENDPOINTS } from '@/constants'
import type { Expense } from '@/types'

interface ExpenseParams {
  page?: number
  limit?: number
  date?: string
  userId?: string
  category?: string
}

export const expenseService = {
  createExpense: async (data: Record<string, any>): Promise<Expense> => {
    const { data: response } = await api.post<Expense>(API_ENDPOINTS.EXPENSES.BASE, data)
    return response
  },

  getExpenses: async (params: ExpenseParams = {}): Promise<{ expenses: Expense[]; total: number }> => {
    const { data } = await api.get<{ expenses: Expense[]; total: number }>(API_ENDPOINTS.EXPENSES.BASE, { params })
    return data
  },

  getExpense: async (id: string): Promise<Expense> => {
    const { data } = await api.get<Expense>(`${API_ENDPOINTS.EXPENSES.BASE}/${id}`)
    return data
  },

  deleteExpense: async (id: string): Promise<void> => {
    await api.delete(`${API_ENDPOINTS.EXPENSES.BASE}/${id}`)
  },
}
