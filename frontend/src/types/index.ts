/**
 * TypeScript type definitions for the entire application.
 *
 * WHY THIS EXISTS: Defines the shape of all data flowing between frontend
 * and backend. These types ensure type safety across the entire application —
 * from API responses to component props to store state.
 *
 * WHY SNAKE_CASE CONVENTION:
 *   The backend API uses snake_case for field names (Python convention).
 *   The frontend uses snake_case to match, avoiding client-side renaming.
 *   Alternative: camelCase in frontend with transformation layer.
 *   Decision: Direct snake_case mapping is simpler and causes fewer bugs
 *   than maintaining a dual-naming system. The React components use these
 *   types directly without renaming.
 *
 *   TRADE-OFF: JavaScript/TypeScript convention is camelCase. snake_case
 *   feels slightly less idiomatic in frontend code. However, the complexity
 *   of a transform layer (e.g., camelcase-keys) outweighs the aesthetic benefit.
 *
 * INTERFACE DESIGN CHOICES:
 *   - All IDs are strings (not User extends object): The backend sends UUIDs
 *     as strings. Using string here avoids type casting at component boundaries.
 *   - Dates are strings (not Date objects): API returns ISO 8601 strings.
 *     Components format dates with date-fns as needed. Parsing to Date on
 *     every API response would be wasteful and error-prone.
 *   - Nullable fields match the backend schema: User.jabatan, Attendance.check_out_time,
 *     etc. are nullable because the backend can return null for these fields.
 *   - Union types for enums: SubscriptionPlan, SubscriptionStatus, UserRole
 *     are string unions rather than enums. This allows direct assignment from
 *     API responses without conversion.
 *   - ApiError.message: The union `error.response?.data?.message || error.message`
 *     ensures we always have a user-readable error message, whether the backend
 *     sent a structured error or the request failed at the network level.
 *
 * PLANFEATURES DESIGN:
 *   Mirror of the backend's subscription feature set. Boolean flags map to
 *   premium features:
 *     - aiAssistant: DeepSeek AI report generation and analytics.
 *     - exportExcel: Excel data export functionality.
 *     - unlimitedEmployees: No cap on team size.
 *     - prioritySupport: SLA-backed support.
 *     - customBranding: White-label options.
 *   These are display-only — actual enforcement is server-side.
 */

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
