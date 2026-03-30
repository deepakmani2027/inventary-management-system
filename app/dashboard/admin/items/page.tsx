'use client'

import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'

const SEARCH_DEBOUNCE_MS = 300
const itemSchema = z.object({
  name: z.string().trim().min(2, 'Item name is required'),
  category_id: z.string().trim().min(1, 'Category is required'),
  unit_price: z.coerce.number().positive('Price must be greater than 0'),
  stock: z.coerce.number().int().min(0, 'Stock must be 0 or more'),
  reorder_level: z.coerce.number().int().min(0, 'Reorder level must be 0 or more'),
})

type CategoryRow = { id: string; name: string }
type ItemRow = {
  id: string
  name: string
  category_id: string
  category_name: string
  unit_price: number
  reorder_level: number
  stock: number
  created_at: string
}

type ItemFormState = {
  name: string
  category_id: string
  unit_price: string
  stock: string
  reorder_level: string
}

type FormErrors = Partial<Record<keyof ItemFormState, string>>

type ItemResponse = {
  items: ItemRow[]
  categories: CategoryRow[]
}

const emptyForm: ItemFormState = {
  name: '',
  category_id: '',
  unit_price: '',
  stock: '0',
  reorder_level: '10',
}

function getStockStatus(stock: number) {
  if (stock === 0) {
    return {
      label: 'Out of Stock',
      tone: 'destructive' as const,
      bar: 0,
    }
  }

  if (stock <= 10) {
    return {
      label: 'Low Stock',
      tone: 'secondary' as const,
      bar: Math.min((stock / 10) * 100, 100),
    }
  }

  return {
    label: 'In Stock',
    tone: 'default' as const,
    bar: Math.min(((stock - 10) / 20) * 100 + 50, 100),
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value)
}

