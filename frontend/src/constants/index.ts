/**
 * Application-wide constants: subscription plans, routes, API endpoints,
 * attendance rules, colors, and breakpoints.
 *
 * WHY THIS EXISTS: Single source of truth for configuration that both the
 * frontend and (via shared understanding) backend rely on. Prevents magic
 * strings scattered across components.
 *
 * SUBSCRIPTION PLAN ARCHITECTURE:
 *   Plans are defined as a Record<SubscriptionPlan, Plan> where each plan
 *   has features, limits, and pricing. This drives:
 *     1. The pricing page display.
 *     2. Feature-gating UI (hiding premium features for free users).
 *     3. Route protection and component rendering.
 *
 *   WHY define plans in constants (not fetched from backend):
 *     - Fast: No API call needed to render the landing page.
 *     - Reliable: Works offline and during backend maintenance.
 *     - Single source: Both frontend gating and backend enforcement use
 *       the same plan structure (backend mirrors in utils/constants.py).
 *
 *   TRADE-OFF: Plans must be updated in both frontend and backend when
 *   changing features/pricing. A future improvement would be a shared
 *   package or API endpoint that serves plan definitions.
 *
 *   PRICING MODEL:
 *     - Free: $0, 5 employees, no AI/export.
 *     - Pro: $9/month ($86/year), 50 employees, AI + export + priority support.
 *     - Enterprise: $29/month ($278/year), unlimited, everything + branding + dedicated support.
 *     Yearly pricing gives ~20% discount (one month free).
 *
 * ROUTE DESIGN:
 *   ROUTES object defines every frontend route as a constant. WHY:
 *     - Prevents typos in navigate() calls.
 *     - Makes route changes in one place.
 *     - Enforces the admin/employee route separation pattern.
 *
 *   Admin routes: /admin/dashboard, /admin/monitoring, /admin/employees, etc.
 *   Employee routes: /employee/dashboard, /employee/attendance, /employee/expenses, etc.
 *   This separation is enforced by ProtectedRoute (see ProtectedRoute.tsx).
 *
 * API ENDPOINTS:
 *   Mirrors the backend route structure for consistency. The actual base URL
 *   is configured in api.ts (via VITE_API_BASE_URL env var).
 *
 * ATTENDANCE CONSTANTS:
 *   - LATE_CUTOFF_HOUR/MINUTE: 10:00 AM WIB (matches backend default).
 *   - RADIUS_LIMIT_METERS: 100m — reserved for future geofencing feature.
 *   - MAX_SELFIE_SIZE: 5MB — Cloudinary free tier limit is 10MB; 5MB is
 *     a conservative frontend limit to reduce upload time.
 *   - ALLOWED_SELFIE_TYPES: jpeg, png, webp — widely supported formats.
 *     AVIF and HEIC excluded due to inconsistent browser support.
 */

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
  MAX_SELFIE_SIZE: 5 * 1024 * 1024, // 5MB in bytes
  ALLOWED_SELFIE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
}

// Indigo-based color palette for the Worksync brand.
// Generated from Tailwind CSS indigo palette.
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

// Standard responsive breakpoints matching Tailwind defaults.
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const
