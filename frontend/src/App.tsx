import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ROUTES } from '@/constants'
import { ProtectedRoute } from '@/pages/auth/ProtectedRoute'
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/auth/LoginPage'
import { AdminLayout } from '@/layouts/AdminLayout'
import { EmployeeLayout } from '@/layouts/EmployeeLayout'
import AdminDashboardPage from '@/pages/admin/DashboardPage'
import MonitoringPage from '@/pages/admin/MonitoringPage'
import EmployeeManagementPage from '@/pages/admin/EmployeeManagementPage'
import NotificationsPage from '@/pages/admin/NotificationsPage'
import AIAnalyticsPage from '@/pages/admin/AIAnalyticsPage'
import BillingPage from '@/pages/admin/BillingPage'
import EmployeeDashboardPage from '@/pages/employee/DashboardPage'
import AttendancePage from '@/pages/employee/AttendancePage'
import ExpensesPage from '@/pages/employee/ExpensesPage'
import DailyReportPage from '@/pages/employee/DailyReportPage'
import AIAssistantPage from '@/pages/employee/AIAssistantPage'
import { ToastProvider, ToastViewport, useToast } from '@/components/ui/toast'

function ToastContainer() {
  const { toasts } = useToast()
  return (
    <>
      {toasts.map((t) => (
        <div key={t.id} className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-lg">
          {t.title && <p className="text-sm font-semibold text-text-primary">{t.title}</p>}
          {t.description && <p className="text-sm text-text-secondary">{t.description}</p>}
        </div>
      ))}
    </>
  )
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (token) {
      checkAuth()
    } else {
      useAuthStore.getState().isLoading = false
    }
  }, [])

  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<AdminLayout />}>
            <Route path={ROUTES.ADMIN.DASHBOARD} element={<AdminDashboardPage />} />
            <Route path={ROUTES.ADMIN.MONITORING} element={<MonitoringPage />} />
            <Route path={ROUTES.ADMIN.EMPLOYEES} element={<EmployeeManagementPage />} />
            <Route path={ROUTES.ADMIN.NOTIFICATIONS} element={<NotificationsPage />} />
            <Route path={ROUTES.ADMIN.AI_ANALYTICS} element={<AIAnalyticsPage />} />
            <Route path={ROUTES.ADMIN.BILLING} element={<BillingPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['employee']} />}>
          <Route element={<EmployeeLayout />}>
            <Route path={ROUTES.EMPLOYEE.DASHBOARD} element={<EmployeeDashboardPage />} />
            <Route path={ROUTES.EMPLOYEE.ATTENDANCE} element={<AttendancePage />} />
            <Route path={ROUTES.EMPLOYEE.EXPENSES} element={<ExpensesPage />} />
            <Route path={ROUTES.EMPLOYEE.REPORTS} element={<DailyReportPage />} />
            <Route path={ROUTES.EMPLOYEE.AI_ASSISTANT} element={<AIAssistantPage />} />
          </Route>
        </Route>

        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-surface-base">
              <div className="text-center space-y-4">
                <div className="w-24 h-24 mx-auto rounded-full bg-surface-elevated flex items-center justify-center">
                  <span className="text-5xl font-bold text-text-muted">404</span>
                </div>
                <h1 className="text-2xl font-bold text-text-primary">Page Not Found</h1>
                <p className="text-text-secondary">The page you're looking for doesn't exist.</p>
                <a href="/login" className="text-worksync-400 hover:underline text-sm">
                  Go to Login
                </a>
              </div>
            </div>
          }
        />
      </Routes>

      <ToastViewport>
        <ToastContainer />
      </ToastViewport>
    </ToastProvider>
  )
}
