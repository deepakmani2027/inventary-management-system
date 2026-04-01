'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Package, RefreshCcw, Search, ShieldAlert, Truck, Zap } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const RESTOCK_PRESET = 20
const SEARCH_DEBOUNCE_MS = 300

type InventoryRow = {
  id: string
  name: string
  category_name: string
  quantity: number
  reorder_level: number
  warehouse_location: string | null
  last_restocked: string | null
  updated_at: string | null
  stock_status: 'out' | 'low' | 'healthy'
}

type InventoryApiResponse = {
  items: InventoryRow[]
}

type RestockFormState = {
  quantity: string
  warehouse_location: string
  notes: string
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

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getStatus(item: InventoryRow) {
  if (item.quantity === 0) return { label: 'Out of Stock', tone: 'destructive' as const }
  if (item.quantity <= item.reorder_level) return { label: 'Low Stock', tone: 'secondary' as const }
  return { label: 'Healthy', tone: 'default' as const }
}

export default function LowStockPage() {
  const [items, setItems] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(true)
  const [restockTarget, setRestockTarget] = useState<InventoryRow | null>(null)
  const [restocking, setRestocking] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [recentItemId, setRecentItemId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Array<{ id: string; item_name: string; action: string; quantity_changed: number; old_quantity: number | null; new_quantity: number | null; performed_by_name: string; notes: string | null; created_at: string }>>([])
  const [form, setForm] = useState<RestockFormState>({ quantity: String(RESTOCK_PRESET), warehouse_location: 'Warehouse A', notes: '' })

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const load = async (query = search, lowOnly = lowStockOnly) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/inventory?includeLogs=true&search=${encodeURIComponent(query)}&lowStockOnly=${lowOnly ? 'true' : 'false'}&sort=low-stock-asc`,
      )
      const data = (await response.json()) as InventoryApiResponse & { logs?: any[]; error?: string }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load low stock items')
      }

      setItems(data.items || [])
      setLogs(data.logs || [])
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load low stock items'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(search, lowStockOnly)
  }, [search, lowStockOnly])

  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel('inventory-low-stock-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        void load(search, lowStockOnly)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_logs' }, () => {
        void load(search, lowStockOnly)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [search, lowStockOnly])

  const lowStockItems = useMemo(() => items.filter(item => item.quantity <= item.reorder_level), [items])
  const criticalItems = useMemo(() => items.filter(item => item.quantity === 0), [items])
  const stats = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        accumulator.low += item.quantity <= item.reorder_level ? 1 : 0
        accumulator.out += item.quantity === 0 ? 1 : 0
        accumulator.healthy += item.quantity > item.reorder_level ? 1 : 0
        return accumulator
      },
      { low: 0, out: 0, healthy: 0 },
    )
  }, [items])

  const openRestock = (item: InventoryRow) => {
    setRestockTarget(item)
    setForm({
      quantity: String(item.reorder_level * 2),
      warehouse_location: item.warehouse_location || 'Warehouse A',
      notes: '',
    })
  }

  const runRestock = async (item: InventoryRow, quantityValue: number) => {
    const supabase = getSupabaseClient()
    const { data: authData } = await supabase.auth.getUser()
    const performedBy = authData.user?.id

    if (!performedBy) throw new Error('Not authenticated')

    const { error } = await supabase.rpc('restock_item', {
      p_item_id: item.id,
      p_quantity: quantityValue,
      p_performed_by: performedBy,
      p_location: form.warehouse_location.trim() || null,
      p_notes: form.notes.trim() || null,
    })

    if (error) throw error

    if (item.quantity <= item.reorder_level) {
      await fetch('/api/admin/inventory/resolve-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, itemName: item.name }),
      })
    }
  }

  const submitRestock = async () => {
    if (!restockTarget) return

    const quantityValue = Number(form.quantity)
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    setRestocking(true)
    try {
      await runRestock(restockTarget, quantityValue)
      toast.success('Stock updated successfully')
      setRecentItemId(restockTarget.id)
      window.setTimeout(() => setRecentItemId(null), 2500)
      setRestockTarget(null)
      await load(search, lowStockOnly)
    } catch (restockError) {
      toast.error(restockError instanceof Error ? restockError.message : 'Failed to restock item')
    } finally {
      setRestocking(false)
    }
  }


  return (
    <InventoryPageShell
      badge={<><ShieldAlert className="h-4 w-4 text-cyan-500" /> Early warning system</>}
      title="Low Stock Radar"
      description="Track critical items, restock in one click, and clear low-stock alerts before they affect sales."
      actions={
        <>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search critical items" className="h-11 pl-10" />
          </div>
          <label className="flex h-11 items-center gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 text-sm backdrop-blur">
            <Checkbox checked={lowStockOnly} onCheckedChange={checked => setLowStockOnly(Boolean(checked))} />
            Show low stock only
          </label>
          <Button variant="outline" className="h-11 border-border/70 bg-background/80" onClick={() => void load(search, lowStockOnly)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" className="h-11 border-border/70 bg-background/80" onClick={() => setLogsOpen(true)}>
            <Clock3 className="mr-2 h-4 w-4" />
            Recent Logs
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Low Stock Items</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-amber-600">{lowStockItems.length}</div>
                <p className="mt-1 text-sm text-muted-foreground">Items flagged for restock</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Critical Items</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-red-600">{criticalItems.length}</div>
                <p className="mt-1 text-sm text-red-600">Out of stock</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/10">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Healthy</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-emerald-600">{stats.healthy}</div>
                <p className="mt-1 text-sm text-emerald-600">Items above reorder level</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Visible Low Stock</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-cyan-600">{stats.low}</div>
                <p className="mt-1 text-sm text-muted-foreground">Visible in current filters</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
                <Package className="h-5 w-5 text-cyan-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden border-border/70 bg-background/75 backdrop-blur">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-4 sm:p-6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-[auto_1.5fr_1fr_1fr_1fr_0.9fr] gap-4 rounded-2xl border border-border/60 p-4">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-28 rounded-full" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <h2 className="text-lg font-semibold">Unable to load low stock radar</h2>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button variant="outline" onClick={() => void load(search, lowStockOnly)}>Retry</Button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-semibold">No low stock items found</h2>
                  <p className="text-sm text-muted-foreground">Everything in the current view looks healthy.</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="px-4 py-3 font-semibold">Item</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">Current Stock</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">Reorder Level</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">Status</TableHead>
                    <TableHead className="px-4 py-3 text-right font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => {
                    const status = getStatus(item)
                    const progress = Math.min((item.quantity / Math.max(item.reorder_level, 1)) * 100, 100)
                    const highlighted = recentItemId === item.id

                    return (
                      <TableRow
                        key={item.id}
                        className={cn(
                          'transition-colors',
                          highlighted ? 'bg-cyan-500/10' : undefined,
                          item.quantity <= item.reorder_level ? 'border-l-4 border-l-red-500 bg-red-50/80 hover:bg-red-50 dark:bg-red-950/20' : 'hover:bg-muted/70',
                        )}
                      >
                        <TableCell className="px-4 py-3 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              <p className="font-medium text-foreground">{item.name}</p>
                              {item.quantity === 0 ? <Badge variant="destructive">Out of Stock</Badge> : <Badge variant="secondary">Low Stock</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">{item.category_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-semibold tracking-tight text-red-600">{item.quantity}</span>
                              <span className="text-sm text-muted-foreground">/ {item.reorder_level}</span>
                            </div>
                            <Progress value={progress} className="h-2 [&>div]:transition-all" />
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">{item.reorder_level}</TableCell>
                        <TableCell className="px-4 py-3 align-top">
                          <Badge variant={status.tone}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" className="border-border/70 bg-background/80" onClick={() => openRestock(item)}>
                              <Zap className="mr-1 h-4 w-4" />
                              Restock
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

        <div className="space-y-4">
          <Card className="border-border/70 bg-background/75 backdrop-blur">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Package className="h-4 w-4 text-cyan-500" />
                Critical queue
              </div>
              {lowStockItems.slice(0, 5).map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openRestock(item)}
                  className="w-full rounded-2xl border border-border/70 bg-background/80 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity} left. Reorder at {item.reorder_level}.</p>
                    </div>
                    <Badge variant={item.quantity === 0 ? 'destructive' : 'secondary'}>{item.quantity === 0 ? 'Out' : 'Low'}</Badge>
                  </div>
                </button>
              ))}
              {lowStockItems.length === 0 ? <p className="text-sm text-muted-foreground">No low stock warnings.</p> : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/75 backdrop-blur">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock3 className="h-4 w-4 text-cyan-500" />
                Recent movement
              </div>
              {logs.slice(0, 5).map(log => (
                <div key={log.id} className="rounded-2xl border border-border/70 bg-background/80 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{log.item_name}</span>
                    <Badge variant="outline">{log.action}</Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">{log.quantity_changed > 0 ? '+' : ''}{log.quantity_changed} by {log.performed_by_name}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeOrDate(log.created_at)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/75 backdrop-blur">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                Quick actions
              </div>
              <p className="text-sm text-muted-foreground">One click restock uses a suggested quantity of reorder level times 2 and clears matching low-stock alerts after success.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(restockTarget)} onOpenChange={value => { if (!value) setRestockTarget(null) }}>
        <DialogContent className="sm:max-w-140 border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Restock Item</DialogTitle>
            <DialogDescription>
              Suggested restock is based on reorder level x 2 to restore healthy stock quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{restockTarget?.name || 'Selected item'}</p>
              <div className="mt-1 grid gap-1 text-muted-foreground">
                <span>Current Stock: {restockTarget?.quantity ?? 0}</span>
                <span>Reorder Level: {restockTarget?.reorder_level ?? 0}</span>
                <span>Suggested Restock: {(restockTarget?.reorder_level || 0) * 2}</span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="restock-quantity">Quantity to Add</Label>
                <Input id="restock-quantity" type="number" min="1" step="1" value={form.quantity} onChange={event => setForm(previous => ({ ...previous, quantity: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="restock-location">Warehouse Location</Label>
                <Input id="restock-location" value={form.warehouse_location} onChange={event => setForm(previous => ({ ...previous, warehouse_location: event.target.value }))} placeholder="Warehouse A" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="restock-notes">Notes</Label>
              <Input id="restock-notes" value={form.notes} onChange={event => setForm(previous => ({ ...previous, notes: event.target.value }))} placeholder="Supplier delivery" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockTarget(null)} disabled={restocking}>Cancel</Button>
            <Button className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={() => void submitRestock()} disabled={restocking}>
              {restocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {restocking ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="sm:max-w-6xl border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Low Stock Activity</DialogTitle>
            <DialogDescription>Recent restock actions and inventory movements tied to low stock items.</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Action</TableHead>
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold">Qty</TableHead>
                  <TableHead className="font-semibold">Old → New</TableHead>
                  <TableHead className="font-semibold">By</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No low stock activity yet.</TableCell></TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell>{log.item_name}</TableCell>
                    <TableCell>{log.quantity_changed}</TableCell>
                    <TableCell>{log.old_quantity ?? 'N/A'} → {log.new_quantity ?? 'N/A'}</TableCell>
                    <TableCell>{log.performed_by_name}</TableCell>
                    <TableCell>{formatRelativeOrDate(log.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </InventoryPageShell>
  )
}
