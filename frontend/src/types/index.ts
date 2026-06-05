export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  jabatan: string | null
  is_active: boolean
  subscription_plan: SubscriptionPlan
  subscription_status: SubscriptionStatus
  created_at: string
}

export interface Attendance {
  id: string
  user_id: string
  user_name: string | null
  check_in_time: string
  check_out_time: string | null
  check_in_lat: number
  check_in_lng: number
  check_in_address: string | null
  check_out_lat: number | null
  check_out_lng: number | null
  check_out_address: string | null
  selfie_url: string | null
  status: string
  created_at: string
}

export interface Expense {
  id: string
  user_id: string
  user_name: string | null
  item_name: string
  amount: number
  category: string
  photo_url: string | null
  description: string | null
  date: string
  created_at: string
}

export interface DailyReport {
  id: string
  user_id: string
  user_name: string | null
  content: string
  status: string
  date: string
  is_ai_generated: boolean
  created_at: string
  updated_at: string
}

export interface AIConversation {
  id: string
  role: string
  content: string
  context_type: string | null
  created_at: string
}

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'inactive' | 'past_due' | 'canceled'
export type UserRole = 'admin' | 'employee'

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface ApiError {
  message: string
  status: number
  errors?: Record<string, string[]>
}

export interface PlanFeatures {
  users: number
  aiAssistant: boolean
  exportExcel: boolean
  unlimitedEmployees: boolean
  prioritySupport: boolean
  customBranding: boolean
}

export interface Plan {
  id: SubscriptionPlan
  name: string
  price: number
  yearlyPrice: number
  interval: 'month' | 'year'
  features: PlanFeatures
  limits: {
    maxUsers: number
  }
}

export interface Subscription {
  plan: string
  status: string
  features: string[]
}