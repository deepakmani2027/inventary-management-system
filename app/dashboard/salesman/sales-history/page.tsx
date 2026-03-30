'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/dashboard/data-table'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SalesmanPageShell } from '@/components/dashboard/salesman-page-shell'

type SaleRow = { id: string; bill_number: string; customer_name: string | null; total_amount: number; status: string; created_at: string }

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<SaleRow[]>([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('sales').select('id, bill_number, customer_name, total_amount, status, created_at').eq('salesman_id', user.id).order('created_at', { ascending: false })
      setSales((data as SaleRow[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const filteredSales = useMemo(() => sales.filter(sale => {
    const created = new Date(sale.created_at)
    const matchesFrom = !fromDate || created >= new Date(fromDate)
    const matchesTo = !toDate || created <= new Date(toDate)
    return matchesFrom && matchesTo
  }), [sales, fromDate, toDate])

  return (
    <SalesmanPageShell
      badge={<><ClipboardList className="h-4 w-4 text-cyan-500" /> Sales records</>}
      title="Sales History"
      description="Filter past bills by date."
    >
      <Card className="border-border/70 bg-background/75 backdrop-blur">
        <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </CardContent>
      </Card>

      <DataTable
        title="Bills"
        columns={[
          { key: 'bill_number', label: 'Bill' },
          { key: 'customer_name', label: 'Customer', render: value => value || 'Walk-in' },
          { key: 'total_amount', label: 'Amount', render: value => `₹${Number(value).toLocaleString()}` },
          { key: 'status', label: 'Status' },
          { key: 'created_at', label: 'Created', render: value => new Date(String(value)).toLocaleString() },
        ]}
        data={filteredSales}
        loading={loading}
      />
    </SalesmanPageShell>
  )
}
