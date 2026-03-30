import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/layout'
import { getSidebarLinksForRole } from '@/lib/dashboard/routes'

export default async function SalesManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('full_name, role, email')
    .eq('id', user.id)
    .maybeSingle()

  const authRole = user.user_metadata?.role as string | undefined
  const authFullName = user.user_metadata?.full_name || user.user_metadata?.name
  const role = userData?.role || authRole || null

  if (!['sales_manager', 'admin'].includes(String(role || ''))) {
    redirect('/auth/login')
  }

  return (
    <DashboardLayout
      role="sales_manager"
      title="Sales Manager Panel"
      userName={userData?.full_name || authFullName || 'Sales Manager'}
      userEmail={userData?.email || user.email || ''}
      sidebarLinks={getSidebarLinksForRole('sales_manager')}
    >
      {children}
    </DashboardLayout>
  )
}