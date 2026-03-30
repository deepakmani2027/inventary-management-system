'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, TrendingDown, AlertCircle } from 'lucide-react'

export default function AlertsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const supabase = getSupabaseClient()
        const { data } = await supabase
          .from('items')
          .select('*')
          .order('stock', { ascending: true })

        setItems(data || [])
        setLoading(false)
      } catch (error) {
        console.error('Error fetching items:', error)
        setLoading(false)
      }
    }

    fetchItems()
  }, [])

  const criticalItems = items.filter(item => item.stock === 0)
  const warningItems = items.filter(item => item.stock > 0 && item.stock <= 5)
  const cautionItems = items.filter(item => item.stock > 5 && item.stock <= 10)

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Low Stock Alerts</h1>
        <p className="text-slate-400 mt-2">Monitor products with low inventory levels</p>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-red-900/20 border-red-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-400 text-sm font-medium">Critical (Out of Stock)</p>
                <p className="text-3xl font-bold text-red-400 mt-2">{criticalItems.length}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-900/20 border-yellow-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-400 text-sm font-medium">Warning (≤5 units)</p>
                <p className="text-3xl font-bold text-yellow-400 mt-2">{warningItems.length}</p>
              </div>
              <AlertCircle className="w-12 h-12 text-yellow-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-900/20 border-blue-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-sm font-medium">Caution (≤10 units)</p>
                <p className="text-3xl font-bold text-blue-400 mt-2">{cautionItems.length}</p>
              </div>
              <TrendingDown className="w-12 h-12 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Items */}
      {criticalItems.length > 0 && (
        <Card className="bg-slate-800/50 border-red-700">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Out of Stock Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {criticalItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-red-900/20 rounded-lg border border-red-700">
                  <div>
                    <p className="text-white font-semibold">{item.name}</p>
                    <p className="text-sm text-slate-400">SKU: {item.sku}</p>
                  </div>
                  <Button className="bg-red-600 hover:bg-red-700 text-white">
                    Restock Now
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning Items */}
      {warningItems.length > 0 && (
        <Card className="bg-slate-800/50 border-yellow-700">
          <CardHeader>
            <CardTitle className="text-yellow-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Low Stock Warning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {warningItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-yellow-900/20 rounded-lg border border-yellow-700">
                  <div className="flex-1">
                    <p className="text-white font-semibold">{item.name}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-sm text-slate-400">SKU: {item.sku}</p>
                      <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                        {item.stock} units
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/10">
                    Create Restock Order
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Caution Items */}
      {cautionItems.length > 0 && (
        <Card className="bg-slate-800/50 border-blue-700">
          <CardHeader>
            <CardTitle className="text-blue-400 flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Stock Caution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cautionItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg border border-blue-700">
                  <div className="flex-1">
                    <p className="text-white font-semibold">{item.name}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-sm text-slate-400">SKU: {item.sku}</p>
                      <Badge variant="outline" className="border-blue-600 text-blue-400">
                        {item.stock} units
                      </Badge>
                    </div>
                  </div>
                  <Button variant="outline" className="border-blue-600 text-blue-400 hover:bg-blue-600/10">
                    Monitor
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {criticalItems.length === 0 && warningItems.length === 0 && cautionItems.length === 0 && !loading && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400 text-lg">All items have healthy stock levels</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
