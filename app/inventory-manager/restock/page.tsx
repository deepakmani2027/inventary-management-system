'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Send } from 'lucide-react'
import { DataTable } from '@/components/dashboard/data-table'

export default function RestockPage() {
  const [products, setProducts] = useState<any[]>([])
  const [restockOrders, setRestockOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    productId: '',
    quantity: '',
    notes: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = getSupabaseClient()
        
        const { data: productsData } = await supabase.from('items').select('*')
        setProducts(productsData || [])

        const { data: ordersData } = await supabase
          .from('inventory_logs')
          .select('*')
          .order('created_at', { ascending: false })

        setRestockOrders(ordersData || [])
        setLoading(false)
      } catch (error) {
        console.error('Error fetching data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.productId || !formData.quantity) {
      toast.error('Please fill in all required fields')
      return
    }

    try {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('User not authenticated')
        return
      }

      const product = products.find(p => p.id === formData.productId)
      
      const { error } = await supabase
        .from('inventory_logs')
        .insert([
          {
            item_id: formData.productId,
            log_type: 'restock',
            quantity_in: parseInt(formData.quantity),
            notes: formData.notes,
            created_by: user.id,
          },
        ])

      if (error) {
        toast.error('Failed to create restock order')
        return
      }

      // Update product stock
      await supabase
        .from('items')
        .update({ stock: (product?.stock || 0) + parseInt(formData.quantity) })
        .eq('id', formData.productId)

      toast.success('Restock order created successfully!')
      setFormData({ productId: '', quantity: '', notes: '' })
      
      // Refresh data
      const { data: ordersData } = await supabase
        .from('inventory_logs')
        .select('*')
        .order('created_at', { ascending: false })

      setRestockOrders(ordersData || [])
    } catch (error) {
      console.error('Error creating restock order:', error)
      toast.error('An error occurred')
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Restock Orders</h1>
        <p className="text-slate-400 mt-2">Create and manage inventory restock orders</p>
      </div>

      {/* Create Restock Order */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Create New Restock Order</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300">Product *</label>
                <Select value={formData.productId} onValueChange={(value) => setFormData({ ...formData, productId: value })}>
                  <SelectTrigger className="mt-2 bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id} className="text-white cursor-pointer hover:bg-slate-700">
                        {product.name} (Current: {product.stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Quantity *</label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="Enter quantity"
                  className="mt-2 bg-slate-700/50 border-slate-600 text-white"
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Create Order
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300">Notes</label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add notes for this restock order..."
                className="mt-2 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Restock Orders Table */}
      <DataTable
        title="Recent Restock Orders"
        columns={[
          { key: 'item_id', label: 'Product', render: (val) => products.find(p => p.id === val)?.name || 'Unknown' },
          { key: 'quantity_in', label: 'Quantity Restocked' },
          { key: 'log_type', label: 'Type', render: (val) => <span className="capitalize">{val}</span> },
          {
            key: 'created_at',
            label: 'Date',
            render: (val) => new Date(val).toLocaleDateString(),
          },
        ]}
        data={restockOrders}
        loading={loading}
      />
    </div>
  )
}
