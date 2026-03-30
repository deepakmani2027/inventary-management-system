'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bell, Lock, User } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

type ActiveTab = 'profile' | 'security'

export default function SalesmanSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const profileCardRef = useRef<HTMLDivElement | null>(null)
  const securityCardRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  useEffect(() => {
    const tab = searchParams.get('tab')
    setActiveTab(tab === 'security' ? 'security' : 'profile')
  }, [searchParams])

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const supabase = getSupabaseClient()
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (!authUser) {
          router.push('/auth/login')
          return
        }

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        setUser(userData)
        setFormData(prev => ({
          ...prev,
          name: userData?.full_name || '',
          email: authUser.email || '',
        }))
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }

    fetchUserData()
  }, [router])

  useEffect(() => {
    const target = activeTab === 'security' ? securityCardRef.current : profileCardRef.current
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeTab])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = getSupabaseClient()
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) return

      const { error } = await supabase.from('users').update({ full_name: formData.name }).eq('id', authUser.id)

      if (error) {
        toast.error('Failed to update profile')
        return
      }

      toast.success('Profile updated successfully!')
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.newPassword || !formData.confirmPassword) {
      toast.error('Please fill in all password fields')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (formData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Password changed successfully!')
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }))
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const tabs = useMemo(
    () => [
      { id: 'profile' as const, label: 'Profile Settings', icon: User },
      { id: 'security' as const, label: 'Security', icon: Lock },
    ],
    [],
  )

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Workspace</p>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="mt-2 text-slate-400">Manage your account and preferences</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              {tabs.map(tab => {
                const Icon = tab.icon
                const active = activeTab === tab.id
                return (
                  <Button
                    key={tab.id}
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    className={active ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border-slate-600 bg-slate-700/40 text-slate-200 hover:bg-slate-700/70'}
                    onClick={() => {
                      setActiveTab(tab.id)
                      router.replace(`/salesman/dashboard/settings${tab.id === 'security' ? '?tab=security' : ''}`)
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card ref={profileCardRef} className={`bg-slate-800/50 border-slate-700 ${activeTab === 'profile' ? 'ring-2 ring-blue-500/40' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <User className="h-5 w-5" />
              Profile Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300">Full Name</label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2 border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Email</label>
                <Input
                  value={formData.email}
                  disabled
                  className="mt-2 border-slate-600 bg-slate-700/50 text-slate-400 placeholder:text-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500">Email cannot be changed</p>
              </div>

              <Button type="submit" className="w-full bg-blue-600 font-semibold text-white hover:bg-blue-700" disabled={loading}>
                {loading ? 'Updating...' : 'Update Profile'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card ref={securityCardRef} className={`bg-slate-800/50 border-slate-700 ${activeTab === 'security' ? 'ring-2 ring-blue-500/40' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300">New Password</label>
                <Input
                  type="password"
                  value={formData.newPassword}
                  onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                  placeholder="••••••••"
                  className="mt-2 border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Confirm Password</label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="mt-2 border-slate-600 bg-slate-700/50 text-white placeholder:text-slate-500"
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full bg-blue-600 font-semibold text-white hover:bg-blue-700" disabled={loading}>
                {loading ? 'Changing...' : 'Change Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-700/30 p-3">
              <p className="font-medium text-white">Email Notifications</p>
              <p className="text-sm text-slate-400">Receive updates about your account</p>
            </div>
            <div className="rounded-lg bg-slate-700/30 p-3">
              <p className="font-medium text-white">Low Stock Alerts</p>
              <p className="text-sm text-slate-400">Get notified when inventory is low</p>
            </div>
            <div className="rounded-lg bg-slate-700/30 p-3">
              <p className="font-medium text-white">Sales Updates</p>
              <p className="text-sm text-slate-400">Receive sales activity notifications</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}