import { useState, useRef, useEffect } from 'react'
import { Send, User, Loader2, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { aiService } from '@/services/aiService'
import { toast } from '@/components/ui/toast'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const suggestedQuestions = [
  'How many employees checked in on time today?',
  'What is the total attendance rate this week?',
  'Show me expense trends for this month',
  'Which employee has the most late check-ins?',
  'Compare attendance between this week and last week',
]

function TypewriterText({ text, speed = 15 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    indexRef.current = 0
    setDisplayedText('')
    setIsComplete(false)

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1))
        indexRef.current++
      } else {
        setIsComplete(true)
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return (
    <span>
      {displayedText}
      {!isComplete && <span className="animate-typewriter-cursor text-worksync-400">|</span>}
    </span>
  )
}

export default function AIAnalyticsPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to AI Analytics! I can answer questions about your team\'s attendance, expenses, and reports. Try asking me about trends, statistics, or specific employee data.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (message?: string) => {
    const text = message || input.trim()
    if (!text || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await aiService.askAnalytics(text)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: any) {
      toast({ title: err?.message || 'Failed to get analytics', variant: 'error' })
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">AI Analytics</h1>
        <p className="text-text-secondary mt-1">Ask questions about attendance, expenses, and reports</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestedQuestions.map((q, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            onClick={() => handleSend(q)}
            disabled={loading}
            className="text-xs"
          >
            {q}
          </Button>
        ))}
      </div>

      <Card className="h-[calc(100vh-16rem)] flex flex-col">
        <CardHeader className="border-b border-surface-border">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-worksync-500 to-worksync-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            Analytics AI
          </CardTitle>
          <CardDescription>Powered by advanced data analysis AI</CardDescription>
        </CardHeader>

        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    message.role === 'user'
                      ? 'bg-worksync-600'
                      : 'bg-gradient-to-br from-worksync-500 to-worksync-700'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <BarChart3 className="w-4 h-4 text-white" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-worksync-600 text-white'
                      : 'bg-surface-elevated border border-surface-border'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <p className="text-sm leading-relaxed text-text-primary">
                      {message.id === messages[messages.length - 1].id && loading ? (
                        <TypewriterText text={message.content} />
                      ) : (
                        message.content
                      )}
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed text-white">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-worksync-500 to-worksync-700 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-surface-elevated border border-surface-border">
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing data...
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        <div className="p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about attendance, expenses, or reports..."
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={() => handleSend()} disabled={loading || !input.trim()}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
