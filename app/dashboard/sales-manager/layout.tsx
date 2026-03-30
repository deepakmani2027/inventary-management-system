import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/layout'
import { getSidebarLinksForRole } from '@/lib/dashboard/routes'

export default async function SalesManagerDashboardLayout({ children }: { children: React.ReactNode }) {
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

  if (!['sales_manager', 'admin'].includes(String(profile?.role || ''))) {
    redirect('/auth/login')
  }

  return (
    <DashboardLayout
      role="sales_manager"
      title="Sales Manager Panel"
      userName={profile?.full_name || 'Sales Manager'}
      userEmail={profile?.email || user.email || ''}
      sidebarLinks={getSidebarLinksForRole('sales_manager')}
    >
      {children}
    </DashboardLayout>
  )
}
