'use client'

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/dashboard/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { SalesmanPageShell } from '@/components/dashboard/salesman-page-shell'

type SaleRow = {
  id: string
  bill_number: string
  customer_name: string | null
  total_amount: number
  status: string
  created_at: string
}

type SaleItemRow = {
  id: string
  item_id: string
  item_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

type ActiveMode = 'view' | 'return' | null

export default function ReturnsPage() {
  const [sales, setSales] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSale, setActiveSale] = useState<SaleRow | null>(null)
  const [activeSaleItems, setActiveSaleItems] = useState<SaleItemRow[]>([])
  const [activeMode, setActiveMode] = useState<ActiveMode>(null)
  const [saleToCancel, setSaleToCancel] = useState<SaleRow | null>(null)
  const [loadingSaleDetails, setLoadingSaleDetails] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [returning, setReturning] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({})

  const loadSales = async () => {
    setLoading(true)

    const supabase = getSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSales([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('sales')
      .select('id, bill_number, customer_name, total_amount, status, created_at')
      .eq('salesman_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message)
      setSales([])
    } else {
      setSales((data as SaleRow[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadSales()
  }, [])

  const fetchSaleItems = async (saleId: string) => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('sale_items')
      .select('id, item_id, quantity, unit_price, subtotal, items(name)')
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return ((data || []) as Array<{
      id: string
      item_id: string
      quantity: number
      unit_price: number
      subtotal: number
      items?: { name?: string } | { name?: string }[] | null
    }>).map(row => ({
      id: row.id,
      item_id: row.item_id,
      item_name: Array.isArray(row.items) ? row.items[0]?.name || 'Item' : row.items?.name || 'Item',
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
      subtotal: Number(row.subtotal),
    }))
  }

  const openSaleDetails = async (sale: SaleRow, mode: ActiveMode) => {
    setActiveSale(sale)
    setActiveMode(mode)
    setLoadingSaleDetails(true)
    setActiveSaleItems([])
    setReturnQuantities({})
    setReturnReason('')

    try {
      const items = await fetchSaleItems(sale.id)
      setActiveSaleItems(items)
      if (mode === 'return') {
        setReturnQuantities(Object.fromEntries(items.map(item => [item.item_id, '1'])))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load sale items')
      setActiveSale(null)
      setActiveMode(null)
    } finally {
      setLoadingSaleDetails(false)
    }
  }

  const cancelSale = async () => {
    if (!saleToCancel) return

    setCancelling(true)

    try {
      const supabase = getSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('User not authenticated')
        return
      }

      const { error } = await supabase.rpc('cancel_sale', {
        p_sale_id: saleToCancel.id,
        p_performed_by: user.id,
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Sale cancelled and stock restored')
      setSaleToCancel(null)
      if (activeSale?.id === saleToCancel.id) {
        setActiveSale(null)
        setActiveMode(null)
      }
      await loadSales()
    } finally {
      setCancelling(false)
    }
  }

  const submitReturn = async () => {
    if (!activeSale || activeMode !== 'return') return

    const selectedReturns = activeSaleItems
      .map(item => ({
        item,
        quantity: Number(returnQuantities[item.item_id] || 0),
      }))
      .filter(entry => entry.quantity > 0)

    if (selectedReturns.length === 0) {
      toast.error('Enter at least one return quantity')
      return
    }

    for (const entry of selectedReturns) {
      if (!Number.isInteger(entry.quantity) || entry.quantity <= 0 || entry.quantity > entry.item.quantity) {
        toast.error('Invalid quantity')
        return
      }
    }

    setReturning(true)

    try {
      const supabase = getSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error('User not authenticated')
        return
      }

      for (const entry of selectedReturns) {
        const { error } = await supabase.rpc('return_sale_item', {
          p_sale_id: activeSale.id,
          p_item_id: entry.item.item_id,
          p_quantity: entry.quantity,
          p_performed_by: user.id,
          p_reason: returnReason || null,
        })

        if (error) {
          throw error
        }
      }

      toast.success('Return processed')
      setActiveSale(null)
      setActiveMode(null)
      setActiveSaleItems([])
      setReturnQuantities({})
      setReturnReason('')
      await loadSales()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process return')
    } finally {
      setReturning(false)
    }
  }

  const closeDetails = () => {
    setActiveSale(null)
    setActiveMode(null)
    setActiveSaleItems([])
    setReturnQuantities({})
    setReturnReason('')
  }

  return (
    <SalesmanPageShell
      badge={<><RotateCcw className="h-4 w-4 text-cyan-500" /> Returns and exceptions</>}
      title="Returns &amp; Cancel"
      description="Cancel full sales or process partial and full returns."
    >
      <Card className="border-border/70 bg-background/75 backdrop-blur">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Select a completed sale to view details, cancel the full sale, or return individual items.
        </CardContent>
      </Card>

      <DataTable
        title="Sales"
        columns={[
          { key: 'bill_number', label: 'Bill' },
          { key: 'customer_name', label: 'Customer', render: value => value || 'Walk-in' },
          { key: 'total_amount', label: 'Amount', render: value => `₹${Number(value).toLocaleString()}` },
          { key: 'status', label: 'Status' },
          {
            key: 'id',
            label: 'Actions',
            render: (_value, row) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void openSaleDetails(row, 'view')}>
                  View
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={() => void openSaleDetails(row, 'return')}
                  disabled={row.status !== 'completed'}
                >
                  Return
                </Button>
                <Button
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600 disabled:text-white"
                  onClick={() => setSaleToCancel(row)}
                  disabled={row.status !== 'completed'}
                >
                  Cancel
                </Button>
              </div>
            ),
          },
        ]}
        data={sales}
        loading={loading}
      />

      <AlertDialog open={Boolean(saleToCancel)} onOpenChange={open => { if (!open) setSaleToCancel(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel bill {saleToCancel?.bill_number}? This will restore the stock for this sale.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep sale</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={event => {
                event.preventDefault()
                void cancelSale()
              }}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Yes, cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(activeSale) && Boolean(activeMode)} onOpenChange={open => { if (!open) closeDetails() }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{activeMode === 'return' ? 'Return items' : 'Sale details'}</DialogTitle>
            <DialogDescription>
              Bill {activeSale?.bill_number} {activeSale?.customer_name ? `for ${activeSale.customer_name}` : 'for walk-in customer'}
            </DialogDescription>
          </DialogHeader>

          {loadingSaleDetails ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading sale items...</div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    {activeMode === 'return' ? <TableHead className="text-right">Return qty</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSaleItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={activeMode === 'return' ? 5 : 4} className="py-8 text-center text-muted-foreground">
                        No sale items found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeSaleItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">₹{item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{item.subtotal.toFixed(2)}</TableCell>
                        {activeMode === 'return' ? (
                          <TableCell className="w-32 text-right">
                            <Input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={returnQuantities[item.item_id] || ''}
                              onChange={event => setReturnQuantities(previous => ({ ...previous, [item.item_id]: event.target.value }))}
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {activeMode === 'return' ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Use the remaining quantity for each item. Partial and full returns are processed through the database function.
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Reason for return (optional)</div>
                    <Textarea
                      value={returnReason}
                      onChange={event => setReturnReason(event.target.value)}
                      placeholder="Add a short note for the return"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDetails} disabled={returning}>
              Close
            </Button>
            {activeMode === 'return' ? (
              <Button className="bg-amber-600 text-white hover:bg-amber-700" onClick={() => void submitReturn()} disabled={returning || loadingSaleDetails}>
                {returning ? 'Processing...' : 'Submit Return'}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SalesmanPageShell>
  )
}
