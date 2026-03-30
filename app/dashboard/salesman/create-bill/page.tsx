'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Minus, Package, Plus, ReceiptText, Search, ShoppingCart, Trash2, Truck } from 'lucide-react'
import { SalesmanPageShell } from '@/components/dashboard/salesman-page-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const SEARCH_DEBOUNCE_MS = 300
const PAGE_SIZE = 12

type ItemRow = {
  id: string
  name: string
  category_id: string
  category_name: string
  unit_price: number
  reorder_level: number
  stock: number
}

type CategoryRow = { id: string; name: string }

type CartRow = {
  item_id: string
  name: string
  price: number
  quantity: number
  stock: number
}

type Receipt = {
  id: string
  bill_number: string
  customer_name: string
  sale_date: string
  total_amount: number
}

function getStockState(stock: number) {
  if (stock === 0) {
    return { label: 'Out', className: 'border-red-500/20 bg-red-500/10 text-red-700' }
  }

  if (stock <= 10) {
    return { label: 'Low', className: 'border-amber-500/20 bg-amber-500/10 text-amber-700' }
  }

  return { label: 'Available', className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' }
}

export default function CreateBillPage() {
  const [items, setItems] = useState<ItemRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [cart, setCart] = useState<CartRow[]>([])
  const [customerName, setCustomerName] = useState('Walk-in')
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const loadData = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/salesman/create-bill')
      const data = await response.json().catch(() => ({})) as {
        error?: string
        items?: ItemRow[]
        categories?: CategoryRow[]
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load inventory')
      }

      setItems(data.items || [])
      setCategories(data.categories || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load inventory')
      setItems([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter])

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.toLowerCase()
    return items.filter(item => {
      const matchesSearch = !normalizedSearch || item.name.toLowerCase().includes(normalizedSearch) || item.category_name.toLowerCase().includes(normalizedSearch)
      const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [items, search, categoryFilter])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleItems = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredItems, currentPage])

  const cartById = useMemo(() => new Map(cart.map(item => [item.item_id, item])), [cart])
  const total = useMemo(() => cart.reduce((sum, row) => sum + row.price * row.quantity, 0), [cart])
  const selectedCount = cart.reduce((sum, row) => sum + row.quantity, 0)

  const addToCart = (item: ItemRow) => {
    if (item.stock <= 0) {
      toast.error('Out of stock')
      return
    }

    setCart(prev => {
      const existing = prev.find(row => row.item_id === item.id)
      if (!existing) {
        return [...prev, { item_id: item.id, name: item.name, price: item.unit_price, quantity: 1, stock: item.stock }]
      }

      if (existing.quantity + 1 > item.stock) {
        toast.error('Not enough stock')
        return prev
      }

      return prev.map(row => row.item_id === item.id ? { ...row, quantity: row.quantity + 1, stock: item.stock } : row)
    })
  }

  const changeQuantity = (itemId: string, delta: number) => {
    const item = cartById.get(itemId)
    if (!item) return

    if (delta > 0 && item.quantity + 1 > item.stock) {
      toast.error('Not enough stock')
      return
    }

    setCart(prev => prev
      .map(row => row.item_id === itemId ? { ...row, quantity: row.quantity + delta } : row)
      .filter(row => row.quantity > 0)
    )
  }

  const removeItem = (itemId: string) => {
    setCart(prev => prev.filter(row => row.item_id !== itemId))
  }

  const checkout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    setCheckoutLoading(true)

    try {
      const response = await fetch('/api/salesman/create-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          items: cart.map(item => ({ item_id: item.item_id, quantity: item.quantity })),
        }),
      })

      const data = await response.json().catch(() => ({})) as { error?: string; sale?: Receipt }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to checkout')
      }

      setReceipt(data.sale || null)
      setCart([])
      toast.success('Sale completed')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to checkout')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <SalesmanPageShell
      badge={<><ShoppingCart className="h-4 w-4 text-cyan-500" /> Billing workspace</>}
      title="Create Bill"
      description="Build a cart quickly, keep stock checks visible, and complete the sale with one secure checkout."
      actions={
        <>
          <Button asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
            <Link href="/salesman/dashboard/inventory">Check Inventory</Link>
          </Button>
          <Button asChild variant="outline" className="border-border/70 bg-background/70 backdrop-blur">
            <Link href="/salesman/dashboard/sales-history">
              <Truck className="mr-2 h-4 w-4" />
              My Sales
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
        <Card className="border-border/70 bg-background/75 backdrop-blur">
          <CardHeader className="space-y-4">
            <CardTitle>Item List</CardTitle>
            <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search items or categories"
                  className="h-11 pl-10"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="h-11 rounded-md border border-border/70 bg-background px-3 text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>{filteredItems.length} items found</span>
              <span>{selectedCount} units selected</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="border-border/70 bg-background/80 shadow-sm">
                    <CardContent className="space-y-3 pt-6">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))
              ) : visibleItems.length === 0 ? (
                <div className="col-span-full rounded-3xl border border-dashed border-border/80 bg-background/60 px-6 py-14 text-center text-sm text-muted-foreground">
                  No items match your search.
                </div>
              ) : (
                visibleItems.map(item => {
                  const stockMeta = getStockState(item.stock)
                  const canAdd = item.stock > 0

                  return (
                    <Card key={item.id} className={`border-border/70 bg-background/80 shadow-sm transition-all hover:-translate-y-0.5 ${item.stock <= 10 ? 'ring-1 ring-amber-500/15' : ''}`}>
                      <CardContent className="space-y-4 pt-6">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold tracking-tight">{item.name}</p>
                              <p className="text-sm text-muted-foreground">{item.category_name || 'Unassigned'}</p>
                            </div>
                            <Badge variant="outline" className={stockMeta.className}>{stockMeta.label}</Badge>
                          </div>
                          <p className="text-2xl font-semibold tracking-tight">₹{Number(item.unit_price).toLocaleString()}</p>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                          <p className="text-sm text-muted-foreground">Available stock</p>
                          <p className="mt-1 text-3xl font-semibold tracking-tight">{item.stock}</p>
                        </div>

                        <Button
                          onClick={() => addToCart(item)}
                          disabled={!canAdd}
                          className="w-full bg-linear-to-r from-slate-950 to-slate-700 text-white"
                        >
                          {!canAdd ? 'Out of stock' : 'Add to Cart'}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>

            {!loading && filteredItems.length > PAGE_SIZE ? (
              <div className="flex flex-col gap-3 border-t border-border/70 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="border-border/70" disabled={currentPage === 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>Previous</Button>
                  <Button variant="outline" size="sm" className="border-border/70" disabled={currentPage === totalPages} onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}>Next</Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/75 backdrop-blur">
          <CardHeader className="space-y-2">
            <CardTitle>Cart / Bill</CardTitle>
            <p className="text-sm text-muted-foreground">Quantity, subtotal, total, and checkout in one place.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Customer Name</label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Walk-in" />
            </div>

            <Separator />

            {cart.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/80 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                Cart is empty. Add items from the left panel.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-2xl border border-border/70">
                  <div className="grid grid-cols-[1.4fr_0.8fr_1fr_1fr_auto] gap-2 border-b border-border/70 bg-background/80 px-3 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <span>Item</span>
                    <span>Price</span>
                    <span>Qty</span>
                    <span>Subtotal</span>
                    <span />
                  </div>
                  <div className="divide-y divide-border/70 bg-background/50">
                    {cart.map(row => {
                      const subtotal = row.price * row.quantity
                      return (
                        <div key={row.item_id} className="grid grid-cols-[1.4fr_0.8fr_1fr_1fr_auto] items-center gap-2 px-3 py-3">
                          <div>
                            <p className="font-medium text-foreground">{row.name}</p>
                            <p className="text-xs text-muted-foreground">Stock: {row.stock}</p>
                          </div>
                          <div className="text-sm text-muted-foreground">₹{row.price.toLocaleString()}</div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8 border-border/70" onClick={() => changeQuantity(row.item_id, -1)}>
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-6 text-center font-medium">{row.quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8 border-border/70" onClick={() => changeQuantity(row.item_id, 1)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="font-medium">₹{subtotal.toLocaleString()}</div>
                          <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-500/10 hover:text-red-700" onClick={() => removeItem(row.item_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/90 p-4 font-semibold text-foreground">
                  <span>Total</span>
                  <span>₹{total.toLocaleString()}</span>
                </div>

                <Button
                  onClick={checkout}
                  disabled={checkoutLoading || cart.length === 0}
                  className="w-full bg-linear-to-r from-slate-950 to-slate-700 text-white"
                >
                  {checkoutLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    'Checkout'
                  )}
                </Button>
              </div>
            )}

            {receipt ? (
              <Card className="border-emerald-500/20 bg-emerald-500/10 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" /> Sale completed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Bill No</span>
                    <span className="font-medium text-foreground">{receipt.bill_number}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Customer</span>
                    <span className="font-medium text-foreground">{receipt.customer_name}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold text-foreground">₹{Number(receipt.total_amount).toLocaleString()}</span>
                  </div>
                  <Button asChild variant="outline" className="w-full border-emerald-500/20 bg-background/80">
                    <Link href="/salesman/dashboard/sales-history">
                      <ReceiptText className="mr-2 h-4 w-4" />
                      View sales history
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </SalesmanPageShell>
  )
}