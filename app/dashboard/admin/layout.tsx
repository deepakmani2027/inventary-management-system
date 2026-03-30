import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/layout'
import { getSidebarLinksForRole } from '@/lib/dashboard/routes'

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, email')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    redirect('/auth/login')
  }

  return (
    <DashboardLayout
      role="admin"
      title="Admin Panel"
      userName={profile?.full_name || 'Admin'}
      userEmail={profile?.email || user.email || ''}
      sidebarLinks={getSidebarLinksForRole('admin')}
    >
      {children}
    </DashboardLayout>
  )
}
