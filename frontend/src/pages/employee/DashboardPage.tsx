import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Clock, CheckCircle, XCircle, Receipt, FileText, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/authStore'
import { attendanceService } from '@/services/attendanceService'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/constants'
import type { Attendance } from '@/types'

export default function EmployeeDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null)
  const [recentAttendances, setRecentAttendances] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const [attendanceRes] = await Promise.all([
        attendanceService.getAttendances({ date: today, limit: 1 }),
      ])
      if (attendanceRes.attendances.length > 0) {
        setTodayAttendance(attendanceRes.attendances[0])
      }
      const recentRes = await attendanceService.getAttendances({ limit: 5 })
      setRecentAttendances(recentRes.attendances)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const isCheckedIn = todayAttendance?.check_in_time && !todayAttendance?.check_out_time
  const isCheckedOut = todayAttendance?.check_in_time && todayAttendance?.check_out_time

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-text-secondary mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-worksync-600/20 to-worksync-800/10 border-worksync-600/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Attendance Status</p>
                {loading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : isCheckedOut ? (
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle className="w-5 h-5 text-status-success" />
                    <span className="text-lg font-bold text-status-success">Checked Out</span>
                  </div>
                ) : isCheckedIn ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-5 h-5 text-status-warning animate-pulse" />
                    <span className="text-lg font-bold text-status-warning">Checked In</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <XCircle className="w-5 h-5 text-text-muted" />
                    <span className="text-lg font-bold text-text-muted">Not Checked In</span>
                  </div>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-worksync-600/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-worksync-400" />
              </div>
            </div>
            <Link to={ROUTES.EMPLOYEE.ATTENDANCE}>
              <Button variant="link" className="px-0 mt-2 text-worksync-400">
                {isCheckedIn ? 'Check Out' : 'Check In Now'}
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Recent Expenses</p>
                <p className="text-2xl font-bold text-text-primary mt-1">0</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center">
                <Receipt className="w-6 h-6 text-text-secondary" />
              </div>
            </div>
            <Link to={ROUTES.EMPLOYEE.EXPENSES}>
              <Button variant="link" className="px-0 mt-2 text-worksync-400">
                View Expenses
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Reports This Week</p>
                <p className="text-2xl font-bold text-text-primary mt-1">0</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-surface-elevated flex items-center justify-center">
                <FileText className="w-6 h-6 text-text-secondary" />
              </div>
            </div>
            <Link to={ROUTES.EMPLOYEE.REPORTS}>
              <Button variant="link" className="px-0 mt-2 text-worksync-400">
                Write Report
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-worksync-400" />
            Recent Activity
          </CardTitle>
          <CardDescription>Your latest attendance records</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentAttendances.length === 0 ? (
            <p className="text-text-muted text-sm py-8 text-center">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentAttendances.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      att.status === 'present' ? 'bg-status-success' :
                      att.status === 'late' ? 'bg-status-warning' : 'bg-status-error'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-text-primary capitalize">{att.status}</p>
                      <p className="text-xs text-text-muted">{att.check_in_time ? new Date(att.check_in_time).toLocaleDateString() : '-'}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-text-muted">
                    {att.check_in_time && <p>In: {new Date(att.check_in_time).toLocaleTimeString()}</p>}
                    {att.check_out_time && <p>Out: {new Date(att.check_out_time).toLocaleTimeString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
