import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Clock, Receipt, FileText, Bot,
  Users, Bell, BarChart3, CreditCard, MapPin, LogOut,
  ChevronLeft, ChevronRight, Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/authStore'
import { ROUTES, APP_NAME } from '@/constants'
import { useState } from 'react'

const employeeNavItems = [
  { to: ROUTES.EMPLOYEE.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
  { to: ROUTES.EMPLOYEE.ATTENDANCE, icon: Clock, label: 'Attendance' },
  { to: ROUTES.EMPLOYEE.EXPENSES, icon: Receipt, label: 'Expenses' },
  { to: ROUTES.EMPLOYEE.REPORTS, icon: FileText, label: 'Daily Reports' },
  { to: ROUTES.EMPLOYEE.AI_ASSISTANT, icon: Bot, label: 'AI Assistant' },
]

const adminNavItems = [
  { to: ROUTES.ADMIN.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
  { to: ROUTES.ADMIN.MONITORING, icon: MapPin, label: 'Monitoring' },
  { to: ROUTES.ADMIN.EMPLOYEES, icon: Users, label: 'Employees' },
  { to: ROUTES.ADMIN.NOTIFICATIONS, icon: Bell, label: 'Notifications' },
  { to: ROUTES.ADMIN.AI_ANALYTICS, icon: BarChart3, label: 'AI Analytics' },
  { to: ROUTES.ADMIN.BILLING, icon: CreditCard, label: 'Billing' },
]

interface SidebarProps {
  mobile?: boolean
  onNavigate?: () => void
}

export function Sidebar({ mobile, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const location = useLocation()

  const navItems = user?.role === 'admin' ? adminNavItems : employeeNavItems
  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  const handleNav = () => {
    if (mobile && onNavigate) onNavigate()
  }

  return (
    <aside
      className={cn(
        'flex h-screen flex-col bg-surface-elevated border-r border-surface-border transition-all duration-300',
        mobile ? 'w-full' : collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-surface-border', collapsed && !mobile && 'justify-center px-2')}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-worksync-500 to-worksync-700 shrink-0">
          <span className="text-white font-bold text-sm">W</span>
        </div>
        {(!collapsed || mobile) && (
          <span className="font-bold text-lg text-text-primary tracking-tight">{APP_NAME}</span>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNav}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                collapsed && !mobile && 'justify-center px-2',
                isActive
                  ? 'bg-worksync-600/20 text-worksync-400'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {(!collapsed || mobile) && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      <Separator />

      <div className={cn('p-3', collapsed && !mobile && 'flex flex-col items-center gap-2')}>
        {(!collapsed || mobile) && (
          <div className="flex items-center gap-3 px-2 mb-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{user?.name}</p>
              <p className="text-xs text-text-muted truncate capitalize">{user?.role}</p>
            </div>
          </div>
        )}
        {collapsed && !mobile && (
          <Avatar className="w-8 h-8 mb-2">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        )}
        <Button
          variant="ghost"
          size={(collapsed && !mobile) ? 'icon' : 'default'}
          className={cn('w-full justify-start text-text-secondary hover:text-status-error', collapsed && !mobile && 'justify-center')}
          onClick={() => { logout(); handleNav() }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {(!collapsed || mobile) && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>

      {!mobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface-card border border-surface-border flex items-center justify-center hover:bg-surface-hover transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3 h-3 text-text-secondary" /> : <ChevronLeft className="w-3 h-3 text-text-secondary" />}
        </button>
      )}
    </aside>
  )
}
