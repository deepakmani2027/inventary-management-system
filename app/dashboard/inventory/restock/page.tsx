'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, Loader2, Package, RefreshCcw, Search, ShieldAlert, Truck } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

const SEARCH_DEBOUNCE_MS = 300
const RESTOCK_PRESET = 20

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

type LogRow = {
  id: string
  item_name: string
  action: string
  quantity_changed: number
  old_quantity: number | null
  new_quantity: number | null
  performed_by_name: string
  notes: string | null
  created_at: string
}

type InventoryApiResponse = {
  items: InventoryRow[]
  logs?: LogRow[]
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

function getStatusLabel(item: InventoryRow) {
  if (item.quantity === 0) return { label: 'Out of Stock', tone: 'destructive' as const }
  if (item.quantity <= item.reorder_level) return { label: 'Low Stock', tone: 'secondary' as const }
  return { label: 'Healthy', tone: 'default' as const }
}

function getActionLabel(action: string) {
  switch (action) {
    case 'restock':
      return 'Restock'
    case 'sale':
      return 'Sale'
    case 'return':
      return 'Return'
    case 'cancel':
      return 'Cancel'
    default:
      return action
  }
}

export default function RestockPage() {
  const [items, setItems] = useState<InventoryRow[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [onlyLowStock, setOnlyLowStock] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [restockTarget, setRestockTarget] = useState<InventoryRow | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [restocking, setRestocking] = useState(false)
  const [recentItemId, setRecentItemId] = useState<string | null>(null)
  const [restockForm, setRestockForm] = useState<RestockFormState>({ quantity: String(RESTOCK_PRESET), warehouse_location: 'Warehouse A', notes: '' })

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const loadInventory = async (query = search, lowStockOnly = onlyLowStock) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/inventory?includeLogs=true&search=${encodeURIComponent(query)}&lowStockOnly=${lowStockOnly ? 'true' : 'false'}&sort=low-stock-asc`,
      )
      const data = (await response.json()) as InventoryApiResponse & { error?: string }

      if (!response.ok) throw new Error(data.error || 'Failed to load inventory')

      setItems(data.items || [])
      setLogs(data.logs || [])
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load inventory'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInventory(search, onlyLowStock)
  }, [search, onlyLowStock])

  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel('inventory-restock-console')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => void loadInventory(search, onlyLowStock))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_logs' }, () => void loadInventory(search, onlyLowStock))
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [search, onlyLowStock])

  const lowStockItems = useMemo(() => items.filter(item => item.quantity <= item.reorder_level), [items])
  const selectedItems = useMemo(() => items.filter(item => selectedIds.includes(item.id)), [items, selectedIds])
  const stats = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        accumulator.total += 1
        accumulator.low += item.quantity <= item.reorder_level ? 1 : 0
        accumulator.out += item.quantity === 0 ? 1 : 0
        accumulator.stock += item.quantity
        return accumulator
      },
      { total: 0, low: 0, out: 0, stock: 0 },
    )
  }, [items])

  const openRestock = (item: InventoryRow) => {
    setRestockTarget(item)
    setRestockForm({
      quantity: String(Math.max(RESTOCK_PRESET, item.reorder_level)),
      warehouse_location: item.warehouse_location || 'Warehouse A',
      notes: '',
    })
  }

  const selectItem = (itemId: string, checked: boolean) => {
    setSelectedIds(previous => checked ? Array.from(new Set([...previous, itemId])) : previous.filter(id => id !== itemId))
  }

  const runRestock = async (item: InventoryRow, quantityValue: number, warehouseLocation: string, notes: string) => {
    const supabase = getSupabaseClient()
    const { data: authData } = await supabase.auth.getUser()
    const performedBy = authData.user?.id

    if (!performedBy) throw new Error('Not authenticated')

    const { error } = await supabase.rpc('restock_item', {
      p_item_id: item.id,
      p_quantity: quantityValue,
      p_performed_by: performedBy,
      p_location: warehouseLocation.trim() || null,
      p_notes: notes.trim() || null,
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

    const quantityValue = Number(restockForm.quantity)
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    setRestocking(true)
    try {
      await runRestock(restockTarget, quantityValue, restockForm.warehouse_location, restockForm.notes)
      toast.success('Stock updated successfully')
      setRecentItemId(restockTarget.id)
      window.setTimeout(() => setRecentItemId(null), 2500)
      setRestockTarget(null)
      await loadInventory(search, onlyLowStock)
    } catch (restockError) {
      toast.error(restockError instanceof Error ? restockError.message : 'Failed to restock item')
    } finally {
      setRestocking(false)
    }
  }

  const submitBulkRestock = async () => {
    if (selectedItems.length === 0) {
      toast.error('Select at least one item')
      return
    }

    const quantityValue = Number(restockForm.quantity)
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    setRestocking(true)
    try {
      for (const item of selectedItems) {
        await runRestock(item, quantityValue, restockForm.warehouse_location, restockForm.notes)
      }

      toast.success(`Stock updated for ${selectedItems.length} items`)
      setSelectedIds([])
      setBulkOpen(false)
      setRestockForm({ quantity: String(RESTOCK_PRESET), warehouse_location: 'Warehouse A', notes: '' })
      await loadInventory(search, onlyLowStock)
    } catch (bulkError) {
      toast.error(bulkError instanceof Error ? bulkError.message : 'Bulk restock failed')
    } finally {
      setRestocking(false)
    }
  }

  return (
    <InventoryPageShell
      badge={<><Truck className="h-4 w-4 text-cyan-500" /> Restock console</>}
      title="Restock Center"
      description="A focused workspace for replenishment, audit trails, and low-stock recovery."
      actions={
        <>
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search low stock items" className="h-11 pl-10" />
          </div>
          <label className="flex h-11 items-center gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 text-sm backdrop-blur">
            <Checkbox checked={onlyLowStock} onCheckedChange={checked => setOnlyLowStock(Boolean(checked))} />
            Low stock queue only
          </label>
          <Button variant="outline" className="h-11 border-border/70 bg-background/80" onClick={() => void loadInventory(search, onlyLowStock)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" className="h-11 border-border/70 bg-background/80" onClick={() => setLogsOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            Logs
          </Button>
          <Button className="h-11 bg-linear-to-r from-slate-950 to-slate-700 text-white" disabled={selectedIds.length === 0} onClick={() => setBulkOpen(true)}>
            <ClipboardList className="mr-2 h-4 w-4" />
            Bulk Restock
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Queue Size</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight">{lowStockItems.length}</div>
                <p className="mt-1 text-sm text-muted-foreground">Items awaiting replenishment</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/5">
                <ClipboardList className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Out of Stock</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-red-600">{stats.out}</div>
                <p className="mt-1 text-sm text-red-600">Critical items</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/10">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Current Units</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight">{stats.stock}</div>
                <p className="mt-1 text-sm text-muted-foreground">Total units across inventory</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
                <Package className="h-5 w-5 text-cyan-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-transparent bg-gradient-to-br from-white/95 to-slate-50 shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Selected</p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-cyan-600">{selectedIds.length}</div>
                <p className="mt-1 text-sm text-muted-foreground">Rows selected for bulk actions</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
                <CheckCircle2 className="h-5 w-5 text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden border-border/70 bg-background/75 backdrop-blur">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-4 sm:p-6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-[auto_1.5fr_0.9fr_0.9fr_1.1fr_0.9fr] gap-4 rounded-2xl border border-border/60 p-4">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-8 w-28 rounded-full" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <h2 className="text-lg font-semibold">Unable to load restock queue</h2>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button variant="outline" onClick={() => void loadInventory(search, onlyLowStock)}>Retry</Button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-semibold">No replenishment work right now</h2>
                  <p className="text-sm text-muted-foreground">Everything in the current filter looks healthy.</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="px-4 py-3 font-semibold">Select</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">Item</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">Stock</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">Status</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">Warehouse</TableHead>
                    <TableHead className="px-4 py-3 text-right font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => {
                    const selected = selectedIds.includes(item.id)
                    const status = getStatusLabel(item)
                    const ratio = Math.min((item.quantity / Math.max(item.reorder_level, 1)) * 100, 100)
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
                        <TableCell className="px-4 py-3">
                          <Checkbox checked={selected} onCheckedChange={checked => selectItem(item.id, Boolean(checked))} />
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-cyan-500" />
                              <p className="font-medium text-foreground">{item.name}</p>
                              {item.quantity <= item.reorder_level ? <Badge variant="destructive">Needs restock</Badge> : null}
                            </div>
                            <p className="text-xs text-muted-foreground">{item.category_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-semibold tracking-tight">{item.quantity}</span>
                              <span className="text-sm text-muted-foreground">/ {item.reorder_level}</span>
                            </div>
                            <Progress value={ratio} className="h-2 [&>div]:transition-all" />
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top">
                          <Badge variant={status.tone}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">{item.warehouse_location || 'Warehouse A'}</TableCell>
                        <TableCell className="px-4 py-3 align-top">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" className="border-border/70 bg-background/80" onClick={() => openRestock(item)}>
                              <Truck className="mr-1 h-4 w-4" />
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
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Restock queue
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
                      <p className="text-xs text-muted-foreground">{item.quantity} in stock, reorder at {item.reorder_level}</p>
                    </div>
                    <Badge variant={item.quantity === 0 ? 'destructive' : 'secondary'}>{item.quantity === 0 ? 'Out' : 'Low'}</Badge>
                  </div>
                </button>
              ))}
              {lowStockItems.length === 0 ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                  No low stock queue items.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/75 backdrop-blur">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ClipboardList className="h-4 w-4 text-cyan-500" />
                Current selection
              </div>
              {selectedItems.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {selectedItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">{item.quantity} units</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select multiple rows for bulk restock.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/75 backdrop-blur">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-cyan-500" />
                Recent logs
              </div>
              {logs.slice(0, 5).map(log => (
                <div key={log.id} className="rounded-2xl border border-border/70 bg-background/80 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{log.item_name}</span>
                    <Badge variant="outline">{getActionLabel(log.action)}</Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">{log.quantity_changed > 0 ? '+' : ''}{log.quantity_changed} by {log.performed_by_name}</p>
                </div>
              ))}
              {logs.length === 0 ? <p className="text-sm text-muted-foreground">No inventory activity yet.</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(restockTarget)} onOpenChange={value => { if (!value) setRestockTarget(null) }}>
        <DialogContent className="sm:max-w-140 border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Restock Item</DialogTitle>
            <DialogDescription>Add stock safely with an audited RPC call.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{restockTarget?.name || 'Selected item'}</p>
              <p className="text-muted-foreground">Current stock: {restockTarget?.quantity ?? 0}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="restock-quantity">Quantity to Add</Label>
                <Input id="restock-quantity" type="number" min="1" step="1" value={restockForm.quantity} onChange={event => setRestockForm(previous => ({ ...previous, quantity: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="restock-location">Warehouse Location</Label>
                <Input id="restock-location" value={restockForm.warehouse_location} onChange={event => setRestockForm(previous => ({ ...previous, warehouse_location: event.target.value }))} placeholder="Warehouse A" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="restock-notes">Notes</Label>
              <Textarea id="restock-notes" value={restockForm.notes} onChange={event => setRestockForm(previous => ({ ...previous, notes: event.target.value }))} placeholder="Supplier delivery" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestockTarget(null)} disabled={restocking}>Cancel</Button>
            <Button className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={() => void submitRestock()} disabled={restocking}>
              {restocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {restocking ? 'Processing...' : 'Confirm Restock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-140 border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Bulk Restock</DialogTitle>
            <DialogDescription>Apply one replenishment plan to the selected items.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bulk-quantity">Quantity to Add</Label>
                <Input id="bulk-quantity" type="number" min="1" step="1" value={restockForm.quantity} onChange={event => setRestockForm(previous => ({ ...previous, quantity: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-location">Warehouse Location</Label>
                <Input id="bulk-location" value={restockForm.warehouse_location} onChange={event => setRestockForm(previous => ({ ...previous, warehouse_location: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bulk-notes">Notes</Label>
              <Textarea id="bulk-notes" value={restockForm.notes} onChange={event => setRestockForm(previous => ({ ...previous, notes: event.target.value }))} placeholder="Supplier delivery" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={restocking}>Cancel</Button>
            <Button className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={() => void submitBulkRestock()} disabled={restocking}>
              {restocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {restocking ? 'Processing...' : `Restock ${selectedItems.length} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="sm:max-w-6xl border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Inventory Logs</DialogTitle>
            <DialogDescription>Recent restock, sale, and return entries with notes and previous stock values.</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Action</TableHead>
                  <TableHead className="font-semibold">Item</TableHead>
                  <TableHead className="font-semibold">Qty</TableHead>
                  <TableHead className="font-semibold">Old → New</TableHead>
                  <TableHead className="font-semibold">Notes</TableHead>
                  <TableHead className="font-semibold">By</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No recent inventory logs found.</TableCell></TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{getActionLabel(log.action)}</TableCell>
                    <TableCell>{log.item_name}</TableCell>
                    <TableCell>{log.quantity_changed}</TableCell>
                    <TableCell>{log.old_quantity ?? 'N/A'} → {log.new_quantity ?? 'N/A'}</TableCell>
                    <TableCell>{log.notes || 'No notes'}</TableCell>
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
