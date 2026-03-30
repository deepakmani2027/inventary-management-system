'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, CalendarRange, Flame, RefreshCcw, ShieldAlert, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend, ComposedChart, Area } from 'recharts'
import { getSupabaseClient } from '@/lib/supabase/client'
import { InventoryPageShell } from '@/components/dashboard/inventory-page-shell'
import { StatCard } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type CategoryRow = { id: string; name: string }
type ItemRow = { id: string; name: string; category_id: string }
type MovementPoint = {
  date: string
  rawDate: string
  sales: number
  restock: number
  returns: number
  cancels: number
  net: number
  stockLevel: number
}
type ItemActivityRow = {
  item_id: string
  item_name: string
  category: string
  sales: number
  restock: number
  returns: number
  cancels: number
  net: number
  current_stock: number
  sales_frequency: number
  activity_score: number
}
type AlertRow = { type: 'negative' | 'positive'; title: string; message: string }

type TrendsResponse = {
  categories: CategoryRow[]
  items: ItemRow[]
  movementSeries: MovementPoint[]
  itemActivity: ItemActivityRow[]
  fastMoving: ItemActivityRow[]
  slowMoving: ItemActivityRow[]
  alerts: AlertRow[]
  summary: {
    totalSales: number
    totalRestocked: number
    totalReturns: number
    totalCancels: number
    netGrowth: number
  }
  filters: {
    from: string | null
    to: string | null
    categoryId: string
    itemId: string
    granularity: 'day' | 'week'
  }
}

type ChartType = 'movement' | 'comparison' | 'items'
type DatePreset = '7d' | '30d' | 'custom'

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10)
}

