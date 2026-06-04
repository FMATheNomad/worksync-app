export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  jabatan: string
  isActive: boolean
  subscriptionPlan: SubscriptionPlan
  subscriptionStatus: SubscriptionStatus
  createdAt: string
}

export interface Attendance {
  id: string
  userId: string
  userName: string
  checkInTime: string
  checkOutTime: string | null
  checkInLat: number
  checkInLng: number
  checkInAddress: string
  checkOutLat: number | null
  checkOutLng: number | null
  checkOutAddress: string | null
  selfieUrl: string | null
  status: 'on_time' | 'late' | 'absent'
  date: string
}

export interface Expense {
  id: string
  userId: string
  userName: string
  itemName: string
  amount: number
  category: string
  photoUrl: string | null
  description: string | null
  date: string
  createdAt: string
}

export interface DailyReport {
  id: string
  userId: string
  userName: string
  content: string
  status: 'draft' | 'submitted'
  date: string
  isAiGenerated: boolean
  createdAt: string
  updatedAt: string
}

export interface AIConversation {
  id: string
  role: 'user' | 'assistant'
  content: string
  contextType: 'report' | 'analytics'
  createdAt: string
}

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'inactive' | 'past_due' | 'canceled'
export type UserRole = 'admin' | 'employee'

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiError {
  message: string
  status: number
  errors?: Record<string, string[]>
}

export interface CheckInData {
  checkInLat: number
  checkInLng: number
  checkInAddress: string
  selfie?: File
}

export interface CheckOutData {
  checkOutLat: number
  checkOutLng: number
  checkOutAddress: string
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
  id: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
}
