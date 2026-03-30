'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/dashboard/data-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function TeamSalesPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSalesman, setSelectedSalesman] = useState('all')
  const [salesmen, setSalesmen] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = getSupabaseClient()

        // Fetch salesmen
        const { data: salesmenData } = await supabase
          .from('users')
          .select('id, name')
          .eq('role', 'salesman')

        setSalesmen(salesmenData || [])

        // Fetch all sales with salesman details
        const { data: salesData } = await supabase
          .from('sales')
          .select(`
            *,
            users:salesman_id(name, email)
          `)
          .order('created_at', { ascending: false })

        setSales(salesData || [])
        setLoading(false)
      } catch (error) {
        console.error('Error fetching data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredSales = sales.filter(sale => {
    const matchesSearch =
      sale.bill_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesSalesman = selectedSalesman === 'all' || sale.salesman_id === selectedSalesman

    return matchesSearch && matchesSalesman
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Team Sales</h1>
        <p className="text-slate-400 mt-2">View and analyze all team sales transactions</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by bill number or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            <Select value={selectedSalesman} onValueChange={setSelectedSalesman}>
              <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                <SelectValue placeholder="Filter by salesman" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-white cursor-pointer hover:bg-slate-700">
                  All Salesmen
                </SelectItem>
                {salesmen.map(salesman => (
                  <SelectItem key={salesman.id} value={salesman.id} className="text-white cursor-pointer hover:bg-slate-700">
                    {salesman.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <DataTable
        title="All Team Sales"
        columns={[
          { key: 'bill_number', label: 'Bill #' },
          { key: 'salesman_id', label: 'Salesman', render: (val) => salesmen.find(s => s.id === val)?.name || 'Unknown' },
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
