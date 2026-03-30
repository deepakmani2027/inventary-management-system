import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  getDashboardRouteForRole,
  getRoleFromDashboardPath,
} from '@/lib/dashboard/routes'

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required.')
  }

  if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required.')
  }

  return { supabaseUrl, supabaseAnonKey }
}

function createSupabaseMiddlewareClient(request: NextRequest, response: NextResponse) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(cookie => ({ name: cookie.name, value: cookie.value }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()
  const supabase = createSupabaseMiddlewareClient(request, response)
  const { data: { user } } = await supabase.auth.getUser()

  const isDashboardPath = pathname.startsWith('/dashboard')
  const isLegacyRolePath = ['admin', 'salesman', 'inventory-manager', 'sales-manager'].some(
    role => pathname === `/${role}` || pathname.startsWith(`/${role}/`)
  )
  const isProtectedPath = isDashboardPath || isLegacyRolePath || pathname === '/settings'

  if (!user) {
    if (isProtectedPath) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    return response
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role || null
  const roleDashboard = getDashboardRouteForRole(role)

  if (pathname === '/' || pathname.startsWith('/auth')) {
    if (roleDashboard) {
      return NextResponse.redirect(new URL(roleDashboard, request.url))
    }

    return response
  }

  if (isDashboardPath) {
    const dashboardRole = getRoleFromDashboardPath(pathname.split('/')[2])
    if (dashboardRole && dashboardRole !== role) {
      if (roleDashboard) {
        return NextResponse.redirect(new URL(roleDashboard, request.url))
      }

      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
