'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarRange, Download, Layers3, ListFilter, PieChart as PieChartIcon, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { InventoryPageShell } from '@/components/dashboard/inventory-page-shell'
import { StatCard } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type CategoryRow = { id: string; name: string }
type CategoryReportRow = { category: string; total_items: number; total_stock: number; total_value: number }
type PriceReportRow = { price_range: 'Low' | 'Medium' | 'High'; item_count: number; total_stock: number; total_value: number }

type ReportResponse = {
  categories: CategoryRow[]
  categoryReport: CategoryReportRow[]
  priceReport: PriceReportRow[]
  summary: {
    totalInventoryValue: number
    totalItems: number
    lowStockItems: number
    generatedAt: string
  }
  activitySummary: {
    restockCount: number
    saleCount: number
    returnCount: number
    cancelCount: number
    adjustmentCount: number
    movementCount: number
  }
  filters: {
    categoryId: string
    from: string | null
    to: string | null
  }
}

type ReportTab = 'category' | 'price'

type MetricCard = {
  label: string
  value: string | number
  icon: typeof BarChart3
  trend: 'up' | 'down'
  helper: string
}

type PriceBandNote = {
  price_range: PriceReportRow['price_range']
  title: string
  description: string
}

const chartColors = ['#0f172a', '#0f766e', '#2563eb', '#d97706', '#db2777', '#7c3aed']
const priceBandNotes: PriceBandNote[] = [
  {
    price_range: 'Low',
    title: 'Low',
    description: 'Items under ₹100. Useful for bulk-count and fast-moving, low-value stock.',
  },
  {
    price_range: 'Medium',
    title: 'Medium',
    description: 'Items from ₹100 to ₹1,000. Usually the mixed middle of the inventory book.',
  },
  {
    price_range: 'High',
    title: 'High',
    description: 'Items above ₹1,000. These usually dominate inventory value even when item counts are small.',
  },
]

function formatCurrency(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function convertToCsv(rows: Array<Record<string, string | number | null | undefined>>) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.map(escapeCsvCell).join(',')]
  for (const row of rows) {
    lines.push(headers.map(header => escapeCsvCell(row[header])).join(','))
  }
  return lines.join('\n')
}

