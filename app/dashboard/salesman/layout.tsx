import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/layout'
import { getSidebarLinksForRole } from '@/lib/dashboard/routes'

export default async function SalesmanDashboardLayout({ children }: { children: React.ReactNode }) {
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

  if (profile?.role !== 'salesman') {
    redirect('/auth/login')
  }

  return (
    <DashboardLayout
      role="salesman"
      title="Salesman Panel"
      userName={profile?.full_name || 'Salesman'}
      userEmail={profile?.email || user.email || ''}
      sidebarLinks={getSidebarLinksForRole('salesman')}
    >
      {children}
    </DashboardLayout>
  )
}
