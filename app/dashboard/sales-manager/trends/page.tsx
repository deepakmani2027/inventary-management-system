'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, BarChart3, CalendarRange, ChevronDown, CircleAlert, DollarSign, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { SalesManagerPageShell } from '@/components/dashboard/sales-manager-page-shell'
import { StatCard } from '@/components/dashboard/stat-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChartContainer, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { getSupabaseClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type ViewMode = 'daily' | 'weekly' | 'monthly'
type DatePreset = '7d' | '30d' | '12m' | 'custom'

type SaleRow = {
  id: string
  salesman_id: string
  bill_number: string | null
  sale_date: string
  total_amount: number
  status: string | null
  created_at: string | null
  updated_at: string | null
}

type SaleItemRow = {
  sale_id: string
  item_id: string
  quantity: number
  subtotal: number
}

type ItemRow = {
  id: string
  name: string
  category_id: string
}

type CategoryRow = {
  id: string
  name: string
}

type TrendPoint = {
  key: string
  label: string
  revenue: number
  orders: number
  salesCount: number
}

type DailyBucket = {
  key: string
  label: string
  revenue: number
  orders: number
}

function formatCurrency(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function toInputDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfDay(value: Date) {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(value: Date) {
  const next = new Date(value)
  next.setHours(23, 59, 59, 999)
  return next
}

function getUtcDayKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function getWeekKey(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  const day = date.getUTCDay()
  const mondayOffset = (day + 6) % 7
  date.setUTCDate(date.getUTCDate() - mondayOffset)
  return date.toISOString().slice(0, 10)
}

function formatDayLabel(key: string) {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${key}T00:00:00Z`))
}

function formatWeekLabel(key: string) {
  const start = new Date(`${key}T00:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return `${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(start)} - ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(end)}`
}

function formatMonthLabel(key: string) {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${key}-01T00:00:00Z`))
}

function getCurrentRange(preset: DatePreset, customFrom: string, customTo: string) {
  const now = new Date()

  if (preset === 'custom') {
    const from = customFrom ? startOfDay(new Date(customFrom)) : null
    const to = customTo ? endOfDay(new Date(customTo)) : null
    return { from, to }
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

  const from = new Date(now)
  from.setMonth(from.getMonth() - 11)
  return { from: startOfDay(from), to: endOfDay(now) }
}

function getPreviousRange(from: Date | null, to: Date | null) {
  if (!from || !to) return { from: null, to: null }
  const spanMs = to.getTime() - from.getTime()
  return {
    from: new Date(from.getTime() - spanMs - 1),
    to: new Date(from.getTime() - 1),
  }
}

function getPeriodKey(value: Date, viewMode: ViewMode) {
  if (viewMode === 'weekly') {
    return getWeekKey(value)
  }

  if (viewMode === 'monthly') {
    return value.toISOString().slice(0, 7)
  }

  return getUtcDayKey(value)
}

function getPeriodLabel(key: string, viewMode: ViewMode) {
  if (viewMode === 'weekly') return formatWeekLabel(key)
  if (viewMode === 'monthly') return formatMonthLabel(key)
  return formatDayLabel(key)
}

function getGrowthRate(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function getTrendLabel(current: number, previous: number) {
  if (current > previous) return { label: 'Increasing', tone: 'positive' as const }
  if (current < previous) return { label: 'Decreasing', tone: 'negative' as const }
  return { label: 'Stable', tone: 'neutral' as const }
}

export default function SalesManagerTrendsPage() {
  const [sales, setSales] = useState<SaleRow[]>([])
  const [saleItems, setSaleItems] = useState<SaleItemRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [datePreset, setDatePreset] = useState<DatePreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [categoryId, setCategoryId] = useState('all')

  useEffect(() => {
    let cancelled = false
    const supabase = getSupabaseClient()

    const load = async (showSpinner = true) => {
      if (showSpinner) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      try {
        const [salesResponse, saleItemsResponse, itemsResponse, categoriesResponse] = await Promise.all([
          supabase
            .from('sales')
            .select('id, salesman_id, bill_number, sale_date, total_amount, status, created_at, updated_at')
            .order('sale_date', { ascending: false }),
          supabase
            .from('sale_items')
            .select('sale_id, item_id, quantity, subtotal'),
          supabase
            .from('items')
            .select('id, name, category_id')
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
          setSales((salesResponse.data as SaleRow[]) || [])
          setSaleItems((saleItemsResponse.data as SaleItemRow[]) || [])
          setItems((itemsResponse.data as ItemRow[]) || [])
          setCategories((categoriesResponse.data as CategoryRow[]) || [])
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load sales trends')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void load(true)

    const channel = supabase
      .channel('sales-manager-trends')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        void load(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, () => {
        void load(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        void load(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        void load(false)
      })
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [])

  const range = useMemo(() => getCurrentRange(datePreset, customFrom, customTo), [customFrom, customTo, datePreset])
  const previousRange = useMemo(() => getPreviousRange(range.from, range.to), [range.from, range.to])
  const itemById = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  const categoryById = useMemo(() => new Map(categories.map(category => [category.id, category.name])), [categories])

  const saleItemBySaleId = useMemo(() => {
    const map = new Map<string, SaleItemRow[]>()
    for (const saleItem of saleItems) {
      const current = map.get(saleItem.sale_id) || []
      current.push(saleItem)
      map.set(saleItem.sale_id, current)
    }
    return map
  }, [saleItems])

  const normalizedSales = useMemo(() => {
    return sales
      .map(sale => {
        const status = String(sale.status || 'completed').toLowerCase()
        const saleDate = new Date(sale.sale_date || sale.created_at || new Date().toISOString())
        if (Number.isNaN(saleDate.getTime())) return null
        if (status === 'cancelled') return null

        const itemsForSale = saleItemBySaleId.get(sale.id) || []
        const sign = status === 'returned' ? -1 : 1

        let revenue = 0
        let salesCount = 0

        for (const saleItem of itemsForSale) {
          const item = itemById.get(saleItem.item_id)
          if (!item) continue
          if (categoryId !== 'all' && item.category_id !== categoryId) continue

          const amount = Number(saleItem.subtotal || 0)
          revenue += amount * sign
          salesCount += Number(saleItem.quantity || 0)
        }

        if (categoryId !== 'all' && revenue === 0 && salesCount === 0) return null

        return {
          id: sale.id,
          saleDate,
          revenue: revenue || Number(sale.total_amount || 0) * sign,
          salesCount,
          status,
          billNumber: sale.bill_number || sale.id.slice(0, 8),
        }
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
  }, [categoryId, itemById, saleItemBySaleId, sales])

  const visibleSales = useMemo(() => {
    return normalizedSales.filter(sale => {
      if (range.from && sale.saleDate < range.from) return false
      if (range.to && sale.saleDate > range.to) return false
      return true
    })
  }, [normalizedSales, range.from, range.to])

  const currentPeriodSales = useMemo(() => {
    return visibleSales.map(sale => ({
      key: getPeriodKey(sale.saleDate, viewMode),
      sale,
    }))
  }, [visibleSales, viewMode])

  const previousPeriodSales = useMemo(() => {
    return normalizedSales.filter(sale => {
      if (!previousRange.from || !previousRange.to) return false
      return sale.saleDate >= previousRange.from && sale.saleDate <= previousRange.to
    })
  }, [normalizedSales, previousRange.from, previousRange.to])

  const trendData = useMemo<TrendPoint[]>(() => {
    const map = new Map<string, TrendPoint>()

    for (const entry of currentPeriodSales) {
      const key = entry.key
      const label = getPeriodLabel(key, viewMode)
      const current = map.get(key) || { key, label, revenue: 0, orders: 0, salesCount: 0 }
      current.revenue += entry.sale.revenue
      current.orders += 1
      current.salesCount += entry.sale.salesCount
      map.set(key, current)
    }

    const points = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))

    if (points.length === 0) {
      return []
    }

    return points
  }, [currentPeriodSales, viewMode])

  const previousTrendData = useMemo(() => {
    const map = new Map<string, TrendPoint>()

    for (const sale of previousPeriodSales) {
      const key = getPeriodKey(sale.saleDate, viewMode)
      const label = getPeriodLabel(key, viewMode)
      const current = map.get(key) || { key, label, revenue: 0, orders: 0, salesCount: 0 }
      current.revenue += sale.revenue
      current.orders += 1
      current.salesCount += sale.salesCount
      map.set(key, current)
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
  }, [previousPeriodSales, viewMode])

  const summary = useMemo(() => {
    const revenue = trendData.reduce((sum, point) => sum + point.revenue, 0)
    const orders = trendData.reduce((sum, point) => sum + point.orders, 0)
    const previousRevenue = previousTrendData.reduce((sum, point) => sum + point.revenue, 0)
    const growthRate = getGrowthRate(revenue, previousRevenue)
    const avgDailySales = viewMode === 'daily'
      ? revenue / Math.max(trendData.length, 1)
      : revenue / Math.max(Math.ceil((range.to?.getTime() || Date.now() - (range.from?.getTime() || Date.now())) / (1000 * 60 * 60 * 24)), 1)

    return {
      revenue,
      orders,
      previousRevenue,
      growthRate,
      avgDailySales,
    }
  }, [previousTrendData, range.from, range.to, trendData, viewMode])

  const trendDirection = getTrendLabel(summary.revenue, summary.previousRevenue)

  const peakDay = useMemo(() => {
    if (trendData.length === 0) return null
    return [...trendData].sort((a, b) => b.revenue - a.revenue)[0]
  }, [trendData])

  const lowestDay = useMemo(() => {
    if (trendData.length === 0) return null
    return [...trendData].sort((a, b) => a.revenue - b.revenue)[0]
  }, [trendData])

  const currentLast = trendData[trendData.length - 1]?.revenue || 0
  const previousLast = previousTrendData[previousTrendData.length - 1]?.revenue || 0
  const smartAlert = currentLast < previousLast
    ? {
        tone: 'negative' as const,
        title: 'Sales dropping this period',
        message: 'Revenue is below the previous comparable period. Review pricing, inventory, and promotions.',
      }
    : currentLast > previousLast
      ? {
          tone: 'positive' as const,
          title: `Sales increased by ${summary.growthRate.toFixed(1)}%`,
          message: 'Revenue is outperforming the previous comparable period.',
        }
      : {
          tone: 'neutral' as const,
          title: 'Sales are stable',
          message: 'Revenue is tracking close to the previous period.',
        }

  const chartData = useMemo(() => {
    return trendData.map(point => ({
      ...point,
      revenue: Number(point.revenue.toFixed(2)),
      orders: point.orders,
      salesCount: point.salesCount,
    }))
  }, [trendData])

  return (
    <SalesManagerPageShell
      badge={
        <>
          <Sparkles className="h-4 w-4 text-cyan-500" />
          Revenue movement
        </>
      }
      title="Sales Trends"
      description="Analyze sales performance over time, compare periods, and react to growth or decline instantly."
      actions={
        <>
          <Button
            variant="outline"
            className="border-border/70 bg-background/80 backdrop-blur"
            onClick={() => window.location.reload()}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button asChild className="bg-slate-950 text-white hover:bg-slate-800">
            <Link href="/sales-manager/dashboard/reports">
              Reports
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-lg shadow-slate-950/5 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Filters</h2>
              <p className="mt-1 text-sm text-muted-foreground">Date range, view mode, and category update the chart instantly.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Date range</label>
                <Select value={datePreset} onValueChange={value => setDatePreset(value as DatePreset)}>
                  <SelectTrigger className="min-w-44 bg-background/80">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="12m">Last 12 months</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">View mode</label>
                <Select value={viewMode} onValueChange={value => setViewMode(value as ViewMode)}>
                  <SelectTrigger className="min-w-44 bg-background/80">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Category</label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="min-w-44 bg-background/80">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {datePreset === 'custom' ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={event => setCustomFrom(event.target.value)}
                  className="h-10 w-full rounded-md border border-border/70 bg-background/80 px-3 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={event => setCustomTo(event.target.value)}
                  className="h-10 w-full rounded-md border border-border/70 bg-background/80 px-3 text-sm"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-lg shadow-slate-950/5 backdrop-blur sm:p-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              <span>
                {range.from ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(range.from) : 'Start'} - {range.to ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(range.to) : 'Now'}
              </span>
            </div>

            <div className={cn('rounded-2xl border p-4', smartAlert.tone === 'positive' && 'border-emerald-500/20 bg-emerald-500/10', smartAlert.tone === 'negative' && 'border-rose-500/20 bg-rose-500/10', smartAlert.tone === 'neutral' && 'border-slate-500/20 bg-slate-500/10')}>
              <div className="flex items-center gap-2">
                {smartAlert.tone === 'negative' ? <TrendingDown className="h-4 w-4 text-rose-600" /> : <TrendingUp className="h-4 w-4 text-emerald-600" />}
                <p className="font-semibold text-foreground">{smartAlert.title}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{smartAlert.message}</p>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Rules</p>
              <p>Cancelled sales are excluded. Returns reduce revenue. Growth compares the selected period to the previous comparable period.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Revenue" value={formatCurrency(summary.revenue)} icon={DollarSign} trend={trendDirection.tone === 'positive' ? 'up' : 'down'} subtext="Revenue for the selected range." />
        <StatCard label="Total Orders" value={summary.orders} icon={BarChart3} trend="up" subtext="Completed and returned orders in the selected range." />
        <StatCard label="Average Daily Sales" value={formatCurrency(summary.avgDailySales)} icon={CalendarRange} trend="up" subtext="Average revenue per day in the current range." />
        <StatCard label="Growth Rate" value={`${summary.growthRate >= 0 ? '+' : ''}${summary.growthRate.toFixed(1)}%`} icon={ArrowUpRight} trend={summary.growthRate >= 0 ? 'up' : 'down'} subtext="Current period vs previous comparable period." />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Main Trend</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{viewMode === 'daily' ? 'Day-to-day revenue and orders' : viewMode === 'weekly' ? 'Weekly revenue and orders' : 'Monthly revenue and orders'}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-3 py-1">Revenue</span>
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-3 py-1">Orders</span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">Loading trend data...</div>
            ) : chartData.length === 0 ? (
              <div className="flex h-96 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 text-center text-sm text-muted-foreground">
                <p>No sales found for the selected range.</p>
                <p>Try another date range or clear the category filter.</p>
              </div>
            ) : (
              <ChartContainer
                config={{
                  revenue: { label: 'Revenue', color: '#0f766e' },
                  orders: { label: 'Orders', color: '#0f172a' },
                }}
                className="aspect-auto h-105 w-full"
              >
                <ComposedChart data={chartData} margin={{ top: 12, right: 20, left: 8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.88} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#cbd5e1" strokeOpacity={0.8} vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickMargin={10} />
                  <Tooltip content={<ChartTooltipContent indicator="line" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" fill="url(#salesTrendFill)" stroke="#0f766e" strokeWidth={3} dot={{ r: 4, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="orders" name="Orders" stroke="#0f172a" strokeWidth={3} dot={{ r: 4, fill: '#0f172a', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#0f172a', stroke: '#ffffff', strokeWidth: 2 }} />
                </ComposedChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Secondary Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="font-semibold text-foreground">Peak Sales Day</p>
              <p className="mt-1">{peakDay ? `Highest sales: ${peakDay.label} (${formatCurrency(peakDay.revenue)})` : 'No peak sales data yet.'}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="font-semibold text-foreground">Lowest Sales Day</p>
              <p className="mt-1">{lowestDay ? `Lowest sales: ${lowestDay.label} (${formatCurrency(lowestDay.revenue)})` : 'No low sales data yet.'}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="font-semibold text-foreground">Trend Indicator</p>
              <p className="mt-1 flex items-center gap-2">
                {trendDirection.tone === 'positive' ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : trendDirection.tone === 'negative' ? <TrendingDown className="h-4 w-4 text-rose-600" /> : <CircleAlert className="h-4 w-4 text-slate-500" />}
                {trendDirection.label}
              </p>
            </div>
            <div className={cn('rounded-2xl border p-4', smartAlert.tone === 'negative' ? 'border-rose-500/20 bg-rose-500/5' : 'border-emerald-500/20 bg-emerald-500/5')}>
              <p className="font-semibold text-foreground">Smart Alert</p>
              <p className="mt-1">{smartAlert.message}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Top Periods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {chartData.length > 0 ? [...chartData].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map(point => (
              <div key={point.key} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{point.label}</p>
                    <p className="text-sm text-muted-foreground">{point.orders} orders, {point.salesCount} items sold</p>
                  </div>
                  <p className="font-semibold text-foreground">{formatCurrency(point.revenue)}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">No trend periods to show.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Report Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Sales Manager and Admin can access this page. Salesman access remains blocked by the dashboard layout.</p>
            <p>Revenue excludes cancelled sales and treats returns as negative revenue so the chart reflects real performance.</p>
            <Button asChild className="bg-slate-950 text-white hover:bg-slate-800">
              <Link href="/sales-manager/dashboard/reports">
                View reports
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </SalesManagerPageShell>
  )
}