'use client'

import { useEffect, useState } from 'react'
import { Bell, Menu, LogOut, Lock, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { getDashboardRouteForRole } from '@/lib/dashboard/routes'

interface NavbarProps {
  role?: string
  userName: string
  userEmail: string
  title?: string
  onChangePassword?: () => void
  onMenuClick?: () => void
}

export function Navbar({ role, userName, userEmail, title = 'Dashboard', onChangePassword, onMenuClick }: NavbarProps) {
  const router = useRouter()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const dashboardBase = getDashboardRouteForRole(role)
  const profileSettingsHref = role === 'salesman' ? '/salesman/dashboard/settings' : dashboardBase ? `${dashboardBase}/settings` : '/settings'
  const securitySettingsHref = role === 'salesman' ? '/salesman/dashboard/settings?tab=security' : dashboardBase ? `${dashboardBase}/settings?tab=security` : '/settings?tab=security'

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const notifications = [
    { id: 1, message: 'Stock level low for Product A', time: '5m ago' },
    { id: 2, message: 'New sale order received', time: '15m ago' },
  ]

  return (
    <nav className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/70 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="md:hidden shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="hidden text-xs uppercase tracking-[0.25em] text-muted-foreground sm:block">Workspace</p>
          <h2 className="max-w-36 truncate text-[1.35rem] font-semibold tracking-tight leading-tight sm:max-w-none sm:text-xl">
            {title}
          </h2>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 sm:gap-3">
        {mounted ? (
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 border-border/70 bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground sm:h-10 sm:w-10"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        ) : null}

        {/* Notifications */}
        <DropdownMenu open={notificationsOpen} onOpenChange={setNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 text-muted-foreground hover:text-foreground sm:h-10 sm:w-10"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500"></span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 border-border/70 bg-background/95 backdrop-blur-xl">
            <div className="px-4 py-2 font-semibold">Notifications</div>
            <DropdownMenuSeparator className="bg-border/70" />
            {notifications.length > 0 ? (
              notifications.map(notif => (
                <DropdownMenuItem key={notif.id} className="flex flex-col cursor-default py-3 hover:bg-accent/60">
                  <p>{notif.message}</p>
                  <p className="text-xs text-muted-foreground">{notif.time}</p>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled className="py-4 text-center text-muted-foreground">
                No notifications
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex h-9 items-center gap-2 rounded-2xl border border-border/70 bg-background/80 pl-2 pr-3 backdrop-blur hover:bg-background sm:h-10 sm:gap-3 sm:pl-2.5 sm:pr-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-linear-to-br from-slate-950 to-slate-700 text-xs font-semibold text-white">
                  {userName
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-border/70 bg-background/95 backdrop-blur-xl">
            <DropdownMenuItem
              onClick={() => router.push(profileSettingsHref)}
              className="cursor-pointer hover:bg-accent/60"
            >
              <Lock className="mr-2 h-4 w-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push(securitySettingsHref)}
              className="cursor-pointer hover:bg-accent/60"
            >
              Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/70" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-destructive hover:bg-destructive/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}