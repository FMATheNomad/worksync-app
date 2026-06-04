import { useState, useEffect, useRef } from 'react'
import { Plus, Receipt, Trash2, Upload, Camera, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { expenseService } from '@/services/expenseService'
import { toast } from '@/components/ui/toast'
import type { Expense } from '@/types'

const expenseCategories = [
  'Transportation',
  'Meals',
  'Office Supplies',
  'Technology',
  'Travel',
  'Utilities',
  'Other',
]

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    itemName: '',
    amount: '',
    category: '',
    description: '',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
    try {
      const res = await expenseService.getExpenses({ limit: 50 })
      setExpenses(res.data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.itemName || !formData.amount || !formData.category) {
      toast({ title: 'Please fill all required fields', variant: 'warning' })
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('itemName', formData.itemName)
      fd.append('amount', formData.amount)
      fd.append('category', formData.category)
      if (formData.description) fd.append('description', formData.description)
      if (photoFile) fd.append('photo', photoFile)

      await expenseService.createExpense(fd)
      toast({ title: 'Expense added successfully', variant: 'success' })
      setShowForm(false)
      setFormData({ itemName: '', amount: '', category: '', description: '' })
      setPhotoFile(null)
      setPhotoPreview(null)
      loadExpenses()
    } catch (err: any) {
      toast({ title: err?.message || 'Failed to add expense', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await expenseService.deleteExpense(id)
      toast({ title: 'Expense deleted', variant: 'success' })
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } catch {
      toast({ title: 'Failed to delete expense', variant: 'error' })
    }
  }

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Expenses</h1>
          <p className="text-text-secondary mt-1">Track your business expenses</p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
              <DialogDescription>Fill in the details of your expense</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="itemName">Item Name *</Label>
                <Input
                  id="itemName"
                  value={formData.itemName}
                  onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                  placeholder="e.g. Taxi to office"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (Rp) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="50000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional notes..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Photo Receipt</Label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-2" />
                    {photoPreview ? 'Change Photo' : 'Upload Photo'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  {photoPreview && (
                    <div className="relative">
                      <img src={photoPreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-status-error text-white flex items-center justify-center text-xs"
                      >
                        x
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Expense'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-worksync-400" />
              <span className="font-medium text-text-primary">Total Expenses</span>
            </div>
            <span className="text-2xl font-bold text-worksync-400">
              Rp {totalAmount.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : expenses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary">No expenses yet</p>
              <Button variant="link" className="mt-2 text-worksync-400" onClick={() => setShowForm(true)}>
                Add your first expense
              </Button>
            </CardContent>
          </Card>
        ) : (
          expenses.map((expense) => (
            <Card key={expense.id} className="hover:border-worksync-600/30 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {expense.photoUrl ? (
                      <img src={expense.photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-surface-elevated flex items-center justify-center">
                        <Image className="w-5 h-5 text-text-muted" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-text-primary">{expense.itemName}</h3>
                      <p className="text-xs text-text-muted">{expense.category}</p>
                      {expense.description && (
                        <p className="text-xs text-text-secondary mt-1">{expense.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-sm">
                      Rp {expense.amount.toLocaleString()}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-text-muted hover:text-status-error"
                      onClick={() => handleDelete(expense.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
