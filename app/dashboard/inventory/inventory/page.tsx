'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, FileText, AlertTriangle, Loader2, Package, RefreshCcw, RotateCcw, Search, ShieldAlert, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseClient } from '@/lib/supabase/client'
import { InventoryPageShell } from '@/components/dashboard/inventory-page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const SEARCH_DEBOUNCE_MS = 300
const RESTOCK_PRESET = 10

type CategoryRow = { id: string; name: string }

type InventoryRow = {
  id: string
  name: string
  category_id: string
  category_name: string
  quantity: number
  reorder_level: number
  updated_at: string | null
  last_restocked: string | null
  warehouse_location: string | null
  stock_status: 'out' | 'low' | 'healthy'
}

type InventoryApiResponse = {
  items: InventoryRow[]
  categories: CategoryRow[]
}

type SortOption = 'low-stock-asc' | 'stock-asc' | 'stock-desc' | 'name-asc' | 'restocked-desc'

type RestockFormState = {
  quantity: string
  warehouse_location: string
}

type LogRow = {
  id: string
  item_id: string
  action: string
  quantity_changed: number
  old_quantity: number | null
  new_quantity: number | null
  performed_by: string
  created_at: string
}

type LogDisplayRow = LogRow & {
  item_name: string
  performed_by_name: string
}