function parseDateInput(value: string) {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default function InventoryTrendsPage() {
  const [data, setData] = useState<TrendsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [chartType, setChartType] = useState<ChartType>('movement')
  const [datePreset, setDatePreset] = useState<DatePreset>('7d')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [itemId, setItemId] = useState('')

  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 6)
    setFromDate(formatDateInput(start))
    setToDate(formatDateInput(end))
  }, [])

  const loadTrends = async (showSpinner = false) => {
    if (showSpinner) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (categoryId) params.set('categoryId', categoryId)
      if (itemId) params.set('itemId', itemId)

      const from = parseDateInput(fromDate)
      const to = parseDateInput(toDate)
      const daySpan = from && to ? Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000)) : 0
      params.set('granularity', daySpan > 45 ? 'week' : 'day')

      const response = await fetch(`/api/admin/inventory/trends?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load trends')
      }

      setData(payload as TrendsResponse)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load trends')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadTrends()
  }, [fromDate, toDate, categoryId, itemId])

  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel('inventory-trends-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_logs' }, () => {
        void loadTrends(true)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fromDate, toDate, categoryId, itemId])

  const categories = data?.categories || []
  const items = data?.items || []
  const movementSeries = data?.movementSeries || []
  const fastMoving = data?.fastMoving || []
  const slowMoving = data?.slowMoving || []
  const alerts = data?.alerts || []

  const comparisonData = useMemo(() => movementSeries.map(point => ({
    date: point.date,
    sales: point.sales,
    restock: point.restock,
    returns: point.returns,
    cancels: point.cancels,
  })), [movementSeries])

  const moverData = useMemo(() => fastMoving.map(item => ({
    name: item.item_name,
    sales: item.sales_frequency,
    category: item.category,
  })), [fastMoving])

  const selectedItem = data?.itemActivity.find(entry => entry.item_id === itemId)

  const chartTitle = chartType === 'movement'
    ? 'Stock Movement Over Time'
    : chartType === 'comparison'
      ? 'Sales vs Restock'
      : 'Fast vs Slow Moving Items'

  const chartDescription = chartType === 'movement'
    ? 'Cumulative stock movement built from restock, return, cancel, and sale logs.'
    : chartType === 'comparison'
      ? 'Daily inflow and outflow so you can see whether inventory is growing or shrinking.'
      : 'Items ranked by sales frequency to show fast-moving and slow-moving stock.'

  return (
    <InventoryPageShell
      badge={<><TrendingUp className="h-4 w-4 text-cyan-500" /> Movement analytics</>}
      title="Inventory Trends"
      description="Track stock movement over time, identify fast-moving vs slow-moving items, and predict future stock needs."
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="date-preset" className="text-xs text-muted-foreground">Date Range</Label>
            <Select
              value={datePreset}
              onValueChange={value => {
                const nextPreset = value as DatePreset
                setDatePreset(nextPreset)
                const end = new Date()
                const start = new Date()
                if (nextPreset === '7d') {
                  start.setDate(start.getDate() - 6)
                  setFromDate(formatDateInput(start))
                  setToDate(formatDateInput(end))
                } else if (nextPreset === '30d') {
                  start.setDate(start.getDate() - 29)
                  setFromDate(formatDateInput(start))
                  setToDate(formatDateInput(end))
                }
              }}
            >
              <SelectTrigger id="date-preset" className="w-44 border-border/70 bg-background/80">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="trends-category" className="text-xs text-muted-foreground">Category</Label>
            <Select value={categoryId || 'all'} onValueChange={value => {
              const nextValue = value === 'all' ? '' : value
              setCategoryId(nextValue)
              setItemId('')
            }}>
              <SelectTrigger id="trends-category" className="w-44 border-border/70 bg-background/80">
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
            <Label htmlFor="trends-item" className="text-xs text-muted-foreground">Item</Label>
            <Select value={itemId || 'all'} onValueChange={value => setItemId(value === 'all' ? '' : value)}>
              <SelectTrigger id="trends-item" className="w-44 border-border/70 bg-background/80">
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

          <div className="space-y-1">
            <Label htmlFor="chart-type" className="text-xs text-muted-foreground">Chart</Label>
            <Select value={chartType} onValueChange={value => setChartType(value as ChartType)}>
              <SelectTrigger id="chart-type" className="w-44 border-border/70 bg-background/80">
                <SelectValue placeholder="Select chart" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="movement">Movement</SelectItem>
                <SelectItem value="comparison">Sales vs Restock</SelectItem>
                <SelectItem value="items">Fast vs Slow Items</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {datePreset === 'custom' ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="from-date" className="text-xs text-muted-foreground">From</Label>
                <Input id="from-date" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="w-42.5 border-border/70 bg-background/80" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to-date" className="text-xs text-muted-foreground">To</Label>
                <Input id="to-date" type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="w-42.5 border-border/70 bg-background/80" />
              </div>
            </>
          ) : null}

          <Button variant="outline" className="border-border/70 bg-background/70 backdrop-blur" onClick={() => void loadTrends(true)} disabled={loading || refreshing}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-5">
        <StatCard label="Total Sales" value={data?.summary.totalSales || 0} icon={BarChart3} subtext="Units sold in the selected range" />
        <StatCard label="Total Restocked" value={data?.summary.totalRestocked || 0} icon={Activity} subtext="Units added back to stock" />
        <StatCard label="Total Returns" value={data?.summary.totalReturns || 0} icon={TrendingUp} subtext="Units returned to inventory" />
        <StatCard label="Net Growth" value={data?.summary.netGrowth || 0} icon={Flame} subtext="Restock + returns + cancels - sales" />
        <StatCard label="Alert Count" value={alerts.length} icon={alerts.length > 0 ? AlertTriangle : ShieldAlert} subtext="Trend warnings and opportunities" />
      </section>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Trend Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm text-muted-foreground">Current range</p>
              <p className="mt-1 text-lg font-semibold">{fromDate || 'Start'} to {toDate || 'Now'}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm text-muted-foreground">Category filter</p>
              <p className="mt-1 text-lg font-semibold">{categories.find(category => category.id === categoryId)?.name || 'All categories'}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm text-muted-foreground">Item filter</p>
              <p className="mt-1 text-lg font-semibold">{items.find(item => item.id === itemId)?.name || 'All items'}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm text-muted-foreground">Granularity</p>
              <p className="mt-1 text-lg font-semibold">{data?.filters.granularity === 'week' ? 'Weekly' : 'Daily'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">
              <CalendarRange className="mr-1 h-3.5 w-3.5" />
              Inventory movement = restock + returns + cancels - sales
            </Badge>
            {selectedItem ? (
              <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">
                Selected item net: {selectedItem.net >= 0 ? '+' : ''}{selectedItem.net}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {alerts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.map(alert => (
            <Card key={alert.title} className={`border shadow-sm backdrop-blur ${alert.type === 'negative' ? 'border-red-500/20 bg-red-500/10' : 'border-emerald-500/20 bg-emerald-500/10'}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2 ${alert.type === 'negative' ? 'bg-red-500/15 text-red-700' : 'bg-emerald-500/15 text-emerald-700'}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{alert.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{chartTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{chartDescription}</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Loading trend data...</div>
          ) : chartType === 'movement' ? (
            movementSeries.length === 0 ? (
              <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <p>No movement data available.</p>
                <p>Try a different date range or remove filters.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={movementSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="stockLevel" name="Cumulative Movement" fill="#0f172a" stroke="#0f172a" fillOpacity={0.16} />
                  <Line type="monotone" dataKey="net" name="Daily Net" stroke="#0f766e" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            )
          ) : chartType === 'comparison' ? (
            comparisonData.length === 0 ? (
              <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <p>No comparison data available.</p>
                <p>Try a different date range or remove filters.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" name="Sales" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="restock" name="Restock" fill="#0f766e" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="returns" name="Returns" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="cancels" name="Cancels" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          ) : moverData.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <p>No mover data available.</p>
              <p>Try a different category or item selection.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={moverData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" width={140} stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" name="Sales Frequency" fill="#0f172a" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable
          title="Fast Moving Items"
          columns={[
            { key: 'item_name', label: 'Item' },
            { key: 'category', label: 'Category' },
            { key: 'sales_frequency', label: 'Sales', render: value => Number(value).toLocaleString() },
            { key: 'net', label: 'Net', render: value => (Number(value) >= 0 ? `+${Number(value)}` : Number(value).toString()) },
          ]}
          data={fastMoving}
          loading={loading}
          emptyMessage="No fast-moving items"
          pageSize={5}
        />

        <DataTable
          title="Slow Moving Items"
          columns={[
            { key: 'item_name', label: 'Item' },
            { key: 'category', label: 'Category' },
            { key: 'sales_frequency', label: 'Sales', render: value => Number(value).toLocaleString() },
            { key: 'current_stock', label: 'Stock', render: value => Number(value).toLocaleString() },
          ]}
          data={slowMoving}
          loading={loading}
          emptyMessage="No slow-moving items"
          pageSize={5}
        />
      </div>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="mt-1 text-2xl font-semibold">{data?.summary.totalSales || 0}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Total Restocked</p>
            <p className="mt-1 text-2xl font-semibold">{data?.summary.totalRestocked || 0}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Total Returns</p>
            <p className="mt-1 text-2xl font-semibold">{data?.summary.totalReturns || 0}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-sm text-muted-foreground">Net Growth</p>
            <p className={`mt-1 text-2xl font-semibold ${((data?.summary.netGrowth || 0) >= 0) ? 'text-emerald-600' : 'text-red-600'}`}>
              {(data?.summary.netGrowth || 0) >= 0 ? '+' : ''}{data?.summary.netGrowth || 0}
            </p>
          </div>
        </CardContent>
      </Card>
    </InventoryPageShell>
  )
}
