'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BarChart3, CalendarRange, DollarSign, PackageSearch, RefreshCw, Sparkles, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Cell, Legend, Line, LineChart, PieChart, Pie, Tooltip, XAxis, YAxis, ComposedChart } from 'recharts'
import { getSupabaseClient } from '@/lib/supabase/client'
import { SalesManagerPageShell } from '@/components/dashboard/sales-manager-page-shell'
import { StatCard } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

type FilterPreset = 'today' | '7d' | '30d' | 'custom'

type SalesRow = {
  id: string
  sale_date: string
  total_amount: number
  status: string | null
  bill_number: string | null
  customer_name: string | null
  created_at: string | null
}

type SaleItemRow = {
  sale_id: string
  item_id: string
  quantity: number
  unit_price: number
  subtotal: number
}

type ItemRow = {
  id: string
  name: string
  category_id: string
  unit_price: number
}

type CategoryRow = {
  id: string
  name: string
}

type AnalyticsRow = {
  saleId: string
  saleDate: string
  billNumber: string
  status: string
  itemId: string
  itemName: string
  categoryId: string
  categoryName: string
  quantity: number
  revenue: number
  sign: number
}

type DailyRevenueRow = {
  dateKey: string
  label: string
  revenue: number
  itemsSold: number
}

type ItemAnalyticsRow = {
  itemName: string
  categoryName: string
  quantitySold: number
  revenue: number
}

type CategoryAnalyticsRow = {
  categoryName: string
  revenue: number
  quantitySold: number
}

type SalesSummary = {
  totalRevenue: number
  totalItemsSold: number
  topItem: string
  topItemRevenue: number
  avgOrderValue: number
  orderCount: number
  completedCount: number
  returnedCount: number
  cancelledCount: number
}

type Insights = {
  lowPerformers: ItemAnalyticsRow[]
  highPerformers: ItemAnalyticsRow[]
}

const chartColors = ['#0f172a', '#0f766e', '#2563eb', '#d97706', '#db2777', '#7c3aed']

