'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/dashboard/data-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Edit2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function StockManagementPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingItem, setEditingItem] = useState<any>(null)
  const [newStock, setNewStock] = useState('')

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data } = await supabase.from('items').select('*').order('name')
        setItems(data || [])
        setLoading(false)
      } catch (error) {
        console.error('Error fetching items:', error)
        setLoading(false)
      }
    }

    fetchItems()
  }, [])

  const handleUpdateStock = async () => {
    if (!editingItem || !newStock) return

    try {
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('items')
        .update({ stock: parseInt(newStock) })
        .eq('id', editingItem.id)

      if (!error) {
        setItems(items.map(item => 
          item.id === editingItem.id ? { ...item, stock: parseInt(newStock) } : item
        ))
        setEditingItem(null)
        setNewStock('')
      }
    } catch (error) {
      console.error('Error updating stock:', error)
    }
  }

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Stock Management</h1>
        <p className="text-slate-400 mt-2">Update and manage product stock levels</p>
      </div>

      {/* Search */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search products by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stock Table */}
      <DataTable
        title="Product Stock Levels"
        columns={[
          { key: 'name', label: 'Product Name' },
          { key: 'sku', label: 'SKU' },
          { key: 'price', label: 'Price', render: (val) => `₹${val}` },
          {
            key: 'stock',
            label: 'Stock',
            render: (val) => (
              <span className={val === 0 ? 'text-red-400 font-semibold' : val <= 5 ? 'text-yellow-400 font-semibold' : 'text-green-400'}>
                {val}
              </span>
            ),
          },
          {
            key: 'id',
            label: 'Action',
            render: (_, item) => (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-600 text-blue-400 hover:bg-blue-600/10"
                    onClick={() => {
                      setEditingItem(item)
                      setNewStock(item.stock.toString())
                    }}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Update
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Update Stock Level</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-300">Product: {editingItem?.name}</label>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-300">New Stock Quantity</label>
                      <Input
                        type="number"
                        min="0"
                        value={newStock}
                        onChange={(e) => setNewStock(e.target.value)}
                        className="mt-2 bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    <Button
                      onClick={handleUpdateStock}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      Update Stock
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ),
          },
        ]}
        data={filteredItems}
        loading={loading}
      />
    </div>
  )
}
