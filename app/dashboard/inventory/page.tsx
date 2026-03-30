'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertTriangle, BarChart3, Boxes, ClipboardCheck, Package, Sparkles, TrendingUp } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/dashboard/stat-card'
import { DataTable } from '@/components/dashboard/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InventoryPageShell } from '@/components/dashboard/inventory-page-shell'

type ItemRow = { id: string; name: string; category_id: string; unit_price: number; reorder_level: number }
type CategoryRow = { id: string; name: string }
type InventoryRow = { item_id: string; quantity: number }
type ValidationSummary = { validationIssuesCount: number }

export default function InventoryManagerDashboardPage() {
  const [items, setItems] = useState<ItemRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [validationIssues, setValidationIssues] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient()
      const [{ data: itemData }, { data: categoryData }, { data: inventoryData }, validationResponse] = await Promise.all([
        supabase.from('items').select('id, name, category_id, unit_price, reorder_level').order('name'),
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('inventory').select('item_id, quantity'),
        fetch('/api/admin/inventory/validation', { cache: 'no-store' })
          .then(async response => {
            if (!response.ok) return null
            return response.json()
          })
          .catch(() => null),
      ])
      setItems((itemData as ItemRow[]) || [])
      setCategories((categoryData as CategoryRow[]) || [])
      setInventory((inventoryData as InventoryRow[]) || [])
      setValidationIssues((validationResponse as { summary?: ValidationSummary } | null)?.summary?.validationIssuesCount || 0)
      setLoading(false)
    }
    load()
  }, [])

  const stockByItem = useMemo(() => new Map(inventory.map(row => [row.item_id, row.quantity])), [inventory])
  const totalStock = items.reduce((sum, item) => sum + (stockByItem.get(item.id) || 0), 0)
  const lowStock = items.filter(item => (stockByItem.get(item.id) || 0) <= item.reorder_level).length
  const inventoryValue = items.reduce((sum, item) => sum + item.unit_price * (stockByItem.get(item.id) || 0), 0)

  return (
    <InventoryPageShell
      badge={<><Sparkles className="h-4 w-4 text-cyan-500" /> Stock visibility</>}
      title="Inventory Command Center"
      description="Monitor total stock, restock low items, validate movements, and review inventory trends from one dashboard."
      actions={
        <>
          <Button asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
            <Link href="/inventory/dashboard/restock">
              Restock Items
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-border/70 bg-background/70 backdrop-blur">
            <Link href="/inventory/dashboard/low-stock">View Low Stock</Link>
          </Button>
        </>
      }
    >

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Stock" value={totalStock} icon={Boxes} change={0} trend="up" />
        <StatCard label="Low Stock Count" value={lowStock} icon={AlertTriangle} change={0} trend="down" />
        <StatCard label="Inventory Value" value={`₹${inventoryValue.toLocaleString()}`} icon={TrendingUp} change={0} trend="up" />
        <StatCard label="Validation Issues" value={validationIssues} icon={ClipboardCheck} change={0} trend={validationIssues > 0 ? 'down' : 'up'} />
      </div>

      <Card className="border-border/70 bg-background/75 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Link href="/inventory/dashboard/inventory" className="group rounded-2xl border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-lg">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 ring-1 ring-inset ring-cyan-500/20">
              <Package className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Inventory</p>
            <p className="mt-2 text-sm text-muted-foreground">Filter items by category and quantity.</p>
          </Link>
          <Link href="/inventory/dashboard/validation" className="group rounded-2xl border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-lg">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Validation</p>
            <p className="mt-2 text-sm text-muted-foreground">Compare sales and inventory data.</p>
          </Link>
          <Link href="/inventory/dashboard/reports" className="group rounded-2xl border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-lg">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950/10 text-slate-700 ring-1 ring-inset ring-slate-950/15">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Reports</p>
            <p className="mt-2 text-sm text-muted-foreground">Review category and price distribution.</p>
          </Link>
          <Link href="/inventory/dashboard/trends" className="group rounded-2xl border border-border/70 bg-background/80 p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-lg">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-inset ring-amber-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Trends</p>
            <p className="mt-2 text-sm text-muted-foreground">Watch inventory movement over time.</p>
          </Link>
        </CardContent>
      </Card>

      <DataTable
        title="Inventory Snapshot"
        columns={[
          { key: 'name', label: 'Item' },
          { key: 'category_id', label: 'Category', render: value => categories.find(category => category.id === value)?.name || 'Unassigned' },
          { key: 'unit_price', label: 'Unit Price', render: value => `₹${Number(value).toFixed(2)}` },
          {key: 'id', label: 'Quantity', render: (_value, row) => <span className={(stockByItem.get(row.id) || 0) <= row.reorder_level ? 'font-semibold text-red-500' : 'font-semibold text-emerald-600'}>{stockByItem.get(row.id) || 0}</span> },
        ]}
        data={items}
        loading={loading}
      />
    </InventoryPageShell>
  )
}
