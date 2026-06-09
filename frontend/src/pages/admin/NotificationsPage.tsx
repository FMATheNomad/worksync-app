import { useState, useEffect } from 'react'
import { Bell, AlertTriangle, CheckCircle, Clock, Send } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { ABSENSI_CONSTANTS } from '@/constants'

interface LateEmployee {
  id: string
  name: string
  email: string
  jabatan: string
  lastCheckIn: string | null
  notificationSent: boolean
  notificationTime: string | null
}

export default function NotificationsPage() {
  const [lateEmployees, setLateEmployees] = useState<LateEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      await new Promise((r) => setTimeout(r, 800))
      const mockData: LateEmployee[] = [
        {
          id: '1',
          name: 'Ahmad Fauzi',
          email: 'ahmad@company.com',
          jabatan: 'Software Engineer',
          lastCheckIn: null,
          notificationSent: false,
          notificationTime: null,
        },
        {
          id: '2',
          name: 'Siti Rahma',
          email: 'siti@company.com',
          jabatan: 'UI Designer',
          lastCheckIn: '2024-01-15T08:30:00',
          notificationSent: true,
          notificationTime: '2024-01-15T10:05:00',
        },
        {
          id: '3',
          name: 'Budi Santoso',
          email: 'budi@company.com',
          jabatan: 'Backend Developer',
          lastCheckIn: null,
          notificationSent: true,
          notificationTime: '2024-01-15T10:00:00',
        },
        {
          id: '4',
          name: 'Dewi Lestari',
          email: 'dewi@company.com',
          jabatan: 'Project Manager',
          lastCheckIn: '2024-01-15T09:45:00',
          notificationSent: false,
          notificationTime: null,
        },
      ]
      setLateEmployees(mockData)
    } finally {
      setLoading(false)
    }
  }

  const sendNotification = async (employeeId: string) => {
    setSending(employeeId)
    try {
      await new Promise((r) => setTimeout(r, 1000))
      setLateEmployees((prev) =>
        prev.map((e) =>
          e.id === employeeId
            ? { ...e, notificationSent: true, notificationTime: new Date().toISOString() }
            : e
        )
      )
      toast({ title: 'Notification sent successfully', variant: 'success' })
    } catch {
      toast({ title: 'Failed to send notification', variant: 'error' })
    } finally {
      setSending(null)
    }
  }

  const sendBulkNotifications = async () => {
    const unsent = lateEmployees.filter((e) => !e.notificationSent)
    if (unsent.length === 0) {
      toast({ title: 'All employees already notified', variant: 'info' })
      return
    }
    for (const emp of unsent) {
      await sendNotification(emp.id)
    }
    toast({ title: `Sent ${unsent.length} notifications`, variant: 'success' })
  }

  const unresolvedCount = lateEmployees.filter((e) => !e.notificationSent).length

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
          <p className="text-text-secondary mt-1">
            Employees who haven't checked in by {ABSENSI_CONSTANTS.LATE_CUTOFF_HOUR}:{String(ABSENSI_CONSTANTS.LATE_CUTOFF_MINUTE).padStart(2, '0')} AM
          </p>
        </div>
        <Button onClick={sendBulkNotifications} disabled={unresolvedCount === 0} className="w-full sm:w-auto">
          <Send className="w-4 h-4 mr-2" />
          Notify All ({unresolvedCount})
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-worksync-400" />
            Late Check-In Alerts
          </CardTitle>
          <CardDescription>
            {lateEmployees.length} employee(s) need attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : lateEmployees.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-status-success mx-auto mb-3" />
              <p className="text-text-secondary">All employees have checked in on time!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lateEmployees.map((emp) => (
                <Card key={emp.id} className="border-surface-border">
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center shrink-0">
                          <AlertTriangle className={`w-5 h-5 ${emp.lastCheckIn ? 'text-status-warning' : 'text-status-error'}`} />
                        </div>
                        <div>
                          <h3 className="font-medium text-text-primary">{emp.name}</h3>
                          <p className="text-xs text-text-muted">{emp.jabatan} &middot; {emp.email}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge
                              variant={emp.lastCheckIn ? 'warning' : 'destructive'}
                              className="text-xs"
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              {emp.lastCheckIn
                                ? `Last check-in: ${new Date(emp.lastCheckIn).toLocaleTimeString()}`
                                : 'No check-in today'}
                            </Badge>
                            {emp.notificationSent && (
                              <Badge variant="success" className="text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Notified at {emp.notificationTime ? new Date(emp.notificationTime).toLocaleTimeString() : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!emp.notificationSent ? (
                          <Button
                            size="sm"
                            onClick={() => sendNotification(emp.id)}
                            disabled={sending === emp.id}
                          >
                            {sending === emp.id ? (
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <Send className="w-3 h-3 mr-1" />
                                Notify
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled>
                            <CheckCircle className="w-4 h-4 mr-1 text-status-success" />
                            Done
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
