'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { Card, CardContent } from '@/components/ui/card'
import { BadgeIndianRupee, CalendarRange, ReceiptText, RotateCcw, BarChart3, UserCog, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SalesManagerPageShell } from '@/components/dashboard/sales-manager-page-shell'

type SaleRow = { id: string; bill_number: string; total_amount: number; status: string; created_at: string }

export default function SalesManagerDashboardPage() {
  const [sales, setSales] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient()
      const { data } = await supabase.from('sales').select('id, bill_number, total_amount, status, created_at').order('created_at', { ascending: false })
      setSales((data as SaleRow[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const summary = useMemo(() => ({
    revenue: sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0),
    bills: sales.length,
    cancelled: sales.filter(sale => sale.status === 'cancelled').length,
    returned: sales.filter(sale => sale.status === 'returned').length,
  }), [sales])

  return (
    <SalesManagerPageShell
      badge={<><BadgeIndianRupee className="h-4 w-4 text-cyan-500" /> Sales manager panel</>}
      title="Revenue control, team visibility, and fast exception handling."
      description="Monitor revenue, bill throughput, cancellation and return activity, then drill into analytics, reports, exceptions, and trends from one dashboard."
      actions={
        <>
          <Button asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
            <Link href="/sales-manager/dashboard/analytics">Open analytics</Link>
          </Button>
          <Button asChild variant="outline" className="border-border/70 bg-background/70 backdrop-blur">
            <Link href="/sales-manager/dashboard/reports">View reports</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Daily revenue', value: `₹${summary.revenue.toLocaleString()}`, icon: BadgeIndianRupee },
          { label: 'Bills processed', value: String(summary.bills), icon: ReceiptText },
          { label: 'Cancelled', value: String(summary.cancelled), icon: RotateCcw },
          { label: 'Returned', value: String(summary.returned), icon: CalendarRange },
        ].map(item => (
          <div key={item.label} className="rounded-2xl border border-border/70 bg-background/75 p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
              </div>
              <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-600">
                <item.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Revenue" value={`₹${summary.revenue.toLocaleString()}`} icon={BadgeIndianRupee} change={0} trend="up" />
        <StatCard label="Bills" value={summary.bills} icon={ReceiptText} change={0} trend="up" />
        <StatCard label="Cancelled" value={summary.cancelled} icon={RotateCcw} change={0} trend="down" />
        <StatCard label="Returned" value={summary.returned} icon={CalendarRange} change={0} trend="down" />
      </div>

      <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
        <CardContent className="pt-6 grid gap-4 md:grid-cols-4">
          <Link href="/sales-manager/dashboard/analytics" className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-lg">
            <BarChart3 className="mb-3 h-5 w-5 text-cyan-600" />
            <div className="font-semibold">Analytics</div>
            <div className="text-sm text-muted-foreground">Revenue per item and top sellers</div>
          </Link>
          <Link href="/sales-manager/dashboard/reports" className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-lg">
            <TrendingUp className="mb-3 h-5 w-5 text-cyan-600" />
            <div className="font-semibold">Reports</div>
            <div className="text-sm text-muted-foreground">Daily sales, revenue, and returns</div>
          </Link>
          <Link href="/sales-manager/dashboard/exceptions" className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-lg">
            <UserCog className="mb-3 h-5 w-5 text-cyan-600" />
            <div className="font-semibold">Exceptions</div>
            <div className="text-sm text-muted-foreground">Notifications and resolution tracking</div>
          </Link>
          <Link href="/sales-manager/dashboard/trends" className="rounded-2xl border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-lg">
            <BarChart3 className="mb-3 h-5 w-5 text-cyan-600" />
            <div className="font-semibold">Trends</div>
            <div className="text-sm text-muted-foreground">Daily, weekly, and monthly charts</div>
          </Link>
        </CardContent>
      </Card>

      <DataTable
        title="Recent Bills"
        columns={[
          { key: 'bill_number', label: 'Bill' },
          { key: 'total_amount', label: 'Amount', render: value => `₹${Number(value).toLocaleString()}` },
          { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'Date', render: value => new Date(String(value)).toLocaleDateString() },
        ]}
        data={sales.slice(0, 5)}
        loading={loading}
      />
    </SalesManagerPageShell>
  )
}
