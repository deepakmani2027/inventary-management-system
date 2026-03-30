'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { Navbar } from './navbar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { DashboardLink } from '@/lib/dashboard/routes'

interface DashboardLayoutProps {
  children: React.ReactNode
  role: string
  title?: string
  userName: string
  userEmail: string
  sidebarLinks: DashboardLink[]
}

export function DashboardLayout({
  children,
  role,
  title = 'Dashboard',
  userName,
  userEmail,
  sidebarLinks,
}: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    const storedValue = window.localStorage.getItem('dashboard-sidebar-collapsed')
    if (storedValue) {
      setSidebarCollapsed(storedValue === 'true')
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('dashboard-sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-48 -top-40 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute -right-40 top-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-48 left-[32%] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative flex h-full min-h-0">
        {/* Desktop Sidebar */}
        <Sidebar
          role={role}
          links={sidebarLinks}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        />

        {/* Mobile Sidebar */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" title="Sidebar" className="w-[88vw] max-w-88 border-border bg-background/95 p-0 backdrop-blur-xl">
            <Sidebar role={role} links={sidebarLinks} mobile />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className={sidebarCollapsed ? 'flex min-w-0 flex-1 flex-col md:pl-20' : 'flex min-w-0 flex-1 flex-col md:pl-72'}>
          <Navbar
            role={role}
            title={title}
            userName={userName}
            userEmail={userEmail}
            onMenuClick={() => setMobileMenuOpen(true)}
          />
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}