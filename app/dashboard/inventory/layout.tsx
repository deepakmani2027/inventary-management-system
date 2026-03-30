import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayout } from '@/components/dashboard/layout'
import { getSidebarLinksForRole } from '@/lib/dashboard/routes'

export default async function InventoryDashboardLayout({ children }: { children: React.ReactNode }) {
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

  if (!['inventory_manager', 'admin'].includes(String(profile?.role || ''))) {
    redirect('/auth/login')
  }

  return (
    <DashboardLayout
      role="inventory_manager"
      title="Inventory Panel"
      userName={profile?.full_name || 'Inventory Manager'}
      userEmail={profile?.email || user.email || ''}
      sidebarLinks={getSidebarLinksForRole('inventory_manager')}
    >
      {children}
    </DashboardLayout>
  )
}
