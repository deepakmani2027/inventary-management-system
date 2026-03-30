'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Loader2,
  Package,
  Search,
  Sparkles,
  RotateCcw,
  Truck,
} from 'lucide-react'

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

type SortOption = 'low-stock-asc' | 'stock-asc' | 'stock-desc' | 'name-asc' | 'updated-desc'

type RestockFormState = {
  quantity: string
  warehouse_location: string
}

function formatRelativeOrDate(value: string | null) {
  if (!value) return 'Never'

  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

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
    return { label: 'Out of Stock', tone: 'destructive' as const, percent: 0, barClass: 'bg-red-500' }
  }

  if (item.quantity <= item.reorder_level) {
    return { label: 'Low Stock', tone: 'secondary' as const, percent: Math.min((item.quantity / Math.max(item.reorder_level, 1)) * 100, 100), barClass: 'bg-amber-500' }
  }

  return { label: 'Healthy', tone: 'default' as const, percent: Math.min((item.quantity / Math.max(item.reorder_level, 1)) * 100, 100), barClass: 'bg-emerald-500' }
}

export default function AdminInventoryPage() {
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
    loadInventory(search, categoryFilter, lowStockOnly, sort)
  }, [search, categoryFilter, lowStockOnly, sort])

  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel('admin-inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        loadInventory(search, categoryFilter, lowStockOnly, sort)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [search, categoryFilter, lowStockOnly, sort])

  const totals = useMemo(() => {
    const summary = { healthy: 0, low: 0, out: 0 }
    for (const item of items) {
      if (item.stock_status === 'out') summary.out += 1
      else if (item.stock_status === 'low') summary.low += 1
      else summary.healthy += 1
    }
    return summary
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

      toast.success('Restock completed')
      setRestockTarget(null)
      await loadInventory(search, categoryFilter, lowStockOnly, sort)
    } catch (restockError) {
      toast.error(restockError instanceof Error ? restockError.message : 'Failed to restock item')
    } finally {
      setRestocking(false)
    }
  }

  const visibleCategories = categories.length > 0 ? categories : []

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-background via-card/70 to-background p-6 shadow-2xl shadow-slate-950/10 backdrop-blur sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              Real-time inventory control
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Inventory</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Track stock levels, identify low inventory immediately, and restock without leaving the page.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
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
                <SelectItem value="updated-desc">Last Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Healthy</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{totals.healthy}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Low Stock</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">{totals.low}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Out of Stock</p>
            <p className="mt-1 text-2xl font-semibold text-red-600">{totals.out}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 bg-background/75 shadow-sm backdrop-blur">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4 sm:p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[1.5fr_1fr_0.8fr_0.8fr_1fr_1fr_0.8fr] gap-4 rounded-2xl border border-border/60 p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
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
              <Button onClick={() => loadInventory(search, categoryFilter, lowStockOnly, sort)} variant="outline">
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
                <p className="max-w-md text-sm text-muted-foreground">Adjust your filters or add items to see inventory here.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="px-4 py-3 font-semibold">Item Name</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Category</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Stock Quantity</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Reorder Level</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Stock Status</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Last Updated</TableHead>
                  <TableHead className="px-4 py-3 text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => {
                  const status = getStatusDetails(item)
                  const lowStock = item.quantity <= item.reorder_level
                  const progressValue = Math.min((item.quantity / Math.max(item.reorder_level, 1)) * 100, 100)
                  const progressTone = progressValue < 30 ? 'bg-red-500' : progressValue <= 70 ? 'bg-amber-500' : 'bg-emerald-500'

                  return (
                    <TableRow
                      key={item.id}
                      className={lowStock ? 'border-l-4 border-l-red-500 bg-red-50/80 hover:bg-red-50' : 'hover:bg-muted/80'}
                    >
                      <TableCell className="px-4 py-3 align-top">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.warehouse_location || 'No warehouse location'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">{item.category_name}</TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-foreground">{item.quantity}</span>
                            {lowStock ? <Badge variant="destructive">Low Stock</Badge> : null}
                          </div>
                          <Progress value={progressValue} className="h-2 [&>div]:transition-all" />
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={`h-2 w-2 rounded-full ${progressTone}`} />
                            {item.quantity} / {item.reorder_level}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">{item.reorder_level}</TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <Badge
                          variant={status.tone}
                          className={status.tone === 'secondary' ? 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/15' : undefined}
                        >
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">
                        {formatRelativeOrDate(item.last_restocked || item.updated_at)}
                      </TableCell>
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
                            onClick={() => openRestock(item)}
                            aria-label={`Restock ${item.name}`}
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
        <DialogContent className="max-w-125 border-border/70 bg-background/95 backdrop-blur-xl">
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
                  onChange={e => setRestockForm(previous => ({ ...previous, quantity: e.target.value }))}
                  placeholder="Enter quantity"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="restock-location">Warehouse location</Label>
                <Input
                  id="restock-location"
                  value={restockForm.warehouse_location}
                  onChange={e => setRestockForm(previous => ({ ...previous, warehouse_location: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockTarget(null)} disabled={restocking}>
              Cancel
            </Button>
            <Button className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={submitRestock} disabled={restocking}>
              {restocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {restocking ? 'Saving...' : 'Restock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
