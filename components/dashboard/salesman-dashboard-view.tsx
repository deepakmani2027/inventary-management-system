'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, ClipboardList, IndianRupee, Package, ReceiptText, ShoppingCart, Sparkles, TrendingUp } from 'lucide-react'

type SaleRow = {
  id: string
  bill_number: string
  customer_name: string | null
  total_amount: number
  status: string
  created_at: string
}

interface SalesmanDashboardViewProps {
  basePath: string
}

export function SalesmanDashboardView({ basePath }: SalesmanDashboardViewProps) {
  const [sales, setSales] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('sales')
        .select('id, bill_number, customer_name, total_amount, status, created_at')
        .eq('salesman_id', user.id)
        .order('created_at', { ascending: false })

      setSales((data as SaleRow[]) || [])
      setLoading(false)
    }

    load()
  }, [])

  const metrics = useMemo(() => {
    const completed = sales.filter(sale => sale.status === 'completed')
    const today = new Date().toDateString()

    return {
      todaySales: completed.filter(sale => new Date(sale.created_at).toDateString() === today).length,
      totalBills: sales.length,
      revenue: completed.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0),
    }
  }, [sales])

  const quickActions = [
    { href: `${basePath}/create-bill`, label: 'Create Bill', description: 'Search items, build the cart, and checkout.', icon: ShoppingCart },
    { href: `${basePath}/inventory`, label: 'Inventory View', description: 'Verify stock before billing.', icon: Package },
    { href: `${basePath}/sales-history`, label: 'Sales History', description: 'Review bill totals and status.', icon: TrendingUp },
  ]

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-background via-card/70 to-background p-6 shadow-2xl shadow-slate-950/10 sm:p-8 backdrop-blur">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.10),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              Salesman panel for billing, stock checks, and returns
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
                Sales Command Center
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Track today&apos;s sales, create bills, check stock, and manage returns from one place.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
              <Link href={`${basePath}/create-bill`}>
                Create Bill
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-border/70 bg-background/70 backdrop-blur">
              <Link href={`${basePath}/inventory`}>Check Inventory</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Today Sales" value={metrics.todaySales} icon={ClipboardList} change={0} trend="up" />
        <StatCard label="Total Bills" value={metrics.totalBills} icon={ReceiptText} change={0} trend="up" />
        <StatCard label="Revenue" value={`₹${metrics.revenue.toLocaleString()}`} icon={IndianRupee} change={0} trend="up" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card className="border-border/70 bg-background/75 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map(action => {
              const Icon = action.icon

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-start gap-4 rounded-2xl border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-lg"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 ring-1 ring-inset ring-cyan-500/20">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                      {action.label}
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-500" />
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{action.description}</span>
                  </span>
                </Link>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-linear-to-b from-cyan-500/8 to-background/70 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle>Latest Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              title="Recent Sales"
              pageSize={5}
              columns={[
                { key: 'bill_number', label: 'Bill' },
                { key: 'customer_name', label: 'Customer', render: value => value || 'Walk-in' },
                { key: 'total_amount', label: 'Total', render: value => `₹${Number(value).toLocaleString()}` },
                { key: 'status', label: 'Status', render: value => <span className="capitalize">{String(value)}</span> },
                { key: 'created_at', label: 'Date', render: value => new Date(String(value)).toLocaleDateString() },
              ]}
              data={sales.slice(0, 5)}
              loading={loading}
              emptyMessage="No sales yet"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}