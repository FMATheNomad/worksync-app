/**
 * Admin monitoring dashboard — real-time view of all employee activity.
 *
 * WHY THIS EXISTS: The central operations hub for admin users. Provides
 * a single-page view of today's attendance, expenses, and reports across
 * all employees, with date filtering and detail drill-downs.
 *
 * MAP INTEGRATION:
 *   The attendance tab has a placeholder "Employee location map" section.
 *   WHY placeholder (not real map): Map integration requires:
 *     1. A map library (Leaflet, Mapbox GL, Google Maps).
 *     2. An API key for tile serving.
 *     3. Pin clustering for multiple employees.
 *   These add complexity and cost. The placeholder clearly communicates
 *   that map view is a Pro feature ("Upgrade to Pro for map view"),
 *   which also serves as an upsell mechanism.
 *
 *   When implementing, the map should:
 *     - Show each employee's check-in location as a pin.
 *     - Color-code pins: green (present), yellow (late), red (absent).
 *     - Cluster pins when zoomed out (using leaflet.markercluster).
 *     - Show employee name and status on pin click.
 *
 * DATA LOADING STRATEGY:
 *   loadData() fires THREE parallel API requests on mount and whenever
 *   the date filter changes:
 *     - attendanceService.getAttendances({ date, limit: 100 })
 *     - expenseService.getExpenses({ date, limit: 100 })
 *     - reportService.getReports({ date, limit: 100 })
 *
 *   WHY parallel (Promise.all): These are independent data sources with
 *   no cross-dependencies. Parallel loading reduces total wait time to
 *   the SLOWEST request (typically the one with most data).
 *
 *   WHY limit 100: Pagination boundary. For most teams, 100 records/day
 *   is sufficient. If exceeded, the table just shows the first 100.
 *   Future enhancement: server-side pagination with "Load more" button.
 *
 *   WHY no error handling in catch block: The catch block is empty.
 *   This means failed requests silently result in empty data. In production,
 *   you'd want a toast notification or inline error state per tab.
 *
 * TAB DESIGN:
 *   Three tabs (Attendance, Expenses, Reports) with independent table views.
 *   Each tab queries a different service but shares the date filter.
 *   Tables show key fields with badges for status indicators.
 *
 *   Attendance: Employee, Check In, Check Out, Status, Location (coords).
 *   Expenses: Employee, Item, Category, Amount, Photo (eye icon).
 *   Reports: Employee, Status, Date, AI Generated (badge), Content (view button).
 *
 * DIALOG (DETAIL VIEW):
 *   - Expense photo: Modal showing the receipt/photo image.
 *   - Report content: Modal showing the full report text (whitespace-pre).
 *   Both modals close on backdrop click or X button.
 *
 * PERFORMANCE:
 *   - Date filter uses a controlled input (date type) that triggers reload
 *     on every change. For very large datasets, consider debouncing.
 *   - Skeletons show during loading to reduce perceived latency.
 *   - Tables use native HTML table elements for efficient rendering.
 */

import { useState, useEffect } from 'react'
import { MapPin, Receipt, FileText, Filter, Eye } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { attendanceService } from '@/services/attendanceService'
import { expenseService } from '@/services/expenseService'
import { reportService } from '@/services/reportService'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { Attendance, Expense, DailyReport } from '@/types'
import { format } from 'date-fns'

export default function MonitoringPage() {
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null)

  useEffect(() => {
    loadData()
  }, [dateFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [attRes, expRes, repRes] = await Promise.all([
        attendanceService.getAttendances({ date: dateFilter, limit: 100 }),
        expenseService.getExpenses({ date: dateFilter, limit: 100 }),
        reportService.getReports({ date: dateFilter, limit: 100 }),
      ])
      setAttendances(attRes.attendances)
      setExpenses(expRes.expenses)
      setReports(repRes.reports)
    } catch {
      // Silent failure: stale data remains visible.
      // Future: show inline error state.
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Monitoring</h1>
          <p className="text-text-secondary mt-1">Track all employee activities</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-44"
          />
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-4">
          <div className="h-48 rounded-xl bg-gradient-to-br from-surface-elevated to-surface-card border border-surface-border flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-worksync-400 mx-auto mb-2" />
              <p className="text-sm text-text-secondary">Employee location map</p>
              <p className="text-xs text-text-muted mt-1">Upgrade to Pro for map view</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
              <CardDescription>Showing {attendances.length} records</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendances.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-text-muted py-8">
                          No attendance records for this date
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendances.map((att) => (
                        <TableRow key={att.id}>
                          <TableCell className="font-medium">{att.user_name}</TableCell>
                          <TableCell>{att.check_in_time ? new Date(att.check_in_time).toLocaleTimeString() : '-'}</TableCell>
                          <TableCell>{att.check_out_time ? new Date(att.check_out_time).toLocaleTimeString() : '-'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={att.status === 'present' ? 'success' : att.status === 'late' ? 'warning' : 'destructive'}
                            >
                              {att.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-text-muted">
                            {att.check_in_lat?.toFixed(4)}, {att.check_in_lng?.toFixed(4)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expense Records</CardTitle>
              <CardDescription>Showing {expenses.length} records</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Photo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-text-muted py-8">
                          No expense records for this date
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.map((exp) => (
                        <TableRow key={exp.id}>
                          <TableCell className="font-medium">{exp.user_name}</TableCell>
                          <TableCell>{exp.item_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{exp.category}</Badge>
                          </TableCell>
                          <TableCell>$ {exp.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            {exp.photo_url ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedExpense(exp)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            ) : (
                              <span className="text-text-muted text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Reports</CardTitle>
              <CardDescription>Showing {reports.length} records</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>AI Generated</TableHead>
                      <TableHead>Content</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-text-muted py-8">
                          No reports for this date
                        </TableCell>
                      </TableRow>
                    ) : (
                      reports.map((rep) => (
                        <TableRow key={rep.id}>
                          <TableCell className="font-medium">{rep.user_name}</TableCell>
                          <TableCell>
                            <Badge variant={rep.status === 'submitted' ? 'success' : 'warning'}>
                              {rep.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{rep.date}</TableCell>
                          <TableCell>
                            {rep.is_ai_generated ? (
                              <Badge variant="info">AI</Badge>
                            ) : (
                              <span className="text-text-muted text-sm">Manual</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedReport(rep)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedExpense} onOpenChange={(o) => !o && setSelectedExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expense Photo</DialogTitle>
            <DialogDescription>{selectedExpense?.item_name}</DialogDescription>
          </DialogHeader>
          {selectedExpense?.photo_url && (
            <img
              src={selectedExpense.photo_url}
              alt={selectedExpense.item_name}
              className="w-full rounded-xl"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report by {selectedReport?.user_name}</DialogTitle>
            <DialogDescription>{selectedReport?.date}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-text-primary whitespace-pre-wrap">{selectedReport?.content}</p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
