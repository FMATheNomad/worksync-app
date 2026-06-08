/**
 * Route guard component that wraps protected pages.
 *
 * WHY THIS EXISTS: Prevents unauthorized access to routes that require
 * authentication and optionally restricts access by user role.
 *
 * ROLE-BASED ACCESS PATTERN:
 *   The component accepts an optional `allowedRoles` prop (e.g., ['admin']).
 *   If provided, the user's role must be in this list to access the route.
 *   If not provided, any authenticated user can access the route.
 *
 *   WHY this pattern (not separate AdminRoute + EmployeeRoute components):
 *     DRY. A single ProtectedRoute handles both cases:
 *       <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
 *         <Route path="/admin/dashboard" element={<Dashboard />} />
 *       </Route>
 *       <Route element={<ProtectedRoute />}>
 *         <Route path="/employee/attendance" element={<Attendance />} />
 *       </Route>
 *
 *   The first example requires admin role; the second requires any auth.
 *
 *   This is the standard pattern used by React Router v6 for layout routes.
 *   The <Outlet /> renders the matched child route.
 *
 * STATES:
 *   Loading state (isLoading=true):
 *     Shows a skeleton UI while checkAuth is in progress.
 *     WHY skeleton instead of spinner: Reduces layout shift when the
 *     actual page content loads. The skeleton matches the page dimensions.
 *
 *   Unauthenticated state:
 *     Redirects to /login via <Navigate replace />.
 *     The `replace` prop replaces the current history entry so the user
 *     can't press "back" to return to the protected page.
 *
 *   Unauthorized state (wrong role):
 *     Shows an "Access Denied" page with a link to the appropriate dashboard.
 *     WHY 403 page instead of redirect: The user IS authenticated but lacks
 *     the specific role. We want to communicate clearly what went wrong.
 *     The "Go to your dashboard" link routes based on their actual role.
 *
 *   Authorized state:
 *     Renders the child route via <Outlet />.
 *
 * WHY useAuthStore (Zustand) instead of context:
 *   The auth store is already available globally. Using it directly avoids
 *   wrapping the entire app in an AuthContext provider and keeps the component
 *   tree flatter. Zustand's subscribe mechanism is more efficient than
 *   React context for frequently-changing state (token expiry, etc.).
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ROUTES } from '@/constants'
import type { UserRole } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="space-y-4 w-80">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-status-error/10 flex items-center justify-center">
            <span className="text-3xl">!</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Access Denied</h1>
          <p className="text-text-secondary">You do not have permission to access this page.</p>
          <a
            href={user.role === 'admin' ? ROUTES.ADMIN.DASHBOARD : ROUTES.EMPLOYEE.DASHBOARD}
            className="text-worksync-400 hover:underline text-sm"
          >
            Go to your dashboard
          </a>
        </div>
      </div>
    )
  }

  return <Outlet />
}
