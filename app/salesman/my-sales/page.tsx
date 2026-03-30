'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/dashboard/data-table'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, TrendingUp, DollarSign } from 'lucide-react'

export default function MySalesPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return

        const { data } = await supabase
          .from('sales')
          .select('*')
          .eq('salesman_id', user.id)
          .order('created_at', { ascending: false })

        setSales(data || [])
        setStats({
          totalSales: data?.length || 0,
          totalRevenue: data?.reduce((sum, sale) => sum + (sale.total || 0), 0) || 0,
        })
        setLoading(false)
      } catch (error) {
        console.error('Error fetching sales:', error)
        setLoading(false)
      }
    }

    fetchSales()
  }, [])

  const filteredSales = sales.filter(sale =>
    sale.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">My Sales</h1>
        <p className="text-slate-400 mt-2">View and manage all your sales transactions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard label="Total Sales" value={stats.totalSales} icon={TrendingUp} />
        <StatCard label="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} />
      </div>

      {/* Search */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search by bill number or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <DataTable
        title="Sales Transactions"
        columns={[
          { key: 'bill_number', label: 'Bill #' },
          { key: 'customer_name', label: 'Customer' },
          { key: 'total', label: 'Amount', render: (val) => `₹${val.toLocaleString()}` },
          { key: 'status', label: 'Status', render: (val) => <span className={val === 'completed' ? 'text-green-400' : 'text-yellow-400'}>{val}</span> },
          {
            key: 'created_at',
            label: 'Date',
            render: (val) => new Date(val).toLocaleDateString(),
          },
        ]}
        data={filteredSales}
        loading={loading}
      />
    </div>
  )
}
