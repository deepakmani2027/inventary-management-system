'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/dashboard/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowRight, Pencil, Plus, Search, Sparkles, Trash2, Users } from 'lucide-react'

type UserRow = { id: string; email: string; full_name: string; role: string; is_active: boolean; created_at: string }

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'salesman', label: 'Salesman' },
  { value: 'inventory_manager', label: 'Inventory Manager' },
  { value: 'sales_manager', label: 'Sales Manager' },
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'salesman', password: '' })

  const loadUsers = async () => {
    const response = await fetch('/api/admin/users')
    const data = await response.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = `${user.full_name} ${user.email}`.toLowerCase().includes(search.toLowerCase())
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const openCreate = () => {
    setEditingUser(null)
    setForm({ full_name: '', email: '', role: 'salesman', password: 'password123' })
    setOpen(true)
  }

  const openEdit = (user: UserRow) => {
    setEditingUser(user)
    setForm({ full_name: user.full_name, email: user.email, role: user.role, password: '' })
    setOpen(true)
  }

  const submit = async () => {
    setSaving(true)
    try {
      const response = editingUser
        ? await fetch(`/api/admin/users/${editingUser.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: form.full_name, email: form.email, role: form.role }),
          })
        : await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save user')

      toast.success(editingUser ? 'User updated' : 'User created')
      setOpen(false)
      await loadUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  const [seeAll, setSeeAll] = useState(false)

  const removeUser = async (id: string) => {
    if (!confirm('Delete this user?')) return
    const response = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) {
      toast.error(data.error || 'Failed to delete user')
      return
    }
    toast.success('User deleted')
    await loadUsers()
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-background via-card/70 to-background p-6 shadow-2xl shadow-slate-950/10 backdrop-blur sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              Admin panel for access control and accounts
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Users</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Create, update, and manage access for the entire team from one clear workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={openCreate} className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email" className="pl-10" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roleOptions.map(role => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <DataTable
        title="All Users"
        pageSize={seeAll ? filteredUsers.length || 1 : 10}
        hidePagination={true}
        columns={[
          { key: 'full_name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role', render: value => <span className="capitalize">{String(value).replace('_', ' ')}</span> },
          { key: 'is_active', label: 'Status', render: value => <span className={value ? 'text-green-400' : 'text-red-400'}>{value ? 'Active' : 'Inactive'}</span> },
          {
            key: 'id',
            label: 'Actions',
            render: (_value, row) => (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-border/70" onClick={() => openEdit(row)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="border-red-500/30 text-red-600 hover:bg-red-500/10" onClick={() => removeUser(row.id)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            ),
          },
        ]}
        data={filteredUsers}
        loading={loading}
      />

      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setSeeAll(prev => !prev)} className="border-border/70">
          {seeAll ? 'Show paged' : 'See all'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>Manage account access and profile details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input value={form.full_name} onChange={e => setForm(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Full name" />
            <Input value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" />
            <Select value={form.role} onValueChange={value => setForm(prev => ({ ...prev, role: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map(role => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {!editingUser && <Input value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} placeholder="Password" type="password" />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
