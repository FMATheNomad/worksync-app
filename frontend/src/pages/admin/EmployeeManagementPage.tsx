import { useState, useEffect } from 'react'
import { Users, Plus, Search, Edit2, ToggleLeft, ToggleRight, Mail } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import type { User, UserRole } from '@/types'
import api from '@/services/api'
import { API_ENDPOINTS } from '@/constants'

export default function EmployeeManagementPage() {
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    jabatan: '',
    role: 'employee' as UserRole,
  })

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    try {
      const { data } = await api.get(API_ENDPOINTS.EMPLOYEES.BASE)
      setEmployees(data.data || data)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.jabatan || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    try {
      if (editingEmployee) {
        await api.patch(`${API_ENDPOINTS.EMPLOYEES.BASE}/${editingEmployee.id}`, formData)
        toast({ title: 'Employee updated', variant: 'success' })
      } else {
        await api.post(API_ENDPOINTS.EMPLOYEES.BASE, formData)
        toast({ title: 'Employee added', variant: 'success' })
      }
      setShowForm(false)
      setEditingEmployee(null)
      setFormData({ name: '', email: '', password: '', jabatan: '', role: 'employee' })
      loadEmployees()
    } catch (err: any) {
      toast({ title: err?.message || 'Failed to save employee', variant: 'error' })
    } finally {
      setFormLoading(false)
    }
  }

  const handleEdit = (employee: User) => {
    setEditingEmployee(employee)
    setFormData({
      name: employee.name,
      email: employee.email,
      password: '',
      jabatan: employee.jabatan || '',
      role: employee.role,
    })
    setShowForm(true)
  }

  const handleToggleActive = async (employee: User) => {
    try {
      await api.patch(`${API_ENDPOINTS.EMPLOYEES.BASE}/${employee.id}`, {
        is_active: !employee.is_active,
      })
      toast({ title: `Employee ${employee.is_active ? 'deactivated' : 'activated'}`, variant: 'success' })
      loadEmployees()
    } catch {
      toast({ title: 'Failed to update employee', variant: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Employee Management</h1>
          <p className="text-text-secondary mt-1">Manage your team members</p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
              <DialogDescription>
                {editingEmployee ? 'Update employee details' : 'Add a new team member'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@company.com"
                  required
                />
              </div>
              {!editingEmployee && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 8 characters"
                    required={!editingEmployee}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jabatan">Position</Label>
                  <Input
                    id="jabatan"
                    value={formData.jabatan}
                    onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                    placeholder="Software Engineer"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v: UserRole) => setFormData({ ...formData, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? 'Saving...' : editingEmployee ? 'Update' : 'Add Employee'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-worksync-400" />
            Team Members
          </CardTitle>
          <CardDescription>{employees.length} employees total</CardDescription>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              placeholder="Search by name, email, or position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-text-muted py-8">
                      {search ? 'No employees match your search' : 'No employees yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-text-muted" />
                          {emp.email}
                        </span>
                      </TableCell>
                      <TableCell>{emp.jabatan}</TableCell>
                      <TableCell>
                        <Badge variant={emp.role === 'admin' ? 'default' : 'secondary'}>
                          {emp.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.is_active ? 'success' : 'destructive'}>
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(emp)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(emp)}
                          >
                            {emp.is_active ? (
                              <ToggleRight className="w-4 h-4 text-status-success" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-text-muted" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