export default function AdminItemsPage() {
  const [items, setItems] = useState<ItemRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ItemRow | null>(null)
  const [form, setForm] = useState<ItemFormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ItemRow | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [inlinePriceId, setInlinePriceId] = useState<string | null>(null)
  const [inlinePriceValue, setInlinePriceValue] = useState('')
  const [inlinePriceSavingId, setInlinePriceSavingId] = useState<string | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const loadItems = async (query = search, filterCategoryId = categoryFilter) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/items?search=${encodeURIComponent(query)}&categoryId=${encodeURIComponent(filterCategoryId === 'all' ? '' : filterCategoryId)}`)
      const data = (await response.json()) as ItemResponse & { error?: string }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load items')
      }

      setItems(data.items || [])
      setCategories(data.categories || [])
      setSelectedIds([])
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load items'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems(search, categoryFilter)
  }, [search, categoryFilter])

  const selectedCount = selectedIds.length
  const selectedItems = useMemo(() => items.filter(item => selectedIds.includes(item.id)), [items, selectedIds])
  const allVisibleSelected = items.length > 0 && selectedIds.length === items.length

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormErrors({})
    setOpen(true)
  }

  const openEdit = (item: ItemRow) => {
    setEditing(item)
    setForm({
      name: item.name,
      category_id: item.category_id,
      unit_price: String(item.unit_price),
      stock: String(item.stock),
      reorder_level: String(item.reorder_level),
    })
    setFormErrors({})
    setOpen(true)
  }

  const validateForm = () => {
    const parsed = itemSchema.safeParse(form)

    if (parsed.success) {
      setFormErrors({})
      return { success: true as const, data: parsed.data }
    }

    const nextErrors: FormErrors = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ItemFormState | undefined
      if (field && !nextErrors[field]) {
        nextErrors[field] = issue.message
      }
    }
    setFormErrors(nextErrors)
    return { success: false as const }
  }

  const submit = async () => {
    const validation = validateForm()
    if (!validation.success) return

    setSaving(true)
    try {
      const response = await fetch(editing ? `/api/admin/items/${editing.id}` : '/api/admin/items', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save item')
      }

      toast.success(editing ? 'Item updated' : 'Item created')
      setOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await loadItems(search, categoryFilter)
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: ItemRow) => {
    const response = await fetch(`/api/admin/items/${item.id}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({})) as { error?: string }

    if (!response.ok) {
      toast.error(data.error || 'Failed to delete item')
      return
    }

    toast.success('Item deleted')
    setDeleteTarget(null)
    await loadItems(search, categoryFilter)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return

    setBulkDeleting(true)
    try {
      const response = await fetch('/api/admin/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete selected items')
      }

      toast.success('Selected items deleted')
      setSelectedIds([])
      await loadItems(search, categoryFilter)
    } catch (bulkError) {
      toast.error(bulkError instanceof Error ? bulkError.message : 'Failed to delete selected items')
    } finally {
      setBulkDeleting(false)
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(previous =>
      previous.includes(id) ? previous.filter(itemId => itemId !== id) : [...previous, id],
    )
  }

  const handleInlinePriceStart = (item: ItemRow) => {
    setInlinePriceId(item.id)
    setInlinePriceValue(String(item.unit_price))
  }

  const handleInlinePriceSave = async (item: ItemRow) => {
    const nextPrice = Number(inlinePriceValue)
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      toast.error('Price must be greater than 0')
      setInlinePriceId(null)
      setInlinePriceValue('')
      return
    }

    if (nextPrice === item.unit_price) {
      setInlinePriceId(null)
      setInlinePriceValue('')
      return
    }

    setInlinePriceSavingId(item.id)
    try {
      const response = await fetch(`/api/admin/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_price: nextPrice }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update price')
      }

      setItems(previous => previous.map(current => current.id === item.id ? { ...current, unit_price: nextPrice } : current))
      toast.success('Price updated')
    } catch (priceError) {
      toast.error(priceError instanceof Error ? priceError.message : 'Failed to update price')
    } finally {
      setInlinePriceSavingId(null)
      setInlinePriceId(null)
      setInlinePriceValue('')
    }
  }

  const visibleStatusSummary = useMemo(() => {
    const counts = { inStock: 0, lowStock: 0, outOfStock: 0 }
    for (const item of items) {
      if (item.stock === 0) counts.outOfStock += 1
      else if (item.stock <= 10) counts.lowStock += 1
      else counts.inStock += 1
    }
    return counts
  }, [items])

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-background via-card/70 to-background p-6 shadow-2xl shadow-slate-950/10 backdrop-blur sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              Product catalog control
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Items</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Manage your products with fast search, category filtering, inline pricing, and full admin CRUD.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search items"
                className="h-11 pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-11 w-full sm:w-56">
                <SelectValue placeholder="Filter category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate} className="h-11 bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">In Stock</p>
            <p className="mt-1 text-2xl font-semibold">{visibleStatusSummary.inStock}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Low Stock</p>
            <p className="mt-1 text-2xl font-semibold">{visibleStatusSummary.lowStock}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Out of Stock</p>
            <p className="mt-1 text-2xl font-semibold">{visibleStatusSummary.outOfStock}</p>
          </div>
        </CardContent>
      </Card>

      {selectedCount > 0 && (
        <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{selectedCount} item{selectedCount === 1 ? '' : 's'} selected</p>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete selected
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-border/70 bg-background/75 shadow-sm backdrop-blur">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4 sm:p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[24px_1.4fr_1fr_0.8fr_0.8fr_1fr_1fr] gap-4 rounded-2xl border border-border/60 p-4">
                  <Skeleton className="h-5 w-5 rounded-sm" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-24" />
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
                <h2 className="text-lg font-semibold">Unable to load items</h2>
                <p className="max-w-md text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={() => loadItems(search, categoryFilter)} variant="outline">
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">No items found</h2>
                <p className="max-w-md text-sm text-muted-foreground">Use Add Item to create your first product.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-12 px-4 py-3">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={checked => {
                        if (checked) {
                          setSelectedIds(items.map(item => item.id))
                        } else {
                          setSelectedIds([])
                        }
                      }}
                      aria-label="Select all items"
                    />
                  </TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Item Name</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Category</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Price</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Stock</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Status</TableHead>
                  <TableHead className="px-4 py-3 text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => {
                  const stockStatus = getStockStatus(item.stock)
                  const isPriceEditing = inlinePriceId === item.id
                  const priceSaving = inlinePriceSavingId === item.id

                  return (
                    <TableRow
                      key={item.id}
                      className="group border-border/60 hover:bg-muted/80"
                    >
                      <TableCell className="px-4 py-3 align-top">
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={() => toggleSelection(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.unit_price)} catalog item</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top text-sm text-muted-foreground">
                        {item.category_name}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        {isPriceEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={inlinePriceValue}
                              onChange={e => setInlinePriceValue(e.target.value)}
                              onBlur={() => handleInlinePriceSave(item)}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  handleInlinePriceSave(item)
                                }
                                if (event.key === 'Escape') {
                                  setInlinePriceId(null)
                                  setInlinePriceValue('')
                                }
                              }}
                              autoFocus
                              type="number"
                              step="0.01"
                              className="h-9 w-32"
                            />
                            {priceSaving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-md px-0 py-0 text-left font-medium text-foreground transition-colors hover:text-primary"
                            onClick={() => handleInlinePriceStart(item)}
                          >
                            {formatCurrency(item.unit_price)}
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <div className="space-y-2">
                          <p className="font-medium text-foreground">{item.stock}</p>
                          <Progress value={Math.min(item.stock > 20 ? 100 : (item.stock / 20) * 100, 100)} />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <Badge
                          variant={stockStatus.tone}
                          className={stockStatus.tone === 'secondary' ? 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/15' : undefined}
                        >
                          {stockStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-background hover:text-foreground"
                            onClick={() => openEdit(item)}
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                            onClick={() => setDeleteTarget(item)}
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
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
        open={open}
        onOpenChange={value => {
          setOpen(value)
          if (!value) {
            setEditing(null)
            setForm(emptyForm)
            setFormErrors({})
          }
        }}
      >
        <DialogContent className="max-w-100 border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Item' : 'Add Item'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update product details, category, and opening stock.' : 'Create a new item and seed its inventory quantity.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={form.name}
                onChange={e => setForm(previous => ({ ...previous, name: e.target.value }))}
                placeholder="Enter item name"
              />
              {formErrors.name ? <p className="text-xs text-red-600">{formErrors.name}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-category">Category</Label>
              <Select
                value={form.category_id}
                onValueChange={value => setForm(previous => ({ ...previous, category_id: value }))}
              >
                <SelectTrigger id="item-category">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.category_id ? <p className="text-xs text-red-600">{formErrors.category_id}</p> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="item-price">Price</Label>
                <Input
                  id="item-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unit_price}
                  onChange={e => setForm(previous => ({ ...previous, unit_price: e.target.value }))}
                  placeholder="Enter price"
                />
                {formErrors.unit_price ? <p className="text-xs text-red-600">{formErrors.unit_price}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-stock">Stock</Label>
                <Input
                  id="item-stock"
                  type="number"
                  step="1"
                  min="0"
                  value={form.stock}
                  onChange={e => setForm(previous => ({ ...previous, stock: e.target.value }))}
                  placeholder="Enter stock"
                />
                {formErrors.stock ? <p className="text-xs text-red-600">{formErrors.stock}</p> : null}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-reorder">Reorder Level</Label>
              <Input
                id="item-reorder"
                type="number"
                step="1"
                min="0"
                value={form.reorder_level}
                onChange={e => setForm(previous => ({ ...previous, reorder_level: e.target.value }))}
                placeholder="Enter reorder level"
              />
              {formErrors.reorder_level ? <p className="text-xs text-red-600">{formErrors.reorder_level}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={value => { if (!value) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This will also remove its inventory data and related logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-600/90"
              onClick={async event => {
                event.preventDefault()
                if (deleteTarget) {
                  await handleDelete(deleteTarget)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
