'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Trash2, Plus } from 'lucide-react'

interface BillItem {
  id: string
  item_id: string
  item_name: string
  quantity: number
  price: number
  total: number
}

export default function CreateBillPage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    selectedProduct: '',
    quantity: 1,
  })

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data } = await supabase.from('items').select('*')
        setProducts(data || [])
      } catch (error) {
        console.error('Error fetching products:', error)
      }
    }

    fetchProducts()
  }, [])

  const handleAddItem = () => {
    if (!formData.selectedProduct || formData.quantity <= 0) {
      toast.error('Please select a product and enter quantity')
      return
    }

    const product = products.find(p => p.id === formData.selectedProduct)
    if (!product) return

    if (product.stock < formData.quantity) {
      toast.error(`Not enough stock. Available: ${product.stock}`)
      return
    }

    const billItem: BillItem = {
      id: `${Date.now()}`,
      item_id: product.id,
      item_name: product.name,
      quantity: formData.quantity,
      price: product.price,
      total: product.price * formData.quantity,
    }

    setBillItems([...billItems, billItem])
    setFormData({ ...formData, selectedProduct: '', quantity: 1 })
    toast.success('Item added to bill')
  }

  const handleRemoveItem = (id: string) => {
    setBillItems(billItems.filter(item => item.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!formData.customerName || billItems.length === 0) {
        toast.error('Please enter customer name and add items')
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('User not authenticated')
        setLoading(false)
        return
      }

      const billNumber = `BILL-${Date.now()}`
      const totalAmount = billItems.reduce((sum, item) => sum + item.total, 0)

      // Create sale record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([
          {
            bill_number: billNumber,
            salesman_id: user.id,
            customer_name: formData.customerName,
            customer_phone: formData.customerPhone,
            total: totalAmount,
            status: 'completed',
          },
        ])
        .select()

      if (saleError) {
        toast.error('Failed to create bill')
        setLoading(false)
        return
      }

      const saleId = saleData?.[0]?.id

      // Create sale items
      const saleItems = billItems.map(item => ({
        sale_id: saleId,
        item_id: item.item_id,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      }))

      const { error: itemError } = await supabase
        .from('sale_items')
        .insert(saleItems)

      if (itemError) {
        toast.error('Failed to add items to bill')
        setLoading(false)
        return
      }

      // Update inventory
      for (const item of billItems) {
        const { error: inventoryError } = await supabase
          .from('inventory')
          .update({ quantity_out: (await supabase.from('inventory').select('quantity_out').eq('item_id', item.item_id).single()).data?.quantity_out + item.quantity })
          .eq('item_id', item.item_id)

        if (inventoryError) {
          console.error('Inventory update error:', inventoryError)
        }
      }

      toast.success(`Bill ${billNumber} created successfully!`)
      router.push('/salesman/my-sales')
    } catch (error) {
      console.error('Error creating bill:', error)
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const totalAmount = billItems.reduce((sum, item) => sum + item.total, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Create New Bill</h1>
        <p className="text-slate-400 mt-2">Add products and create a sales bill</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Information */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300">Customer Name *</label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="Enter customer name"
                  className="mt-2 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">Phone Number</label>
                <Input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="Enter phone number"
                  className="mt-2 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Items */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Add Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300">Product *</label>
                <Select value={formData.selectedProduct} onValueChange={(value) => setFormData({ ...formData, selectedProduct: value })}>
                  <SelectTrigger className="mt-2 bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id} className="text-white cursor-pointer hover:bg-slate-700">
                        {product.name} ({product.stock} in stock)
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
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="mt-2 bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bill Items Table */}
        {billItems.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Bill Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-300">Product</TableHead>
                      <TableHead className="text-slate-300">Quantity</TableHead>
                      <TableHead className="text-slate-300">Price</TableHead>
                      <TableHead className="text-slate-300">Total</TableHead>
                      <TableHead className="text-slate-300">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billItems.map(item => (
                      <TableRow key={item.id} className="border-slate-700 hover:bg-slate-700/30">
                        <TableCell className="text-slate-300">{item.item_name}</TableCell>
                        <TableCell className="text-slate-300">{item.quantity}</TableCell>
                        <TableCell className="text-slate-300">₹{item.price}</TableCell>
                        <TableCell className="text-slate-300">₹{item.total.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-red-600 text-red-400 hover:bg-red-600/10"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Bill Summary */}
              <div className="mt-6 pt-6 border-t border-slate-700 space-y-3">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal:</span>
                  <span>₹{totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Tax (0%):</span>
                  <span>₹0</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-white pt-3 border-t border-slate-700">
                  <span>Total:</span>
                  <span>₹{totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex gap-4">
          <Button
            type="submit"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2"
            disabled={loading || billItems.length === 0}
          >
            {loading ? 'Creating Bill...' : 'Create Bill'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-slate-600 text-slate-300"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
