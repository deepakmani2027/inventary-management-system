'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Package, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SalesmanPageShell } from '@/components/dashboard/salesman-page-shell'

const SEARCH_DEBOUNCE_MS = 300
const PAGE_SIZE = 12

type InventoryRow = {
  id: string
  name: string
  category_id: string
  category_name: string
  quantity: number
  reorder_level: number
  stock_status: 'out' | 'low' | 'healthy'
}

type CategoryRow = { id: string; name: string }

type InventoryApiResponse = {
  items: InventoryRow[]
  categories: CategoryRow[]
}

function getStockMeta(quantity: number) {
  if (quantity === 0) {
    return { label: 'Out', tone: 'destructive' as const, className: 'border-red-500/20 bg-red-500/10 text-red-700' }
  }

  if (quantity <= 10) {
    return { label: 'Low', tone: 'secondary' as const, className: 'border-amber-500/20 bg-amber-500/10 text-amber-700' }
  }

  return { label: 'Available', tone: 'default' as const, className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' }
}

export default function SalesmanInventoryPage() {
  const [items, setItems] = useState<InventoryRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      try {
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (categoryFilter !== 'all') params.set('categoryId', categoryFilter)

        const response = await fetch(`/api/admin/inventory?${params.toString()}`)
        const data = (await response.json()) as InventoryApiResponse & { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load inventory')
        }

        setItems(data.items || [])
        setCategories(data.categories || [])
      } catch {
        setItems([])
        setCategories([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [search, categoryFilter])

  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter])

  const filteredItems = useMemo(() => items, [items])
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredItems, currentPage])
  const totalItems = filteredItems.length
  const availableItems = filteredItems.filter(item => item.stock_status === 'healthy').length
  const lowItems = filteredItems.filter(item => item.stock_status === 'low').length
  const outItems = filteredItems.filter(item => item.stock_status === 'out').length

  return (
    <SalesmanPageShell
      badge={<><Package className="h-4 w-4 text-cyan-500" /> Read-only inventory lookup</>}
      title="Inventory"
      description="Check item availability fast. Search by item or category, filter what you need, and use the stock level before billing."
      actions={
        <Button asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
          <Link href="/salesman/dashboard/create-bill">
            Create Bill
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <Card className="border-border/70 bg-background/75 backdrop-blur">
        <CardContent className="grid gap-4 pt-6 lg:grid-cols-[1fr_240px] xl:grid-cols-[1fr_260px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search item or category"
              className="h-11 pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Items shown</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{totalItems}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Available</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-emerald-700">{availableItems}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Low stock</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-amber-700">{lowItems}</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Out of stock</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-red-700">{outItems}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-background/75 backdrop-blur">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Item List</h2>
              <p className="text-sm text-muted-foreground">Read-only stock availability for sales checks.</p>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">Available</Badge>
              <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-700">Low</Badge>
              <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-700">Out</Badge>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border/70">
                <thead className="bg-background/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Item Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Available Stock</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70 bg-background/50">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index}>
                        <td className="px-4 py-4"><Skeleton className="h-5 w-40" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-5 w-28" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-5 w-16" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                      </tr>
                    ))
                  ) : pagedItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No items match your search.
                      </td>
                    </tr>
                  ) : (
                    pagedItems.map(item => {
                      const stockMeta = getStockMeta(item.quantity)
                      return (
                        <tr key={item.id} className="hover:bg-accent/30">
                          <td className="px-4 py-4">
                            <div className="font-medium text-foreground">{item.name}</div>
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{item.category_name || 'Unassigned'}</td>
                          <td className="px-4 py-4">
                            <div className="text-3xl font-semibold tracking-tight text-foreground">{item.quantity}</div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="outline" className={stockMeta.className}>
                              {stockMeta.label}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="border-border/70 bg-background/80">
                  <CardContent className="space-y-3 pt-6">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-20" />
                  </CardContent>
                </Card>
              ))
            ) : pagedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">
                No items match your search.
              </div>
            ) : (
              pagedItems.map(item => {
                const stockMeta = getStockMeta(item.quantity)
                return (
                  <Card key={item.id} className="border-border/70 bg-background/80 shadow-sm">
                    <CardContent className="space-y-3 pt-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold tracking-tight">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.category_name || 'Unassigned'}</p>
                        </div>
                        <Badge variant="outline" className={stockMeta.className}>
                          {stockMeta.label}
                        </Badge>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Stock</p>
                        <p className="text-3xl font-semibold tracking-tight">{item.quantity}</p>
                      </div>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border/70"
                  disabled={currentPage === 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border/70"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </SalesmanPageShell>
  )
}
