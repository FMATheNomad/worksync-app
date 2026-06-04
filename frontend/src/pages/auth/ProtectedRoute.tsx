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
