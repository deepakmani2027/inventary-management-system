import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardRouteForRole } from '@/lib/dashboard/routes'

export default async function DashboardRedirectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const roleDashboard = getDashboardRouteForRole(profile?.role)

  if (!roleDashboard) {
    redirect('/auth/login')
  }

  redirect(roleDashboard)
}
