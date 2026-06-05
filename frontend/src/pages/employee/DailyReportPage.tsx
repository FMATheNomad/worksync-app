import { useState, useEffect } from 'react'
import { FileText, Send, Save, Sparkles, Clock, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { reportService } from '@/services/reportService'
import { toast } from '@/components/ui/toast'
import type { DailyReport } from '@/types'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants'

export default function DailyReportPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('new')

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      const res = await reportService.getReports({ limit: 20 })
      setReports(res.data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!content.trim()) {
      toast({ title: 'Please write something', variant: 'warning' })
      return
    }
    setSubmitting(true)
    try {
      await reportService.createReport({ content, is_ai_generated: false })
      toast({ title: 'Draft saved', variant: 'success' })
      setContent('')
      loadReports()
    } catch (err: any) {
      toast({ title: err?.message || 'Failed to save', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({ title: 'Please write something', variant: 'warning' })
      return
    }
    setSubmitting(true)
    try {
      await reportService.createReport({ content, is_ai_generated: false })
      toast({ title: 'Report submitted!', variant: 'success' })
      setContent('')
      setActiveTab('history')
      loadReports()
    } catch (err: any) {
      toast({ title: err?.message || 'Failed to submit', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAiGenerate = () => {
    navigate(ROUTES.EMPLOYEE.AI_ASSISTANT)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Daily Report</h1>
        <p className="text-text-secondary mt-1">Document your daily work activities</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="new" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            New Report
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Report</CardTitle>
              <CardDescription>
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe what you worked on today..."
                rows={8}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={handleAiGenerate}>
                  <Sparkles className="w-4 h-4 mr-2 text-accent-400" />
                  Generate with AI
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleSaveDraft} disabled={submitting}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    <Send className="w-4 h-4 mr-2" />
                    Submit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary">No reports yet</p>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report.id} className="hover:border-worksync-600/30 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={report.status === 'submitted' ? 'success' : 'warning'}>
                        {report.status === 'submitted' ? (
                          <CheckCheck className="w-3 h-3 mr-1" />
                        ) : (
                          <Save className="w-3 h-3 mr-1" />
                        )}
                        {report.status}
                      </Badge>
                      {report.is_ai_generated && (
                        <Badge variant="info">
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI Generated
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">
                      {format(new Date(report.createdAt), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary line-clamp-3">{report.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
