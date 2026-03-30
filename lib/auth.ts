import { createClient } from './supabase/server'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  return user
}

export async function getCurrentUserWithRole() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }

  // Get user role from users table
  const { data: userRole } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    ...user,
    role: userRole?.role || 'user'
  }
}

export async function signOut() {
  const supabase = await createClient()
  return await supabase.auth.signOut()
}
