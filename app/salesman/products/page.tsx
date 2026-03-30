'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data } = await supabase.from('items').select('*').order('name')
        setProducts(data || [])
        setLoading(false)
      } catch (error) {
        console.error('Error fetching products:', error)
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-400">
        <div className="animate-spin inline-flex items-center justify-center w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
        <p>Loading products...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Available Products</h1>
        <p className="text-slate-400 mt-2">Browse products available for sale</p>
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

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <Card key={product.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{product.name}</h3>
                    <p className="text-sm text-slate-400">SKU: {product.sku}</p>
                  </div>

                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-400 text-sm">Price</p>
                      <p className="text-2xl font-bold text-white">₹{product.price}</p>
                    </div>
                    <Badge
                      variant={product.stock > 10 ? 'default' : product.stock > 0 ? 'secondary' : 'destructive'}
                      className={product.stock > 10 ? 'bg-green-600' : product.stock > 0 ? 'bg-yellow-600' : 'bg-red-600'}
                    >
                      {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t border-slate-700">
                    <p className="text-sm text-slate-400">
                      {product.description || 'No description available'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
