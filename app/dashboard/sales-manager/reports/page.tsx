'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Sparkles, DollarSign, PackageSearch, TrendingDown, TrendingUp, CalendarRange, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Cell, Line, ComposedChart, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { getSupabaseClient } from '@/lib/supabase/client'
import { SalesManagerPageShell } from '@/components/dashboard/sales-manager-page-shell'
import { StatCard } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type SaleRow = {
  id: string
  bill_number: string | null
  customer_name: string | null
  sale_date: string
  updated_at: string | null
  total_amount: number
  status: string | null
}

type SaleItemRow = {
  sale_id: string
  quantity: number
}

type DailyRow = {
  id: string
  billNumber: string
  customerName: string
  itemsSold: number
  totalAmount: number
  status: string
  time: string
  timeValue: number
  kind: 'sale' | 'return'
}

type HourBucket = {
  hour: number
  label: string
  salesCount: number
  revenue: number
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

function getLocalDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return toInputDate(date)
}

function getHourLabel(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const normalized = hour % 12 === 0 ? 12 : hour % 12
  return `${normalized} ${suffix}`
}

function getTimeLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export default function SalesManagerReportsPage() {
  const [sales, setSales] = useState<SaleRow[]>([])
  const [saleItems, setSaleItems] = useState<SaleItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(toInputDate(new Date()))

  useEffect(() => {
    let cancelled = false
    const supabase = getSupabaseClient()

    const load = async () => {
      setLoading(true)
      try {
        const [salesResponse, saleItemsResponse] = await Promise.all([
          supabase
            .from('sales')
            .select('id, bill_number, customer_name, sale_date, updated_at, total_amount, status')
            .order('sale_date', { ascending: false }),
          supabase
            .from('sale_items')
            .select('sale_id, quantity'),
        ])

        if (salesResponse.error) throw salesResponse.error
        if (saleItemsResponse.error) throw saleItemsResponse.error

        if (!cancelled) {
          setSales((salesResponse.data as SaleRow[]) || [])
          setSaleItems((saleItemsResponse.data as SaleItemRow[]) || [])
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load daily reports')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    const channel = supabase
      .channel('sales-manager-daily-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        void load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, () => {
        void load()
      })
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [])

  const saleItemsBySaleId = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of saleItems) {
      map.set(item.sale_id, (map.get(item.sale_id) || 0) + Number(item.quantity || 0))
    }
    return map
  }, [saleItems])

  const completedSales = useMemo(() => {
    return sales.filter(sale => {
      const status = (sale.status || 'completed').toLowerCase()
      return status === 'completed' && getLocalDateKey(sale.sale_date) === selectedDate
    })
  }, [sales, selectedDate])

  const returnedSales = useMemo(() => {
    return sales.filter(sale => {
      const status = (sale.status || '').toLowerCase()
      const returnDate = getLocalDateKey(sale.updated_at || sale.sale_date)
      return ['returned', 'cancelled'].includes(status) && returnDate === selectedDate
    })
  }, [sales, selectedDate])

  const totalSales = completedSales.length
  const totalRevenue = completedSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0)
  const totalReturns = returnedSales.length
  const returnAmount = returnedSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0)
  const netRevenue = totalRevenue - returnAmount

  const dailyRows = useMemo<DailyRow[]>(() => {
    const rows: DailyRow[] = []

    for (const sale of completedSales) {
      const saleTime = new Date(sale.sale_date)
      rows.push({
        id: `${sale.id}-sale`,
        billNumber: sale.bill_number || sale.id.slice(0, 8),
        customerName: sale.customer_name || 'Walk-in',
        itemsSold: saleItemsBySaleId.get(sale.id) || 0,
        totalAmount: Number(sale.total_amount || 0),
        status: 'Completed',
        time: getTimeLabel(sale.sale_date),
        timeValue: saleTime.getTime(),
        kind: 'sale',
      })
    }

    for (const sale of returnedSales) {
      const returnTime = new Date(sale.updated_at || sale.sale_date)
      rows.push({
        id: `${sale.id}-return`,
        billNumber: sale.bill_number || sale.id.slice(0, 8),
        customerName: sale.customer_name || 'Walk-in',
        itemsSold: saleItemsBySaleId.get(sale.id) || 0,
        totalAmount: Number(sale.total_amount || 0),
        status: (sale.status || 'Returned').replace(/\b\w/g, char => char.toUpperCase()),
        time: getTimeLabel(sale.updated_at || sale.sale_date),
        timeValue: returnTime.getTime(),
        kind: 'return',
      })
    }

    return rows.sort((a, b) => b.timeValue - a.timeValue)
  }, [completedSales, returnedSales, saleItemsBySaleId])

  const hourlyData = useMemo<HourBucket[]>(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: getHourLabel(hour),
      salesCount: 0,
      revenue: 0,
    }))

    for (const sale of completedSales) {
      const hour = new Date(sale.sale_date).getHours()
      const bucket = buckets[hour]
      bucket.salesCount += 1
      bucket.revenue += Number(sale.total_amount || 0)
    }

    return buckets
  }, [completedSales])

  const revenueVsReturns = useMemo(() => ([
    { label: 'Revenue', amount: totalRevenue, color: '#16a34a' },
    { label: 'Returns', amount: returnAmount, color: '#ef4444' },
  ]), [returnAmount, totalRevenue])

  const allCompletedDays = useMemo(() => {
    const map = new Map<string, number>()
    for (const sale of sales) {
      const status = (sale.status || 'completed').toLowerCase()
      if (status !== 'completed') continue
      const key = getLocalDateKey(sale.sale_date)
      map.set(key, (map.get(key) || 0) + 1)
    }
    return Array.from(map.values())
  }, [sales])

  const averageDailySales = allCompletedDays.length > 0
    ? allCompletedDays.reduce((sum, value) => sum + value, 0) / allCompletedDays.length
    : 0

  const highReturnRate = totalSales > 0 && totalReturns >= 3
  const highSales = totalSales > 0 && totalSales > averageDailySales

  const selectedDateLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${selectedDate}T00:00:00`))

  const exportCsv = () => {
    const headers = ['Date', 'Sales', 'Revenue', 'Returns', 'Net Revenue']
    const row = [selectedDate, totalSales, totalRevenue, totalReturns, netRevenue]
    const csv = [headers.map(escapeCsvCell).join(','), row.map(escapeCsvCell).join(',')].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `daily-report-${selectedDate}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <SalesManagerPageShell
      badge={<><Sparkles className="h-4 w-4 text-cyan-500" /> Daily business snapshot</>}
      title="Daily Reports"
      description="Track daily business performance, monitor revenue, and analyze returns in one simple report."
      actions={
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="report-date" className="text-xs text-muted-foreground">Date</Label>
            <Input
              id="report-date"
              type="date"
              value={selectedDate}
              onChange={event => setSelectedDate(event.target.value)}
              className="min-w-44 border-border/70 bg-background/80"
            />
          </div>
          <Button
            variant="outline"
            onClick={exportCsv}
            className="border-border/70 bg-background/70 backdrop-blur"
            disabled={loading}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Sales" value={totalSales} icon={PackageSearch} trend="up" subtext="Completed orders for the selected day." />
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} trend="up" subtext="Completed sales revenue." />
        <StatCard label="Total Returns" value={totalReturns} icon={TrendingDown} trend="down" subtext="Returned or cancelled orders for the day." />
        <StatCard label="Net Revenue" value={formatCurrency(netRevenue)} icon={TrendingUp} trend="up" subtext="Revenue minus return amount." />
      </section>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CalendarRange className="h-4 w-4" />
            <span>{selectedDateLabel}</span>
            <Badge variant="outline" className="border-border/70 bg-background/70 text-foreground">Today defaults to {toInputDate(new Date())}</Badge>
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">Revenue green</Badge>
            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700">Returns red</Badge>
          </div>
        </CardContent>
      </Card>

      {!loading && totalSales === 0 && totalReturns === 0 ? (
        <Card className="border-dashed border-border/70 bg-background/60">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-semibold text-foreground">No sales activity for this date</p>
            <p className="max-w-md text-sm text-muted-foreground">Try another date or wait for new sales and returns to come in.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Hourly Sales Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={hourlyData} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#cbd5e1" strokeOpacity={0.75} vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: '1px solid rgba(148,163,184,0.25)',
                    background: 'rgba(255,255,255,0.98)',
                    boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
                  }}
                  formatter={(value: number, name) => [name === 'revenue' ? formatCurrency(value) : value, name === 'revenue' ? 'Revenue' : 'Sales Count']}
                />
                <Legend wrapperStyle={{ paddingTop: 18 }} />
                <Bar dataKey="salesCount" name="Sales Count" fill="#0f766e" radius={[10, 10, 0, 0]} barSize={18} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0f172a" strokeWidth={3} dot={{ r: 4, fill: '#0f172a', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#0f172a', stroke: '#ffffff', strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>Revenue vs Returns</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={revenueVsReturns} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#cbd5e1" strokeOpacity={0.75} vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickMargin={10} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: '1px solid rgba(148,163,184,0.25)',
                    background: 'rgba(255,255,255,0.98)',
                    boxShadow: '0 16px 32px rgba(15, 23, 42, 0.12)',
                  }}
                  formatter={(value: number, name) => [formatCurrency(value), name]}
                />
                <Legend wrapperStyle={{ paddingTop: 18 }} />
                <Bar dataKey="amount" name="Amount" radius={[10, 10, 0, 0]} barSize={42}>
                  {revenueVsReturns.map(entry => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Summary Insights</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-sm text-muted-foreground">Sales performance</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{highSales ? 'Sales are above average today' : 'Sales are within normal range'}</p>
            <p className="mt-1 text-sm text-muted-foreground">Average daily sales: {averageDailySales.toFixed(1)}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
            <p className="text-sm text-muted-foreground">Return rate</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{highReturnRate ? 'High return rate today' : 'Return rate is under control'}</p>
            <p className="mt-1 text-sm text-muted-foreground">Returns amount: {formatCurrency(returnAmount)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-muted-foreground">Net revenue</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(netRevenue)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Revenue minus returns for {selectedDateLabel}</p>
          </div>
        </CardContent>
      </Card>

      <DataTable
        title="Detailed Breakdown"
        columns={[
          { key: 'billNumber', label: 'Bill Number' },
          { key: 'customerName', label: 'Customer Name' },
          { key: 'itemsSold', label: 'Items Sold', render: value => `${Number(value)} item(s)` },
          { key: 'totalAmount', label: 'Total Amount', render: value => formatCurrency(Number(value)) },
          { key: 'status', label: 'Status' },
          { key: 'time', label: 'Time' },
        ]}
        data={dailyRows}
        loading={loading}
        emptyMessage="No sales or return records for the selected date"
        pageSize={10}
      />
    </SalesManagerPageShell>
  )
}
