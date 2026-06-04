import api from './api'
import { API_ENDPOINTS } from '@/constants'

export const billingService = {
  createCheckout: async (priceId: string): Promise<{ checkout_url: string }> => {
    const { data } = await api.post(API_ENDPOINTS.BILLING.CHECKOUT, { price_id: priceId, success_url: window.location.origin + '/admin/billing' })
    return data
  },

  getSubscription: async (): Promise<{ plan: string; status: string; features: string[] }> => {
    const { data } = await api.get(API_ENDPOINTS.BILLING.SUBSCRIPTION)
    return data
  },

  getPlans: async (): Promise<{ plans: { name: string; max_employees: number; features: string[] }[] }> => {
    const { data } = await api.get(API_ENDPOINTS.BILLING.PLANS)
    return data
  },
}
