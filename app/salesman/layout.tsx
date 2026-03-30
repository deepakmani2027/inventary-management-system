import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/layout'
import { getSidebarLinksForRole } from '@/lib/dashboard/routes'

export default async function SalesmanLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  const authRole = user.user_metadata?.role as string | undefined
  const authFullName = user.user_metadata?.full_name || user.user_metadata?.name
  const role = profile?.role || authRole || null

  if (role !== 'salesman') {
    redirect('/auth/login')
  }

  return (
    <DashboardLayout
      role="salesman"
      title="Salesman Panel"
      userName={profile?.full_name || authFullName || 'Salesman'}
      userEmail={profile?.email || user.email || ''}
      sidebarLinks={getSidebarLinksForRole('salesman')}
    >
      {children}
    </DashboardLayout>
  )
}