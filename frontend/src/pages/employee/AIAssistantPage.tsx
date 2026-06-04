import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, User, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { aiService } from '@/services/aiService'
import { toast } from '@/components/ui/toast'
import type { AIConversation } from '@/types'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

function TypewriterText({ text, speed = 20 }: { text: string; speed?: number }) {
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

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. Tell me what you worked on today and I\'ll help you write a professional daily report.',
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

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await aiService.generateReport(userMessage.content)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.report_content,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: any) {
      toast({ title: err?.message || 'Failed to get response', variant: 'error' })
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
        <h1 className="text-2xl font-bold text-text-primary">AI Assistant</h1>
        <p className="text-text-secondary mt-1">Generate professional daily reports with AI</p>
      </div>

      <Card className="h-[calc(100vh-12rem)] flex flex-col">
        <CardHeader className="border-b border-surface-border">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            Worksync AI Assistant
          </CardTitle>
          <CardDescription>Powered by advanced language AI</CardDescription>
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
                      : 'bg-gradient-to-br from-accent-500 to-accent-700'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-white" />
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
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-surface-elevated border border-surface-border">
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating response...
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
              placeholder="Describe your work today..."
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={loading || !input.trim()}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Tip: Be specific about tasks, accomplishments, and challenges
          </p>
        </div>
      </Card>
    </div>
  )
}