export default function InventoryReportsPage() {
  const [data, setData] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ReportTab>('category')
  const [categoryId, setCategoryId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadReports = async () => {
      setLoading(true)

      try {
        const params = new URLSearchParams()
        if (categoryId) params.set('categoryId', categoryId)
        if (fromDate) params.set('from', fromDate)
        if (toDate) params.set('to', toDate)

        const response = await fetch(`/api/admin/inventory/reports?${params.toString()}`, { cache: 'no-store' })
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load reports')
        }

        if (!cancelled) {
          setData(payload as ReportResponse)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load reports')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadReports()

    return () => {
      cancelled = true
    }
  }, [categoryId, fromDate, toDate])

  const categoryReport = data?.categoryReport || []
  const priceReport = data?.priceReport || []
  const categories = data?.categories || []
  const selectedCategoryName = useMemo(() => {
    if (!categoryId) return 'All categories'
    return categories.find(category => category.id === categoryId)?.name || 'Selected category'
  }, [categories, categoryId])

  const categoryChartData = useMemo(() => categoryReport.map(row => ({
    name: row.category,
    value: row.total_stock,
  })), [categoryReport])

  const priceChartData = useMemo(() => priceReport.map(row => ({
    name: row.price_range,
    stock: row.total_stock,
    value: row.total_value,
  })), [priceReport])

  const summaryCards = useMemo<MetricCard[]>(() => [
    {
      label: 'Total Inventory Value',
      value: formatCurrency(data?.summary.totalInventoryValue || 0),
      icon: Layers3,
      trend: 'up',
      helper: 'Calculated from quantity × unit price across every item in the current scope.',
    },
    {
      label: 'Total Items',
      value: data?.summary.totalItems || 0,
      icon: ListFilter,
      trend: 'up',
      helper: 'Item count after filters and date range are applied.',
    },
    {
      label: 'Low Stock Items',
      value: data?.summary.lowStockItems || 0,
      icon: BarChart3,
      trend: 'down',
      helper: 'Items at or below their reorder level in the selected scope.',
    },
  ], [data])

  const activityCards = useMemo(() => [
    { label: 'Restocks', value: data?.activitySummary.restockCount || 0, helper: 'Units added back to stock.' },
    { label: 'Sales', value: data?.activitySummary.saleCount || 0, helper: 'Units sold in the selected range.' },
    { label: 'Returns', value: data?.activitySummary.returnCount || 0, helper: 'Units returned to inventory.' },
    { label: 'Cancels', value: data?.activitySummary.cancelCount || 0, helper: 'Units restored after cancelled orders.' },
    { label: 'Adjustments', value: data?.activitySummary.adjustmentCount || 0, helper: 'Manual corrections to stock levels.' },
  ], [data])

  const hasData = categoryReport.length > 0 || priceReport.length > 0

  const exportCurrentReport = async () => {
    if (!data) return

    setExporting(true)
    try {
      const rows = activeTab === 'category'
        ? categoryReport.map(row => ({
          Category: row.category,
          'Total Items': row.total_items,
          'Total Stock': row.total_stock,
          'Total Value': row.total_value,
        }))
        : priceReport.map(row => ({
          'Price Range': row.price_range,
          'Items Count': row.item_count,
          'Total Stock': row.total_stock,
          'Total Value': row.total_value,
        }))

      const csv = convertToCsv(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = activeTab === 'category' ? 'inventory-category-report.csv' : 'inventory-price-report.csv'
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('CSV download started')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export CSV')
    } finally {
      setExporting(false)
    }
  }

  return (
    <InventoryPageShell
      badge={<><Sparkles className="h-4 w-4 text-cyan-500" /> Inventory insights</>}
      title="Reports"
      description="Analyze inventory data, compare category distribution, and inspect price bands with exportable summaries."
      actions={
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
          <div className="space-y-1">
            <Label htmlFor="category-filter" className="text-xs text-muted-foreground">Category</Label>
            <Select value={categoryId || 'all'} onValueChange={value => setCategoryId(value === 'all' ? '' : value)}>
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
            <Label htmlFor="from-date" className="text-xs text-muted-foreground">From</Label>
            <Input id="from-date" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="min-w-40 border-border/70 bg-background/80" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="to-date" className="text-xs text-muted-foreground">To</Label>
            <Input id="to-date" type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="min-w-40 border-border/70 bg-background/80" />
          </div>

          <Button variant="outline" className="justify-self-start border-border/70 bg-background/70 backdrop-blur sm:self-end" onClick={() => {
            setCategoryId('')
            setFromDate('')
            setToDate('')
          }} disabled={loading}>
            Reset
          </Button>

          <Button className="justify-self-start bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20 sm:self-end" onClick={() => void exportCurrentReport()} disabled={loading || exporting || !hasData}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-3">
        {summaryCards.map(card => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            change={0}
            trend={card.trend}
          />
        ))}
      </section>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardContent className="pt-6">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              <span>Generated {data ? new Date(data.summary.generatedAt).toLocaleString() : 'just now'}</span>
              {categoryId ? <Badge variant="outline" className="border-border/70 bg-background/70 text-foreground">Category filtered</Badge> : null}
              {(fromDate || toDate) ? <Badge variant="outline" className="border-border/70 bg-background/70 text-foreground">Date scoped</Badge> : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Active category</p>
                <p className="mt-1 font-semibold text-foreground">{selectedCategoryName}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible rows</p>
                <p className="mt-1 font-semibold text-foreground">{categoryReport.length} category rows · {priceReport.length} price rows</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as ReportTab)} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2 border border-border/70 bg-background/80 p-1">
          <TabsTrigger value="category">
            <PieChartIcon className="h-4 w-4" />
            Category
          </TabsTrigger>
          <TabsTrigger value="price">
            <BarChart3 className="h-4 w-4" />
            Price
          </TabsTrigger>
        </TabsList>

        <TabsContent value="category" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Loading category report...</div>
                ) : categoryChartData.length === 0 ? (
                  <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <p>No category data available.</p>
                    <p>Try clearing filters or adding inventory records.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie data={categoryChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={4}>
                        {categoryChartData.map((_, index) => (
                          <Cell key={index} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Category Highlights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryReport.slice(0, 6).map((row, index) => (
                  <div key={row.category} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{row.category}</p>
                        <p className="text-sm text-muted-foreground">{row.total_items} items · {row.total_stock} units</p>
                      </div>
                      <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">#{index + 1}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">Inventory value</p>
                    <p className="text-xl font-semibold tracking-tight">{formatCurrency(row.total_value)}</p>
                  </div>
                ))}
                {categoryReport.length === 0 && !loading ? <p className="text-sm text-muted-foreground">No data available for the selected filters.</p> : null}
              </CardContent>
            </Card>
          </div>

          <DataTable
            title="Category Report"
            columns={[
              { key: 'category', label: 'Category' },
              { key: 'total_items', label: 'Total Items' },
              { key: 'total_stock', label: 'Total Stock' },
              { key: 'total_value', label: 'Total Value', render: value => formatCurrency(Number(value)) },
            ]}
            data={categoryReport}
            loading={loading}
            emptyMessage="No category report data available"
            pageSize={10}
          />
        </TabsContent>

        <TabsContent value="price" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Price Bands</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Loading price report...</div>
                ) : priceChartData.length === 0 ? (
                  <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <p>No price-band data available.</p>
                    <p>Try clearing filters or adding inventory records.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={priceChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="stock" name="Total Stock" fill="#0f172a" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="value" name="Total Value" fill="#0f766e" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Price Band Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {priceBandNotes.map(note => (
                  <div key={note.price_range} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <p className="font-semibold text-foreground">{note.title}</p>
                    <p className="mt-1">{note.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <DataTable
            title="Price Report"
            columns={[
              { key: 'price_range', label: 'Price Range' },
              { key: 'item_count', label: 'Items Count' },
              { key: 'total_stock', label: 'Total Stock' },
              { key: 'total_value', label: 'Total Value', render: value => formatCurrency(Number(value)) },
            ]}
            data={priceReport}
            loading={loading}
            emptyMessage="No price report data available"
            pageSize={10}
          />
        </TabsContent>
      </Tabs>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Movement Activity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {activityCards.map(card => (
            <div key={card.label} className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {!loading && !hasData ? (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-semibold text-foreground">No report data available</p>
            <p className="max-w-md text-sm text-muted-foreground">Try clearing filters or adding inventory records. Category and price reports will appear here once there is data to summarize.</p>
          </CardContent>
        </Card>
      ) : null}
    </InventoryPageShell>
  )
}
