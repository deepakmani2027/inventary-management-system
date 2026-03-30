import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/layout'
import { getSidebarLinksForRole } from '@/lib/dashboard/routes'

export default async function InventoryLayout({
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

  if (!['inventory_manager', 'admin'].includes(String(role || ''))) {
    redirect('/auth/login')
  }

  return (
    <DashboardLayout
      role="inventory_manager"
      title="Inventory Panel"
      userName={profile?.full_name || authFullName || 'Inventory Manager'}
      userEmail={profile?.email || user.email || ''}
      sidebarLinks={getSidebarLinksForRole('inventory_manager')}
    >
      {children}
    </DashboardLayout>
  )
}