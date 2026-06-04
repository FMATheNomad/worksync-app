import { useState, useEffect } from 'react'
import { Users, Clock, Receipt, FileText, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { attendanceService } from '@/services/attendanceService'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const weeklyData = [
  { day: 'Mon', attendance: 45, expenses: 12, reports: 38 },
  { day: 'Tue', attendance: 52, expenses: 8, reports: 42 },
  { day: 'Wed', attendance: 48, expenses: 15, reports: 40 },
  { day: 'Thu', attendance: 55, expenses: 10, reports: 45 },
  { day: 'Fri', attendance: 50, expenses: 14, reports: 43 },
  { day: 'Sat', attendance: 12, expenses: 3, reports: 10 },
  { day: 'Sun', attendance: 0, expenses: 1, reports: 5 },
]

const recentNotifications = [
  { id: 1, message: '3 employees haven\'t checked in yet', time: '10:30 AM', type: 'warning' },
  { id: 2, message: 'New expense report from Sarah', time: '9:45 AM', type: 'info' },
  { id: 3, message: 'Daily reports pending review', time: '8:00 AM', type: 'info' },
  { id: 4, message: 'Attendance rate: 92% this week', time: 'Yesterday', type: 'success' },
]

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState({ total: 0, onTime: 0, late: 0, absent: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSummary()
  }, [])

  const loadSummary = async () => {
    try {
      const data = await attendanceService.getAttendanceSummary()
      setSummary(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
        <p className="text-text-secondary mt-1">Works activity overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-worksync-600/20 to-worksync-800/10 border-worksync-600/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Attendance</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-text-primary mt-1">{summary.total}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-worksync-600/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-worksync-400" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs">
              <TrendingUp className="w-3 h-3 text-status-success" />
              <span className="text-status-success">+12% from yesterday</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">On Time</p>
                <p className="text-2xl font-bold text-status-success mt-1">{summary.onTime}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-status-success/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-status-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Late</p>
                <p className="text-2xl font-bold text-status-warning mt-1">{summary.late}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-status-warning/10 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-status-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-secondary">Absent</p>
                <p className="text-2xl font-bold text-status-error mt-1">{summary.absent}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-status-error/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-status-error" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="w-5 h-5 text-worksync-400" />
              Weekly Attendance Trend
            </CardTitle>
            <CardDescription>Attendance count over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                  <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-modal)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '12px',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <Bar dataKey="attendance" fill="var(--worksync-500)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-worksync-400" />
              Weekly Overview
            </CardTitle>
            <CardDescription>Expenses and reports across the week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                  <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-modal)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '12px',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <Line type="monotone" dataKey="expenses" stroke="var(--status-warning)" strokeWidth={2} dot={{ fill: 'var(--status-warning)' }} />
                  <Line type="monotone" dataKey="reports" stroke="var(--worksync-400)" strokeWidth={2} dot={{ fill: 'var(--worksync-400)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-worksync-400" />
            Recent Notifications
          </CardTitle>
          <CardDescription>Latest updates from the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentNotifications.map((notif) => (
              <div
                key={notif.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    notif.type === 'warning' ? 'bg-status-warning' :
                    notif.type === 'info' ? 'bg-status-info' : 'bg-status-success'
                  }`} />
                  <p className="text-sm text-text-primary">{notif.message}</p>
                </div>
                <span className="text-xs text-text-muted">{notif.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