function formatCurrency(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function formatDateKey(dateKey: string) {
  const parsed = new Date(`${dateKey}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parsed)
}

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function endOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

function getPresetRange(preset: FilterPreset) {
  const now = new Date()

  if (preset === 'today') {
    return { from: startOfDay(now), to: endOfDay(now) }
  }

  if (preset === '7d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 6)
    return { from: startOfDay(from), to: endOfDay(now) }
  }

  if (preset === '30d') {
    const from = new Date(now)
    from.setDate(from.getDate() - 29)
    return { from: startOfDay(from), to: endOfDay(now) }
  }

  return { from: startOfDay(now), to: endOfDay(now) }
}

function safeDateValue(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default function SalesManagerAnalyticsPage() {
  const [sales, setSales] = useState<SalesRow[]>([])
  const [saleItems, setSaleItems] = useState<SaleItemRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'categories' | 'trends'>('overview')
  const [datePreset, setDatePreset] = useState<FilterPreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [itemId, setItemId] = useState('all')

  useEffect(() => {
    let cancelled = false
    const supabase = getSupabaseClient()

    const loadAnalytics = async (showSpinner = true) => {
      if (showSpinner) {
        setLoading(prev => (prev ? prev : true))
      } else {
        setRefreshing(true)
      }

      try {
        const [salesResponse, saleItemsResponse, itemsResponse, categoriesResponse] = await Promise.all([
          supabase
            .from('sales')
            .select('id, sale_date, total_amount, status, bill_number, customer_name, created_at')
            .order('sale_date', { ascending: false }),
          supabase
            .from('sale_items')
            .select('sale_id, item_id, quantity, unit_price, subtotal'),
          supabase
            .from('items')
            .select('id, name, category_id, unit_price')
            .order('name', { ascending: true }),
          supabase
            .from('categories')
            .select('id, name')
            .order('name', { ascending: true }),
        ])

        if (salesResponse.error) throw salesResponse.error
        if (saleItemsResponse.error) throw saleItemsResponse.error
        if (itemsResponse.error) throw itemsResponse.error
        if (categoriesResponse.error) throw categoriesResponse.error

        if (!cancelled) {
          setSales((salesResponse.data as SalesRow[]) || [])
          setSaleItems((saleItemsResponse.data as SaleItemRow[]) || [])
          setItems((itemsResponse.data as ItemRow[]) || [])
          setCategories((categoriesResponse.data as CategoryRow[]) || [])
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load sales analytics')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void loadAnalytics(true)

    const channel = supabase
      .channel('sales-manager-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        void loadAnalytics(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, () => {
        void loadAnalytics(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        void loadAnalytics(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        void loadAnalytics(false)
      })
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [])

  const range = useMemo(() => {
    if (datePreset === 'custom') {
      const from = customFrom ? startOfDay(safeDateValue(customFrom) || new Date(customFrom)) : null
      const to = customTo ? endOfDay(safeDateValue(customTo) || new Date(customTo)) : null
      return { from, to }
    }

    return getPresetRange(datePreset)
  }, [customFrom, customTo, datePreset])

  const itemById = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  const categoryById = useMemo(() => new Map(categories.map(category => [category.id, category.name])), [categories])
  const saleById = useMemo(() => new Map(sales.map(sale => [sale.id, sale])), [sales])

  const analyticsRows = useMemo<AnalyticsRow[]>(() => {
    const rows: AnalyticsRow[] = []

    for (const saleItem of saleItems) {
      const sale = saleById.get(saleItem.sale_id)
      if (!sale) continue

      const status = (sale.status || 'completed').toLowerCase()
      if (status === 'cancelled') continue

      const sign = status === 'returned' ? -1 : 1
      const item = itemById.get(saleItem.item_id)
      if (!item) continue

      const saleDate = new Date(sale.sale_date || sale.created_at || '')
      if (Number.isNaN(saleDate.getTime())) continue

      const categoryName = categoryById.get(item.category_id) || 'Unassigned'
      const quantity = Number(saleItem.quantity || 0) * sign
      const revenue = Number(saleItem.subtotal || Number(saleItem.quantity || 0) * Number(saleItem.unit_price || 0)) * sign

      rows.push({
        saleId: sale.id,
        saleDate: sale.sale_date || sale.created_at || new Date().toISOString(),
        billNumber: sale.bill_number || sale.id.slice(0, 8),
        status,
        itemId: item.id,
        itemName: item.name,
        categoryId: item.category_id,
        categoryName,
        quantity,
        revenue,
        sign,
      })
    }

    return rows
  }, [categoryById, itemById, saleById, saleItems])

  const filteredRows = useMemo(() => {
    return analyticsRows.filter(row => {
      const rowDate = new Date(row.saleDate)
      if (range.from && rowDate < range.from) return false
      if (range.to && rowDate > range.to) return false
      if (categoryId !== 'all' && row.categoryId !== categoryId) return false
      if (itemId !== 'all' && row.itemId !== itemId) return false
      return true
    })
  }, [analyticsRows, categoryId, itemId, range.from, range.to])

  const summary = useMemo<SalesSummary>(() => {
    const orderMap = new Map<string, SalesRow>()
    for (const sale of sales) {
      const saleDate = new Date(sale.sale_date || sale.created_at || '')
      if (Number.isNaN(saleDate.getTime())) continue
      if (range.from && saleDate < range.from) continue
      if (range.to && saleDate > range.to) continue
      const status = (sale.status || 'completed').toLowerCase()
      if (categoryId !== 'all' || itemId !== 'all') {
        const hasVisibleItem = analyticsRows.some(row => row.saleId === sale.id && filteredRows.some(filtered => filtered.saleId === row.saleId))
        if (!hasVisibleItem) continue
      }
      if (status !== 'cancelled') {
        orderMap.set(sale.id, sale)
      }
    }

    const itemMap = new Map<string, ItemAnalyticsRow>()
    const categoryMap = new Map<string, CategoryAnalyticsRow>()
    const dailyMap = new Map<string, DailyRevenueRow>()

    for (const row of filteredRows) {
      const itemEntry = itemMap.get(row.itemId) || { itemName: row.itemName, categoryName: row.categoryName, quantitySold: 0, revenue: 0 }
      itemEntry.quantitySold += row.quantity
      itemEntry.revenue += row.revenue
      itemMap.set(row.itemId, itemEntry)

      const categoryEntry = categoryMap.get(row.categoryId) || { categoryName: row.categoryName, revenue: 0, quantitySold: 0 }
      categoryEntry.revenue += row.revenue
      categoryEntry.quantitySold += row.quantity
      categoryMap.set(row.categoryId, categoryEntry)

      const dateKey = new Date(row.saleDate).toISOString().slice(0, 10)
      const existingDaily = dailyMap.get(dateKey) || { dateKey, label: formatDateKey(dateKey), revenue: 0, itemsSold: 0 }
      existingDaily.revenue += row.revenue
      existingDaily.itemsSold += row.quantity
      dailyMap.set(dateKey, existingDaily)
    }

    const itemAnalytics = Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue)
    const topItemRow = itemAnalytics[0]
    const totalRevenue = itemAnalytics.reduce((sum, row) => sum + row.revenue, 0)
    const totalItemsSold = itemAnalytics.reduce((sum, row) => sum + row.quantitySold, 0)
    const completedCount = Array.from(orderMap.values()).filter(sale => (sale.status || 'completed').toLowerCase() === 'completed').length
    const returnedCount = Array.from(orderMap.values()).filter(sale => (sale.status || '').toLowerCase() === 'returned').length
    const cancelledCount = sales.filter(sale => (sale.status || '').toLowerCase() === 'cancelled').length
    const orderCount = completedCount + returnedCount
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0

    return {
      totalRevenue,
      totalItemsSold,
      topItem: topItemRow?.itemName || 'No sales',
      topItemRevenue: topItemRow?.revenue || 0,
      avgOrderValue,
      orderCount,
      completedCount,
      returnedCount,
      cancelledCount,
    }
  }, [categoryId, filteredRows, range.from, range.to, sales])

  const itemAnalytics = useMemo<ItemAnalyticsRow[]>(() => {
    const map = new Map<string, ItemAnalyticsRow>()
    for (const row of filteredRows) {
      const current = map.get(row.itemId) || { itemName: row.itemName, categoryName: row.categoryName, quantitySold: 0, revenue: 0 }
      current.quantitySold += row.quantity
      current.revenue += row.revenue
      map.set(row.itemId, current)
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [filteredRows])

  const categoryAnalytics = useMemo<CategoryAnalyticsRow[]>(() => {
    const map = new Map<string, CategoryAnalyticsRow>()
    for (const row of filteredRows) {
      const current = map.get(row.categoryName) || { categoryName: row.categoryName, revenue: 0, quantitySold: 0 }
      current.revenue += row.revenue
      current.quantitySold += row.quantity
      map.set(row.categoryName, current)
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [filteredRows])

  const trendData = useMemo(() => {
    const map = new Map<string, DailyRevenueRow>()
    for (const row of filteredRows) {
      const dateKey = new Date(row.saleDate).toISOString().slice(0, 10)
      const current = map.get(dateKey) || { dateKey, label: formatDateKey(dateKey), revenue: 0, itemsSold: 0 }
      current.revenue += row.revenue
      current.itemsSold += row.quantity
      map.set(dateKey, current)
    }
    const points = Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    return points.length > 0 ? points : [{ dateKey: 'empty', label: 'No data', revenue: 0, itemsSold: 0 }]
  }, [filteredRows])

  const itemChartData = useMemo(() => itemAnalytics.slice(0, 8).map(row => ({
    name: row.itemName,
    revenue: row.revenue,
    quantitySold: row.quantitySold,
  })), [itemAnalytics])

  const topItemChartData = useMemo(() => itemAnalytics.slice(0, 5).map(row => ({
    name: row.itemName,
    quantitySold: row.quantitySold,
  })), [itemAnalytics])

  const categoryChartData = useMemo(() => categoryAnalytics.map(row => ({
    name: row.categoryName,
    revenue: row.revenue,
    quantitySold: row.quantitySold,
  })), [categoryAnalytics])

  const insights = useMemo<Insights>(() => {
    const lowPerformers = itemAnalytics.filter(row => row.quantitySold <= 3 || row.revenue <= 500).slice(0, 4)
    const highPerformers = itemAnalytics.slice(0, 4)
    return { lowPerformers, highPerformers }
  }, [itemAnalytics])

  const selectedCategoryName = categoryId === 'all' ? 'All categories' : categoryById.get(categoryId) || 'Selected category'
  const selectedItemName = itemId === 'all' ? 'All items' : itemById.get(itemId)?.name || 'Selected item'
  const rangeLabel = useMemo(() => {
    if (datePreset === 'custom') {
      if (!customFrom && !customTo) return 'Custom range'
      return `${customFrom || 'Start'} to ${customTo || 'Today'}`
    }
    if (datePreset === 'today') return 'Today'
    if (datePreset === '7d') return 'Last 7 days'
    return 'Last 30 days'
  }, [customFrom, customTo, datePreset])

  const hasData = filteredRows.length > 0

  const summaryCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(summary.totalRevenue),
      icon: DollarSign,
      trend: 'up' as const,
      subtext: 'Completed sales minus returns and excluding cancelled orders.',
    },
    {
      label: 'Total Items Sold',
      value: summary.totalItemsSold,
      icon: PackageSearch,
      trend: summary.totalItemsSold >= 0 ? ('up' as const) : ('down' as const),
      subtext: 'Net quantity sold in the selected scope.',
    },
    {
      label: 'Top Item',
      value: summary.topItem,
      icon: BarChart3,
      trend: 'up' as const,
      subtext: `${formatCurrency(summary.topItemRevenue)} revenue leader`,
    },
    {
      label: 'Avg Order Value',
      value: formatCurrency(summary.avgOrderValue),
      icon: TrendingUp,
      trend: 'up' as const,
      subtext: `${summary.orderCount} orders in the current scope`,
    },
  ]

  const exportRows = useMemo(() => itemAnalytics.map(row => ({
    'Item Name': row.itemName,
    'Category': row.categoryName,
    'Quantity Sold': row.quantitySold,
    'Revenue': row.revenue,
  })), [itemAnalytics])

  return (
    <SalesManagerPageShell
      badge={<><Sparkles className="h-4 w-4 text-cyan-500" /> Sales performance analytics</>}
      title="Sales Analytics"
      description="Track revenue, identify top-performing products, and optimize sales strategy from a single dashboard."
      actions={
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
          <div className="space-y-1">
            <Label htmlFor="date-range" className="text-xs text-muted-foreground">Date Range</Label>
            <Select value={datePreset} onValueChange={value => setDatePreset(value as FilterPreset)}>
              <SelectTrigger id="date-range" className="min-w-45 border-border/70 bg-background/80">
                <SelectValue placeholder="Last 30 days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="category-filter" className="text-xs text-muted-foreground">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category-filter" className="min-w-45 border-border/70 bg-background/80">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="item-filter" className="text-xs text-muted-foreground">Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger id="item-filter" className="min-w-45 border-border/70 bg-background/80">
                <SelectValue placeholder="All items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All items</SelectItem>
                {items.map(item => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {datePreset === 'custom' ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="custom-from" className="text-xs text-muted-foreground">From</Label>
                <Input id="custom-from" type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)} className="min-w-40 border-border/70 bg-background/80" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="custom-to" className="text-xs text-muted-foreground">To</Label>
                <Input id="custom-to" type="date" value={customTo} onChange={event => setCustomTo(event.target.value)} className="min-w-40 border-border/70 bg-background/80" />
              </div>
            </>
          ) : null}

          <Button
            variant="outline"
            className="justify-self-start border-border/70 bg-background/70 backdrop-blur sm:self-end"
            onClick={() => {
              setDatePreset('30d')
              setCustomFrom('')
              setCustomTo('')
              setCategoryId('all')
              setItemId('all')
            }}
            disabled={loading}
          >
            Reset
          </Button>

          <Button
            className="justify-self-start bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20 sm:self-end"
            onClick={() => {
              setRefreshing(true)
              setTimeout(() => setRefreshing(false), 400)
            }}
            disabled={loading || refreshing}
          >
            <RefreshCw className={refreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(card => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            trend={card.trend}
            subtext={card.subtext}
          />
        ))}
      </section>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardContent className="pt-6">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              <span>Analytics window: {rangeLabel}</span>
              <Badge variant="outline" className="border-border/70 bg-background/70 text-foreground">{selectedCategoryName}</Badge>
              <Badge variant="outline" className="border-border/70 bg-background/70 text-foreground">{selectedItemName}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status mix</p>
                <p className="mt-1 font-semibold text-foreground">{summary.completedCount} completed · {summary.returnedCount} returned</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible rows</p>
                <p className="mt-1 font-semibold text-foreground">{filteredRows.length} item-sale rows</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!loading && !hasData ? (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-semibold text-foreground">No sales data available</p>
            <p className="max-w-md text-sm text-muted-foreground">Try changing the date range, category, or item filter, or wait for completed sales data to arrive.</p>
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)} className="space-y-4">
        <TabsList className="grid h-14 w-full max-w-4xl grid-cols-4 rounded-full border border-border/70 bg-background/90 p-1 shadow-sm shadow-slate-950/5 backdrop-blur">
          <TabsTrigger
            value="overview"
            className="flex h-12 items-center justify-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-all hover:text-foreground data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-950/20"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="items"
            className="flex h-12 items-center justify-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-all hover:text-foreground data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-950/20"
          >
            Items
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="flex h-12 items-center justify-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-all hover:text-foreground data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-950/20"
          >
            Categories
          </TabsTrigger>
          <TabsTrigger
            value="trends"
            className="flex h-12 items-center justify-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-all hover:text-foreground data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-950/20"
          >
            Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Revenue per Item</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Loading revenue breakdown...</div>
                ) : itemChartData.length === 0 ? (
                  <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <p>No item data available.</p>
                    <p>Try widening the date range or clearing filters.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={itemChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" hide />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#0f172a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="font-semibold text-foreground">High performers</p>
                  <p className="mt-1 text-sm text-muted-foreground">Increase stock and keep promotions visible.</p>
                  <div className="mt-3 space-y-2">
                    {insights.highPerformers.length > 0 ? insights.highPerformers.map(row => (
                      <div key={row.itemName} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-sm">
                        <span>{row.itemName}</span>
                        <span className="font-medium text-emerald-600">{formatCurrency(row.revenue)}</span>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No high-performing items yet.</p>}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="font-semibold text-foreground">Low performers</p>
                  <p className="mt-1 text-sm text-muted-foreground">Consider discounts or bundle offers.</p>
                  <div className="mt-3 space-y-2">
                    {insights.lowPerformers.length > 0 ? insights.lowPerformers.map(row => (
                      <div key={row.itemName} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-sm">
                        <span>{row.itemName}</span>
                        <span className="font-medium text-rose-600">{row.quantitySold} sold</span>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No low performers in the selected scope.</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Top Selling Items</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Loading top selling items...</div>
                ) : topItemChartData.length === 0 ? (
                  <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <p>No top selling item data.</p>
                    <p>Try another date range or remove filters.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={topItemChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" stroke="#94a3b8" />
                      <YAxis type="category" dataKey="name" stroke="#94a3b8" width={120} />
                      <Tooltip formatter={(value: number) => [value, 'Net Quantity']} />
                      <Legend />
                      <Bar dataKey="quantitySold" name="Net Quantity" fill="#0f766e" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Top Item Spotlight</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="text-sm text-muted-foreground">Top item by revenue</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{summary.topItem}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Revenue leader: {formatCurrency(summary.topItemRevenue)}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="text-sm text-muted-foreground">Best action</p>
                  <p className="mt-1 text-sm text-foreground">Increase stock, maintain availability, and keep this item visible in promotions.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <DataTable
            title="Revenue per Item"
            columns={[
              { key: 'itemName', label: 'Item Name' },
              { key: 'categoryName', label: 'Category' },
              { key: 'quantitySold', label: 'Quantity Sold' },
              { key: 'revenue', label: 'Revenue', render: value => formatCurrency(Number(value)) },
            ]}
            data={itemAnalytics}
            loading={loading}
            emptyMessage="No item analytics available"
            pageSize={10}
          />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Category Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Loading category revenue...</div>
                ) : categoryChartData.length === 0 ? (
                  <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <p>No category revenue data.</p>
                    <p>Try removing the item filter or expanding the range.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={categoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" radius={[8, 8, 0, 0]}>
                        {categoryChartData.map((entry, index) => (
                          <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Category Highlights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryAnalytics.slice(0, 5).map((row, index) => (
                  <div key={row.categoryName} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{row.categoryName}</p>
                        <p className="text-sm text-muted-foreground">{row.quantitySold} units sold</p>
                      </div>
                      <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">#{index + 1}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">Revenue</p>
                    <p className="text-xl font-semibold tracking-tight">{formatCurrency(row.revenue)}</p>
                  </div>
                ))}
                {categoryAnalytics.length === 0 && !loading ? <p className="text-sm text-muted-foreground">No category data available for the selected filters.</p> : null}
              </CardContent>
            </Card>
          </div>

          <DataTable
            title="Category Revenue Table"
            columns={[
              { key: 'categoryName', label: 'Category' },
              { key: 'quantitySold', label: 'Quantity Sold' },
              { key: 'revenue', label: 'Revenue', render: value => formatCurrency(Number(value)) },
            ]}
            data={categoryAnalytics}
            loading={loading}
            emptyMessage="No category analytics available"
            pageSize={10}
          />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Loading revenue trend...</div>
                ) : trendData.length === 0 ? (
                  <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <p>No trend data available.</p>
                    <p>Try a wider date range or clear filters.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={340}>
                    <ComposedChart data={trendData} margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
                      <defs>
                        <linearGradient id="revenueTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.9} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0.35} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="#cbd5e1" strokeOpacity={0.85} vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis yAxisId="left" stroke="#94a3b8" tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tickLine={false} axisLine={false} tickMargin={10} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: '1px solid rgba(148,163,184,0.25)',
                          background: 'rgba(255,255,255,0.98)',
                          boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
                        }}
                        formatter={(value: number, name) => [name === 'itemsSold' ? value : formatCurrency(value), name === 'itemsSold' ? 'Items Sold' : 'Revenue']}
                      />
                      <Legend wrapperStyle={{ paddingTop: 18 }} />
                      <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="url(#revenueTrendFill)" radius={[12, 12, 0, 0]} barSize={28} />
                      <Line yAxisId="right" type="monotone" dataKey="itemsSold" name="Items Sold" stroke="#0f172a" strokeWidth={3} dot={{ r: 5, fill: '#0f172a', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 7, fill: '#0f172a', stroke: '#ffffff', strokeWidth: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Daily Momentum</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="font-semibold text-foreground">Fast growth items</p>
                  <p className="mt-1">Monitor items with rising revenue and keep them stocked.</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="font-semibold text-foreground">Revenue risk</p>
                  <p className="mt-1">If an item drops below the low performer threshold, consider promotions or bundle pricing.</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="font-semibold text-foreground">Realtime refresh</p>
                  <p className="mt-1">Analytics updates automatically when sales or sale items change.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <DataTable
            title="Daily Revenue"
            columns={[
              { key: 'label', label: 'Date' },
              { key: 'itemsSold', label: 'Items Sold' },
              { key: 'revenue', label: 'Revenue', render: value => formatCurrency(Number(value)) },
            ]}
            data={trendData}
            loading={loading}
            emptyMessage="No daily trend data available"
            pageSize={10}
          />
        </TabsContent>
      </Tabs>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Actionable Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">High performers</p>
            <p className="mt-1 text-2xl font-semibold">{insights.highPerformers.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Keep these items visible in promotions and stock planning.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Low performers</p>
            <p className="mt-1 text-2xl font-semibold">{insights.lowPerformers.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Consider discounts or bundle offers to improve movement.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Cancelled orders</p>
            <p className="mt-1 text-2xl font-semibold">{summary.cancelledCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Excluded from analytics to keep revenue accurate.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Report Access</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Sales Manager and Admin can access this page. Salesman access is denied by the dashboard layout.</p>
            <p>Revenue formula: item subtotal from completed sales minus returned sales.</p>
          </div>
          <Button asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
            <Link href="/sales-manager/dashboard/reports">
              View reports
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </SalesManagerPageShell>
  )
}