function formatRelativeOrDate(value: string | null) {
  if (!value) return 'Never'

  const date = new Date(value)
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000)

  if (diffMinutes < 60) {
    return `${Math.max(diffMinutes, 1)} minute${diffMinutes === 1 ? '' : 's'} ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusDetails(item: InventoryRow) {
  if (item.quantity === 0) {
    return { label: 'Out of Stock', variant: 'destructive' as const, toneClass: 'text-red-600', barClass: 'bg-red-500' }
  }

  if (item.quantity <= item.reorder_level) {
    return { label: 'Low Stock', variant: 'secondary' as const, toneClass: 'text-amber-700 dark:text-amber-300', barClass: 'bg-amber-500' }
  }

  return { label: 'Healthy', variant: 'default' as const, toneClass: 'text-emerald-600', barClass: 'bg-emerald-500' }
}

function getProgressTone(value: number) {
  if (value === 0) return 'bg-red-500'
  if (value < 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function getActionLabel(action: string) {
  switch (action) {
    case 'sale':
      return 'Sale'
    case 'restock':
      return 'Restock'
    case 'return':
      return 'Return'
    case 'cancel':
      return 'Cancel'
    default:
      return action
  }
}

export default function InventoryManagerInventoryPage() {
  const [items, setItems] = useState<InventoryRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [sort, setSort] = useState<SortOption>('low-stock-asc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restockTarget, setRestockTarget] = useState<InventoryRow | null>(null)
  const [restockForm, setRestockForm] = useState<RestockFormState>({ quantity: String(RESTOCK_PRESET), warehouse_location: '' })
  const [restocking, setRestocking] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logs, setLogs] = useState<LogDisplayRow[]>([])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const loadInventory = async (query = search, filterCategory = categoryFilter, lowOnly = lowStockOnly, sortValue = sort) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/inventory?search=${encodeURIComponent(query)}&categoryId=${encodeURIComponent(filterCategory === 'all' ? '' : filterCategory)}&lowStockOnly=${lowOnly ? 'true' : 'false'}&sort=${encodeURIComponent(sortValue)}`,
      )
      const data = (await response.json()) as InventoryApiResponse & { error?: string }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load inventory')
      }

      setItems(data.items || [])
      setCategories(data.categories || [])
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load inventory'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInventory(search, categoryFilter, lowStockOnly, sort)
  }, [search, categoryFilter, lowStockOnly, sort])

  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel('inventory-manager-inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        void loadInventory(search, categoryFilter, lowStockOnly, sort)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [search, categoryFilter, lowStockOnly, sort])

  const lowStockItems = useMemo(() => items.filter(item => item.quantity <= item.reorder_level), [items])
  const visibleCategories = categories.length > 0 ? categories : []

  const summary = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        accumulator.totalStock += item.quantity

        if (item.stock_status === 'out') {
          accumulator.out += 1
        } else if (item.stock_status === 'low') {
          accumulator.low += 1
        } else {
          accumulator.healthy += 1
        }

        return accumulator
      },
      { healthy: 0, low: 0, out: 0, totalStock: 0 },
    )
  }, [items])

  const openRestock = (item: InventoryRow) => {
    setRestockTarget(item)
    setRestockForm({ quantity: String(RESTOCK_PRESET), warehouse_location: item.warehouse_location || '' })
  }

  const submitRestock = async () => {
    if (!restockTarget) return

    const quantity = Number(restockForm.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Quantity must be positive')
      return
    }

    setRestocking(true)
    try {
      const supabase = getSupabaseClient()
      const { data: authData } = await supabase.auth.getUser()
      const performedBy = authData.user?.id

      if (!performedBy) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: restockTarget.id,
          quantity,
          performed_by: performedBy,
          location: restockForm.warehouse_location,
        }),
      })

      const data = await response.json().catch(() => ({})) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to restock item')
      }

      toast.success('Stock updated')
      setRestockTarget(null)
      await loadInventory(search, categoryFilter, lowStockOnly, sort)
    } catch (restockError) {
      toast.error(restockError instanceof Error ? restockError.message : 'Failed to restock item')
    } finally {
      setRestocking(false)
    }
  }

  const loadLogs = async () => {
    setLogsLoading(true)

    try {
      const supabase = getSupabaseClient()
      const { data: logData, error: logError } = await supabase
        .from('inventory_logs')
        .select('id, item_id, action, quantity_changed, old_quantity, new_quantity, performed_by, created_at')
        .order('created_at', { ascending: false })
        .limit(12)

      if (logError) {
        throw logError
      }

      const rows = (logData as LogRow[]) || []
      const performerIds = Array.from(new Set(rows.map(row => row.performed_by)))

      const { data: performerData, error: performerError } = performerIds.length > 0
        ? await supabase.from('users').select('id, full_name').in('id', performerIds)
        : { data: [], error: null }

      if (performerError) {
        throw performerError
      }

      const itemNameById = new Map(items.map(item => [item.id, item.name]))
      const performerNameById = new Map(((performerData as { id: string; full_name: string }[]) || []).map(user => [user.id, user.full_name]))

      setLogs(
        rows.map(row => ({
          ...row,
          item_name: itemNameById.get(row.item_id) || 'Unknown item',
          performed_by_name: performerNameById.get(row.performed_by) || 'System',
        })),
      )
    } catch (logsError) {
      toast.error(logsError instanceof Error ? logsError.message : 'Failed to load inventory logs')
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    if (logsOpen) {
      void loadLogs()
    }
  }, [logsOpen, items])

  return (
    <InventoryPageShell
      badge={<><Package className="h-4 w-4 text-cyan-500" /> Inventory control</>}
      title="Inventory Management"
      description="Monitor and control stock levels, restock low items, and review inventory movements in real time."
      actions={
        <>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              placeholder="Search inventory"
              className="h-11 pl-10"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11 w-full sm:w-56">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {visibleCategories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex h-11 items-center gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 text-sm backdrop-blur">
            <Checkbox checked={lowStockOnly} onCheckedChange={checked => setLowStockOnly(Boolean(checked))} />
            Show only low stock
          </label>

          <Select value={sort} onValueChange={value => setSort(value as SortOption)}>
            <SelectTrigger className="h-11 w-full sm:w-56">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low-stock-asc">Stock Low → High</SelectItem>
              <SelectItem value="stock-desc">Stock High → Low</SelectItem>
              <SelectItem value="name-asc">Name A → Z</SelectItem>
              <SelectItem value="restocked-desc">Last Restocked</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="h-11 border-border/70 bg-background/80" onClick={() => void loadInventory(search, categoryFilter, lowStockOnly, sort)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button variant="outline" className="h-11 border-border/70 bg-background/80" onClick={() => setLogsOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            View Logs
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Healthy</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-emerald-600">{summary.healthy}</div>
                <p className="mt-1 text-sm text-green-600">▲ 0% from last month</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Low Stock</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-amber-600">{summary.low}</div>
                <p className="mt-1 text-sm text-amber-600">▼ 0% from last month</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Out of Stock</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-red-600">{summary.out}</div>
                <p className="mt-1 text-sm text-red-600">▼ 0% from last month</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/10">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Units</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight">{summary.totalStock}</div>
                <p className="mt-1 text-sm text-muted-foreground">Overview of total units</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
                <Package className="h-5 w-5 text-cyan-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-transparent bg-white/60 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Validation Issues</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-3xl font-semibold tracking-tight text-foreground">{lowStockItems.length}</div>
                <p className="mt-1 text-sm text-red-600">▼ 0% from last month</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <FileText className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-white/60 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Valid Items</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-3xl font-semibold tracking-tight text-foreground">{summary.healthy}</div>
                <p className="mt-1 text-sm text-emerald-600">▲ 0% from last month</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-white/60 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Critical Alerts</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-3xl font-semibold tracking-tight text-foreground">{summary.out}</div>
                <p className="mt-1 text-sm text-red-600">▼ 0% from last month</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-white/60 shadow-sm">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Tracked Items</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-3xl font-semibold tracking-tight text-foreground">{items.length}</div>
                <p className="mt-1 text-sm text-emerald-600">▲ 0% from last month</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <RotateCcw className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-background/75 backdrop-blur">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low stock watchlist
            </div>
            <div className="grid gap-2">
              {lowStockItems.length > 0 ? (
                lowStockItems.slice(0, 4).map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-50/80 px-4 py-3 text-sm dark:bg-red-950/20">
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-muted-foreground">{item.quantity} in stock, reorder at {item.reorder_level}</p>
                    </div>
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {item.stock_status === 'out' ? 'Out' : 'Low'}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                  No low stock items in the current filter set.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock3 className="h-4 w-4 text-cyan-500" />
              Activity snapshot
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <p className="text-muted-foreground">Category filter</p>
                <p className="mt-1 font-medium">{categoryFilter === 'all' ? 'All categories' : categories.find(category => category.id === categoryFilter)?.name || 'Selected category'}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <p className="text-muted-foreground">Search</p>
                <p className="mt-1 truncate font-medium">{search || 'No search term'}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <p className="text-muted-foreground">Low stock filter</p>
                <p className="mt-1 font-medium">{lowStockOnly ? 'Enabled' : 'Disabled'}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                <p className="text-muted-foreground">Sort</p>
                <p className="mt-1 font-medium">{sort === 'low-stock-asc' ? 'Stock low → high' : sort === 'stock-desc' ? 'Stock high → low' : sort === 'name-asc' ? 'Name A → Z' : 'Last restocked'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 bg-background/75 shadow-sm backdrop-blur">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4 sm:p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid gap-4 rounded-2xl border border-border/60 p-4 xl:grid-cols-[1.5fr_1fr_1fr_0.9fr_1fr_1.1fr_1fr_0.9fr]">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-28 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Unable to load inventory</h2>
                <p className="max-w-md text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={() => void loadInventory(search, categoryFilter, lowStockOnly, sort)} variant="outline">
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Package className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">No inventory data found</h2>
                <p className="max-w-md text-sm text-muted-foreground">Adjust your filters or refresh to see inventory rows.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="px-4 py-3 font-semibold">Item Name</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Category</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Current Stock</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Reorder Level</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Stock Status</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Warehouse Location</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Last Restocked</TableHead>
                  <TableHead className="px-4 py-3 text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => {
                  const status = getStatusDetails(item)
                  const lowStock = item.quantity <= item.reorder_level
                  const progressValue = Math.min((item.quantity / Math.max(item.reorder_level, 1)) * 100, 100)

                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        'transition-colors',
                        lowStock ? 'border-l-4 border-l-red-500 bg-red-50/80 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/25' : 'hover:bg-muted/80',
                      )}
                    >
                      <TableCell className="px-4 py-3 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-cyan-500" />
                            <p className="font-medium text-foreground">{item.name}</p>
                            {lowStock ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Alert
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">{item.stock_status === 'out' ? 'Critical attention needed' : 'Monitored by inventory manager'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">{item.category_name}</TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className={cn('text-lg font-semibold tracking-tight', status.toneClass)}>{item.quantity}</span>
                            <span className="text-sm text-muted-foreground">/ {item.reorder_level}</span>
                          </div>
                          <Progress value={progressValue} className={cn('h-2 [&>div]:transition-all', `bg-muted`,)} />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={cn('h-2 w-2 rounded-full', getProgressTone(progressValue))} />
                            Stock: {item.quantity} / {item.reorder_level}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">{item.reorder_level}</TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <Badge
                          variant={status.variant}
                          className={cn(
                            'gap-1',
                            status.variant === 'secondary' ? 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/15' : undefined,
                          )}
                        >
                          {item.stock_status === 'out' ? <ShieldAlert className="h-3.5 w-3.5" /> : null}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">{item.warehouse_location || 'Not assigned'}</TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">{formatRelativeOrDate(item.last_restocked || item.updated_at)}</TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-border/70 bg-background/80"
                            onClick={() => openRestock(item)}
                          >
                            <Truck className="mr-1 h-4 w-4" />
                            Restock
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-background hover:text-foreground"
                            onClick={() => {
                              setLogsOpen(true)
                            }}
                            aria-label={`View logs for ${item.name}`}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(restockTarget)}
        onOpenChange={value => {
          if (!value) {
            setRestockTarget(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-140 border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Restock Item</DialogTitle>
            <DialogDescription>
              Add quantity to the selected item and create an inventory log entry.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Item</Label>
              <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
                {restockTarget?.name || 'Selected item'}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="restock-quantity">Quantity to add</Label>
                <Input
                  id="restock-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={restockForm.quantity}
                  onChange={event => setRestockForm(previous => ({ ...previous, quantity: event.target.value }))}
                  placeholder="Enter quantity"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="restock-location">Warehouse location</Label>
                <Input
                  id="restock-location"
                  value={restockForm.warehouse_location}
                  onChange={event => setRestockForm(previous => ({ ...previous, warehouse_location: event.target.value }))}
                  placeholder="Warehouse A"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockTarget(null)} disabled={restocking}>
              Cancel
            </Button>
            <Button className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={() => void submitRestock()} disabled={restocking}>
              {restocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {restocking ? 'Saving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={logsOpen}
        onOpenChange={value => {
          setLogsOpen(value)
        }}
      >
        <DialogContent className="sm:max-w-6xl border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Inventory Logs</DialogTitle>
            <DialogDescription>
              Track sale, restock, and return movements from the same control panel.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-hidden rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Action</TableHead>
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold">Quantity</TableHead>
                  <TableHead className="font-semibold">Old → New</TableHead>
                  <TableHead className="font-semibold">Performed By</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Loading logs...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No recent inventory logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{getActionLabel(log.action)}</TableCell>
                      <TableCell>{log.item_name}</TableCell>
                      <TableCell>{log.quantity_changed}</TableCell>
                      <TableCell>
                        {log.old_quantity ?? 'N/A'} → {log.new_quantity ?? 'N/A'}
                      </TableCell>
                      <TableCell>{log.performed_by_name}</TableCell>
                      <TableCell>{formatRelativeOrDate(log.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </InventoryPageShell>
  )
}
