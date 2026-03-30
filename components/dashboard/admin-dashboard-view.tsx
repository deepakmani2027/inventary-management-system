'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { StatCard } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, Clock3, Layers3, Package, Shield, Sparkles, Users, Warehouse } from 'lucide-react'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type ItemRow = {
  id: string
  name: string
  category_id: string
  unit_price: number
  reorder_level: number
}

type InventoryRow = {
  item_id: string
  quantity: number
}

type CategoryRow = { id: string; name: string }
type UserRow = { id: string; email: string; full_name: string; role: string; created_at: string }
type CategoryApiRow = { id: string; name: string }
type ItemApiRow = {
  id: string
  name: string
  category_id: string
  unit_price: number
  reorder_level: number
  stock: number
}
type InventoryApiRow = {
  id: string
  name: string
  category_id: string
  category_name: string
  quantity: number
  reorder_level: number
  stock_status: 'out' | 'low' | 'healthy'
}

interface AdminDashboardViewProps {
  basePath: string
}

export function AdminDashboardView({ basePath }: AdminDashboardViewProps) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [usersResponse, categoriesResponse, itemsResponse, inventoryResponse] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/admin/categories'),
          fetch('/api/admin/items'),
          fetch('/api/admin/inventory'),
        ])

        const [usersData, categoriesData, itemsData, inventoryData] = await Promise.all([
          usersResponse.json() as Promise<{ users?: UserRow[]; error?: string }>,
          categoriesResponse.json() as Promise<{ categories?: CategoryApiRow[]; error?: string }>,
          itemsResponse.json() as Promise<{ items?: ItemApiRow[]; error?: string }>,
          inventoryResponse.json() as Promise<{ items?: InventoryApiRow[]; error?: string }>,
        ])

        if (!usersResponse.ok) throw new Error(usersData.error || 'Failed to load users')
        if (!categoriesResponse.ok) throw new Error(categoriesData.error || 'Failed to load categories')
        if (!itemsResponse.ok) throw new Error(itemsData.error || 'Failed to load items')
        if (!inventoryResponse.ok) throw new Error(inventoryData.error || 'Failed to load inventory')

        setUsers(usersData.users || [])
        setCategories(categoriesData.categories || [])
        setItems((itemsData.items || []).map(item => ({
          id: item.id,
          name: item.name,
          category_id: item.category_id,
          unit_price: item.unit_price,
          reorder_level: item.reorder_level,
        })))
        setInventory((inventoryData.items || []).map(item => ({
          item_id: item.id,
          quantity: item.quantity,
        })))
      } catch (loadError) {
        console.error(loadError)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const inventoryByItem = useMemo(
    () => new Map(inventory.map(row => [row.item_id, row.quantity])),
    [inventory]
  )

  const lowStockItems = useMemo(
    () => items.filter(item => (inventoryByItem.get(item.id) || 0) <= item.reorder_level),
    [items, inventoryByItem]
  )

  const emptyCategories = useMemo(
    () => categories.filter(category => items.every(item => item.category_id !== category.id)),
    [categories, items]
  )

  const healthyItems = useMemo(
    () => items.filter(item => (inventoryByItem.get(item.id) || 0) > item.reorder_level).length,
    [items, inventoryByItem]
  )

  const stockHealth = items.length === 0 ? 0 : Math.round((healthyItems / items.length) * 100)
  const catalogCoverage = categories.length === 0 ? 0 : Math.round(((categories.length - emptyCategories.length) / categories.length) * 100)

  const chartData = useMemo(
    () => categories.map(category => {
      const categoryItems = items.filter(item => item.category_id === category.id)
      return {
        name: category.name,
        items: categoryItems.length,
        stock: categoryItems.reduce((sum, item) => sum + (inventoryByItem.get(item.id) || 0), 0),
      }
    }),
    [categories, items, inventoryByItem]
  )

  const hasDashboardData = categories.length > 0 || items.length > 0 || users.length > 0

  const quickActions = [
    { href: `${basePath}/users`, label: 'Manage Users', description: 'Create, edit, and review access', icon: Users },
    { href: `${basePath}/categories`, label: 'Edit Categories', description: 'Organize product groups', icon: Layers3 },
    { href: `${basePath}/items`, label: 'Manage Items', description: 'Adjust pricing and stock rules', icon: Package },
    { href: `${basePath}/inventory`, label: 'Inspect Inventory', description: 'Track low stock in real time', icon: Shield },
  ]

  const highlights = [
    { label: 'Stock health', value: `${stockHealth}%`, description: `${healthyItems} items above reorder level`, icon: CheckCircle2 },
    { label: 'Catalog coverage', value: `${catalogCoverage}%`, description: `${categories.length - emptyCategories.length} active categories`, icon: Warehouse },
    { label: 'Inventory watchlist', value: `${lowStockItems.length}`, description: lowStockItems.length === 1 ? 'item needs attention' : 'items need attention', icon: Clock3 },
  ]

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-background via-card/70 to-background p-6 shadow-2xl shadow-slate-950/10 sm:p-8 backdrop-blur">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.10),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              Admin panel for users, items, categories, and inventory
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
                Admin Command Center
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Monitor stock health, manage accounts, and keep the catalog clean from a single dashboard.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
              <Link href={`${basePath}/users`}>
                Open Users
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-border/70 bg-background/70 backdrop-blur">
              <Link href={`${basePath}/items`}>Manage Items</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={users.length} icon={Users} subtext="Live snapshot" />
        <StatCard label="Total Items" value={items.length} icon={Package} subtext="Live snapshot" />
        <StatCard label="Total Categories" value={categories.length} icon={Layers3} subtext="Live snapshot" />
        <StatCard label="Low Stock Items" value={lowStockItems.length} icon={AlertTriangle} subtext="Items that need attention" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {highlights.map(highlight => {
          const Icon = highlight.icon
          return (
            <Card key={highlight.label} className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
              <CardContent className="flex items-start gap-4 pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/15">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">{highlight.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{highlight.value}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{highlight.description}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-border/70 bg-background/75 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-500" />
              Category Stock Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasDashboardData ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.96)',
                        border: '1px solid rgba(148, 163, 184, 0.18)',
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="items" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="stock" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-background/60 px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/15">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <p className="text-base font-semibold">No inventory activity yet</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Add your first categories and items to populate stock distribution, recent activity, and low-stock insights.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Button asChild variant="outline" className="border-border/70 bg-background/80">
                    <Link href={`${basePath}/categories`}>Create categories</Link>
                  </Button>
                  <Button asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white">
                    <Link href={`${basePath}/items`}>Add items</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-linear-to-b from-amber-400/10 to-background/70 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map(action => {
              const Icon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-start gap-4 rounded-2xl border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-lg"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 ring-1 ring-inset ring-cyan-500/20">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                      {action.label}
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-500" />
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{action.description}</span>
                  </span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70 bg-background/75 backdrop-blur">
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              title="Latest Accounts"
              pageSize={5}
              columns={[
                { key: 'full_name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'role', label: 'Role', render: value => <span className="capitalize">{String(value).replace('_', ' ')}</span> },
                { key: 'created_at', label: 'Joined', render: value => new Date(String(value)).toLocaleDateString() },
              ]}
              data={users.slice(0, 5)}
              loading={loading}
              emptyMessage="No users yet"
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/75 backdrop-blur">
          <CardHeader>
            <CardTitle>Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockItems.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700">
                No low stock items right now.
              </div>
            ) : (
              lowStockItems.slice(0, 6).map(item => {
                const quantity = inventoryByItem.get(item.id) || 0
                return (
                  <div key={item.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Reorder level: {item.reorder_level}</p>
                      </div>
                      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-700">
                        {quantity} in stock
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}