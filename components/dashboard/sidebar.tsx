'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  Bell,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Home,
  Layers3,
  LogOut,
  Package,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingCart,
  SquareStack,
  Target,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { DashboardLink, DashboardIconName } from '@/lib/dashboard/routes'
import { getDashboardRouteForRole } from '@/lib/dashboard/routes'

interface SidebarLink {
  href: string
  label: string
  iconName: DashboardIconName
}

interface SidebarProps {
  role: string
  links: SidebarLink[]
  collapsed?: boolean
  onToggleCollapse?: () => void
  mobile?: boolean
}

const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  admin: BarChart3,
  salesman: ShoppingCart,
  inventory_manager: Package,
  sales_manager: TrendingUp,
}

const sidebarIcons: Record<DashboardIconName, React.ComponentType<{ className?: string }>> = {
  'layout-dashboard': BarChart3,
  users: Users,
  layers: Layers3,
  package: Package,
  'square-stack': SquareStack,
  settings: Settings,
  receipt: Receipt,
  'clipboard-list': ClipboardList,
  'rotate-ccw': RotateCcw,
  bell: Bell,
  'help-circle': HelpCircle,
  truck: Truck,
  zap: Zap,
  target: Target,
  'bar-chart': TrendingUp,
  'user-cog': UserCog,
}

export function Sidebar({ role, links, collapsed = false, onToggleCollapse, mobile = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null)
  const dashboardHref = getDashboardRouteForRole(role)

  useEffect(() => {
    for (const link of links) {
      router.prefetch(link.href)
    }
    router.prefetch('/settings')
  }, [links, router])

  useEffect(() => {
    setOptimisticHref(null)
  }, [pathname])

  const handleLogout = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const RoleIcon = roleIcons[role] || Home

  const sidebarClasses = mobile
    ? 'flex h-full w-full flex-col overflow-hidden border-r border-border/70 bg-background/95 text-foreground backdrop-blur-xl'
    : cn('hidden h-screen flex-col border-r border-border/70 bg-background/80 backdrop-blur-xl md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex', collapsed ? 'w-20' : 'w-72')

  return (
    <aside className={sidebarClasses}>
      {/* Header */}
      <div className={cn('border-b border-border/70', mobile ? 'px-5 py-6' : collapsed ? 'px-3 py-5' : 'p-6')}>
        <div className={cn('flex items-center', mobile ? 'gap-3' : collapsed ? 'justify-center' : 'gap-3')}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/15">
            <RoleIcon className="h-6 w-6 text-white" />
          </div>
          {!collapsed && !mobile ? (
            <div>
              <h1 className="text-lg font-semibold tracking-tight">InvTrack</h1>
              <p className="text-xs capitalize text-muted-foreground">{role.replace('_', ' ')}</p>
            </div>
          ) : null}
          {mobile ? (
            <div className="min-w-0 text-left">
              <h1 className="text-lg font-semibold tracking-tight">InvTrack</h1>
              <p className="text-xs capitalize text-muted-foreground">{role.replace('_', ' ')}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className={cn('flex-1 overflow-y-auto', mobile ? 'space-y-2 px-4 py-4' : collapsed ? 'space-y-2 px-2 py-4' : 'space-y-2 p-4')}>
        {mobile ? <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Navigation</p> : null}
        {links.map((link) => {
          const Icon = sidebarIcons[link.iconName] || BarChart3
          const isActive = optimisticHref
            ? optimisticHref === link.href
            : pathname === link.href || (link.href !== dashboardHref && pathname.startsWith(link.href + '/'))
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              onMouseEnter={() => router.prefetch(link.href)}
              onPointerDown={() => setOptimisticHref(link.href)}
              className={cn(
                'flex items-center rounded-2xl text-sm font-medium transition-all duration-150',
                mobile ? 'gap-3 px-4 py-3 text-base' : collapsed ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3',
                isActive
                  ? 'border border-primary/20 bg-slate-950 text-white shadow-lg shadow-slate-900/10 scale-[1.01]'
                  : 'border border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/80 hover:text-foreground'
              )}
              title={collapsed && !mobile ? link.label : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className={cn(collapsed && !mobile && 'sr-only')}>{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Settings & Logout */}
      <div className={cn('space-y-2 border-t border-border/70', mobile ? 'px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]' : collapsed ? 'p-3' : 'p-4')}>
        {onToggleCollapse && !mobile ? (
          <Button
            onClick={onToggleCollapse}
            variant="outline"
            className={cn('w-full justify-start gap-3 rounded-2xl border-border/70 bg-background/80 font-medium hover:bg-background', collapsed && 'justify-center px-0')}
            title={collapsed ? 'Expand sidebar' : 'Minimize sidebar'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            <span className={cn(collapsed && 'sr-only')}>{collapsed ? 'Expand' : 'Minimize'}</span>
          </Button>
        ) : null}
        <Button
          onClick={handleLogout}
          className={cn('w-full justify-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 font-medium text-destructive hover:bg-destructive/10', collapsed && 'justify-center px-0')}
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
          <span className={cn(collapsed && 'sr-only')}>Logout</span>
        </Button>
      </div>
    </aside>
  )
}