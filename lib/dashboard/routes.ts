import {
  BarChart3,
  Bell,
  ClipboardList,
  HelpCircle,
  Layers3,
  LayoutDashboard,
  Package,
  Percent,
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

export type DashboardRole = 'admin' | 'salesman' | 'inventory_manager' | 'sales_manager'

export type DashboardPathRole = 'admin' | 'salesman' | 'inventory' | 'sales-manager'

export type DashboardIconName =
  | 'layout-dashboard'
  | 'users'
  | 'layers'
  | 'package'
  | 'square-stack'
  | 'settings'
  | 'receipt'
  | 'clipboard-list'
  | 'rotate-ccw'
  | 'bell'
  | 'help-circle'
  | 'truck'
  | 'zap'
  | 'target'
  | 'bar-chart'
  | 'user-cog'

export type DashboardLink = {
  href: string
  label: string
  iconName: DashboardIconName
}

export const dashboardRouteByRole: Record<DashboardRole, string> = {
  admin: '/admin/dashboard',
  salesman: '/salesman/dashboard',
  inventory_manager: '/inventory/dashboard',
  sales_manager: '/sales-manager/dashboard',
}

export const dashboardSegmentByRole: Record<DashboardRole, DashboardPathRole> = {
  admin: 'admin',
  salesman: 'salesman',
  inventory_manager: 'inventory',
  sales_manager: 'sales-manager',
}

export const roleByDashboardSegment: Record<DashboardPathRole, DashboardRole> = {
  admin: 'admin',
  salesman: 'salesman',
  inventory: 'inventory_manager',
  'sales-manager': 'sales_manager',
}

export function getDashboardRouteForRole(role?: string | null) {
  if (!role) return null
  return dashboardRouteByRole[role as DashboardRole] || null
}

export function getDashboardSegmentForRole(role?: string | null) {
  if (!role) return null
  return dashboardSegmentByRole[role as DashboardRole] || null
}

export function getRoleFromDashboardPath(segment?: string | null) {
  if (!segment) return null
  return roleByDashboardSegment[segment as DashboardPathRole] || null
}

export function getSidebarLinksForRole(role: DashboardRole) {
  switch (role) {
    case 'admin':
      return [
        { href: '/admin/dashboard', label: 'Dashboard', iconName: 'layout-dashboard' },
        { href: '/admin/dashboard/users', label: 'Users', iconName: 'users' },
        { href: '/admin/dashboard/categories', label: 'Categories', iconName: 'layers' },
        { href: '/admin/dashboard/items', label: 'Items', iconName: 'package' },
        { href: '/admin/dashboard/inventory', label: 'Inventory', iconName: 'square-stack' },
        { href: '/admin/dashboard/settings', label: 'Settings', iconName: 'settings' },
      ] as DashboardLink[]
    case 'salesman':
      return [
        { href: '/salesman/dashboard', label: 'Dashboard', iconName: 'layout-dashboard' },
        { href: '/salesman/dashboard/inventory', label: 'Inventory', iconName: 'package' },
        { href: '/salesman/dashboard/create-bill', label: 'Create Bill', iconName: 'receipt' },
        { href: '/salesman/dashboard/sales-history', label: 'Sales History', iconName: 'clipboard-list' },
        { href: '/salesman/dashboard/returns', label: 'Returns', iconName: 'rotate-ccw' },
        { href: '/salesman/dashboard/notifications', label: 'Notifications', iconName: 'bell' },
        { href: '/salesman/dashboard/help', label: 'Help', iconName: 'help-circle' },
      ] as DashboardLink[]
    case 'inventory_manager':
      return [
        { href: '/inventory/dashboard', label: 'Dashboard', iconName: 'layout-dashboard' },
        { href: '/inventory/dashboard/inventory', label: 'Inventory', iconName: 'package' },
        { href: '/inventory/dashboard/restock', label: 'Restock', iconName: 'truck' },
        { href: '/inventory/dashboard/low-stock', label: 'Low Stock', iconName: 'zap' },
        { href: '/inventory/dashboard/validation', label: 'Validation', iconName: 'target' },
        { href: '/inventory/dashboard/reports', label: 'Reports', iconName: 'bar-chart' },
        { href: '/inventory/dashboard/trends', label: 'Trends', iconName: 'bar-chart' },
      ] as DashboardLink[]
    case 'sales_manager':
      return [
        { href: '/sales-manager/dashboard', label: 'Dashboard', iconName: 'layout-dashboard' },
        { href: '/sales-manager/dashboard/analytics', label: 'Analytics', iconName: 'bar-chart' },
        { href: '/sales-manager/dashboard/reports', label: 'Reports', iconName: 'receipt' },
        { href: '/sales-manager/dashboard/exceptions', label: 'Exceptions', iconName: 'user-cog' },
        { href: '/sales-manager/dashboard/trends', label: 'Trends', iconName: 'bar-chart' },
      ] as DashboardLink[]
  }
}
