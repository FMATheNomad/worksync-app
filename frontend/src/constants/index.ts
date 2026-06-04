import type { Plan, SubscriptionPlan } from '@/types'

export const APP_NAME = 'Worksync'

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    interval: 'month',
    features: {
      users: 5,
      aiAssistant: false,
      exportExcel: false,
      unlimitedEmployees: false,
      prioritySupport: false,
      customBranding: false,
    },
    limits: {
      maxUsers: 5,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 900,
    yearlyPrice: 8640,
    interval: 'month',
    features: {
      users: 50,
      aiAssistant: true,
      exportExcel: true,
      unlimitedEmployees: false,
      prioritySupport: true,
      customBranding: false,
    },
    limits: {
      maxUsers: 50,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 2900,
    yearlyPrice: 27840,
    interval: 'month',
    features: {
      users: 999999,
      aiAssistant: true,
      exportExcel: true,
      unlimitedEmployees: true,
      prioritySupport: true,
      customBranding: true,
    },
    limits: {
      maxUsers: 999999,
    },
  },
}

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    MONITORING: '/admin/monitoring',
    EMPLOYEES: '/admin/employees',
    NOTIFICATIONS: '/admin/notifications',
    AI_ANALYTICS: '/admin/ai-analytics',
    BILLING: '/admin/billing',
  },
  EMPLOYEE: {
    DASHBOARD: '/employee/dashboard',
    ATTENDANCE: '/employee/attendance',
    EXPENSES: '/employee/expenses',
    REPORTS: '/employee/reports',
    AI_ASSISTANT: '/employee/ai-assistant',
  },
  API_DOCS: '/api-docs',
} as const

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
  },
  ATTENDANCES: {
    BASE: '/attendances',
    CHECK_IN: '/attendances/check-in',
    CHECK_OUT: '/attendances/check-out',
    SUMMARY: '/attendances/summary',
  },
  EXPENSES: {
    BASE: '/expenses',
  },
  REPORTS: {
    BASE: '/reports',
  },
  AI: {
    GENERATE_REPORT: '/ai/generate-report',
    ASK_ANALYTICS: '/ai/ask-analytics',
    CONVERSATIONS: '/ai/conversations',
  },
  BILLING: {
    CHECKOUT: '/billing/create-checkout',
    SUBSCRIPTION: '/billing/subscription',
    PLANS: '/billing/plans',
  },
  CLOUDINARY: {
    UPLOAD: '/cloudinary/upload',
  },
  EMPLOYEES: {
    BASE: '/employees',
  },
}

export const ABSENSI_CONSTANTS = {
  LATE_CUTOFF_HOUR: 10,
  LATE_CUTOFF_MINUTE: 0,
  RADIUS_LIMIT_METERS: 100,
  MAX_SELFIE_SIZE: 5 * 1024 * 1024,
  ALLOWED_SELFIE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
}

export const COLORS = {
  worksync: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  accent: {
    400: '#4ade80',
    500: '#22c55e',
  },
} as const

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const
