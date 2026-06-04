import { useLocation } from 'react-router-dom'
import { Bell, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/stores/authStore'

const routeNames: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/monitoring': 'Monitoring',
  '/admin/employees': 'Employees',
  '/admin/notifications': 'Notifications',
  '/admin/ai-analytics': 'AI Analytics',
  '/admin/billing': 'Billing',
  '/employee/dashboard': 'Dashboard',
  '/employee/attendance': 'Attendance',
  '/employee/expenses': 'Expenses',
  '/employee/reports': 'Daily Reports',
  '/employee/ai-assistant': 'AI Assistant',
}

export function Topbar() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const currentPage = routeNames[location.pathname] || 'Page'
  const breadcrumbs = location.pathname.split('/').filter(Boolean)
  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-surface-base border-b border-surface-border">
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-2 text-sm text-text-muted">
          <span className="capitalize">{breadcrumbs[0] || 'App'}</span>
          {breadcrumbs.length > 1 && (
            <>
              <span>/</span>
              <span className="text-text-primary font-medium">{currentPage}</span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input
            placeholder="Search..."
            className="pl-9 w-64 h-9 bg-surface-elevated border-surface-border text-sm"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-text-secondary" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-status-error" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="w-8 h-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-text-primary font-medium">{user?.name}</span>
                <span className="text-text-muted text-xs font-normal">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-text-secondary">
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="text-text-secondary">
              Account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-status-error hover:text-status-error"
              onClick={logout}
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
