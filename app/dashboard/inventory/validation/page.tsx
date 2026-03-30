'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, AlertTriangle, RefreshCcw, ShieldAlert, Wrench, CheckCircle2, CircleAlert, Minus, ArrowRight, History } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { InventoryPageShell } from '@/components/dashboard/inventory-page-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/dashboard/stat-card'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type ValidationStatus = 'valid' | 'mismatch' | 'critical' | 'missing-history'

type ValidationItem = {
  id: string
  name: string
  category_name: string
  reorder_level: number
  actual_stock: number
  expected_stock: number
  difference: number
  sold: number
  sold_from_logs: number
  restocked: number
  returned: number
  cancelled: number
  adjustments: number
  log_count: number
  last_activity_at: string | null
  has_audit_trail: boolean
  issues: string[]
  status: ValidationStatus
}

type ValidationSummary = {
  totalItems: number
  validCount: number
  mismatchCount: number
  criticalCount: number
  missingHistoryCount: number
  validationIssuesCount: number
  totalSold: number
  totalRestocked: number
  totalReturned: number
  totalCancelled: number
  totalAdjustments: number
  generatedAt: string
}

type ValidationLog = {
  id: string
  item_id: string
  action: string
  action_label: string
  item_name: string
  performed_by_name: string
  quantity_changed: number
  old_quantity: number | null
  new_quantity: number | null
  performed_by: string
  notes: string | null
  created_at: string
}

type ValidationResponse = {
  summary: ValidationSummary
  items: ValidationItem[]
  recentLogs: ValidationLog[]
}

type FixState = {
  itemId: string
  itemName: string
  expectedStock: number
  actualStock: number
}

export default function ValidationPage() {
  const [data, setData] = useState<ValidationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showOnlyIssues, setShowOnlyIssues] = useState(true)
  const [fixState, setFixState] = useState<FixState | null>(null)
  const [targetQuantity, setTargetQuantity] = useState('')
  const [fixNotes, setFixNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const loadValidation = async (showSpinner = false) => {
    if (showSpinner) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const response = await fetch('/api/admin/inventory/validation', { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load validation data')
      }

      setData(payload as ValidationResponse)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load validation data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadValidation()
  }, [])

  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel('inventory-validation-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        void loadValidation(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_logs' }, () => {
        void loadValidation(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, () => {
        void loadValidation(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        void loadValidation(true)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const items = data?.items || []
  const visibleItems = useMemo(() => {
    return showOnlyIssues ? items.filter(item => item.status !== 'valid') : items
  }, [items, showOnlyIssues])

  const totals = data?.summary
  const issueCount = totals?.validationIssuesCount || 0
  const activeCount = totals?.totalItems || 0
  const criticalCount = totals?.criticalCount || 0
  const validCount = totals?.validCount || 0

  const openFixDialog = (item: ValidationItem) => {
    setFixState({
      itemId: item.id,
      itemName: item.name,
      expectedStock: item.expected_stock,
      actualStock: item.actual_stock,
    })
    setTargetQuantity(String(item.expected_stock))
    setFixNotes(`Validation correction for ${item.name}`)
  }

  const submitFix = async () => {
    if (!fixState) return

    const supabase = getSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('User not authenticated')
      return
    }

    const parsedQuantity = Number(targetQuantity)
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      toast.error('Target quantity must be a whole number of 0 or more')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/inventory/validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: fixState.itemId,
          targetQuantity: parsedQuantity,
          performedBy: user.id,
          notes: fixNotes || null,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to fix stock')
      }

      toast.success('Stock corrected and logged')
      setFixState(null)
      await loadValidation(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fix stock')
    } finally {
      setSaving(false)
    }
  }

  const statusMeta = {
    valid: { label: 'Valid', className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700', icon: CheckCircle2 },
    mismatch: { label: 'Mismatch', className: 'border-rose-500/20 bg-rose-500/10 text-rose-700', icon: CircleAlert },
    critical: { label: 'Critical', className: 'border-red-500/20 bg-red-500/10 text-red-700', icon: AlertTriangle },
    'missing-history': { label: 'Missing history', className: 'border-amber-500/20 bg-amber-500/10 text-amber-700', icon: Minus },
  } as const

  return (
    <InventoryPageShell
      badge={<><ClipboardCheck className="h-4 w-4 text-cyan-500" /> Validation center</>}
      title="Validation"
      description="Compare actual stock with sales and inventory movement history, highlight gaps, and fix mismatches without leaving the inventory workspace."
      actions={
        <>
          <Button variant="outline" className="border-border/70 bg-background/70 backdrop-blur" onClick={() => void loadValidation(true)} disabled={loading || refreshing}>
            <RefreshCcw className={cn('mr-2 h-4 w-4', refreshing ? 'animate-spin' : '')} />
            Refresh
          </Button>
          <Button asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
            <Link href="/inventory/dashboard/inventory">
              Back to inventory
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Validation Issues" value={issueCount} icon={ClipboardCheck} change={0} trend="down" />
        <StatCard label="Valid Items" value={validCount} icon={CheckCircle2} change={0} trend="up" />
        <StatCard label="Critical Alerts" value={criticalCount} icon={ShieldAlert} change={0} trend="down" />
        <StatCard label="Tracked Items" value={activeCount} icon={History} change={0} trend="up" />
      </section>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle>Validation Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn('rounded-2xl border p-4', issueCount === 0 ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-rose-500/20 bg-rose-500/10')}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current validation status</p>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {issueCount === 0 ? 'All items valid' : `${issueCount} mismatch${issueCount === 1 ? '' : 'es'} found`}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {issueCount === 0
                    ? 'Stock, sales, and log movements are aligned for the items currently in scope.'
                    : 'Focus on the highlighted rows first. Each fix is logged as an adjustment for auditability.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">Generated {totals ? new Date(totals.generatedAt).toLocaleString() : 'just now'}</Badge>
                <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">Sales tracked: {totals?.totalSold || 0}</Badge>
                <Badge variant="outline" className="border-border/70 bg-background/80 text-foreground">Restocks: {totals?.totalRestocked || 0}</Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm text-muted-foreground">Validation result</p>
              <p className="mt-1 text-lg font-semibold">{issueCount === 0 ? 'Ready' : 'Needs attention'}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm text-muted-foreground">Missing logs</p>
              <p className="mt-1 text-lg font-semibold">{totals?.missingHistoryCount || 0}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm text-muted-foreground">Returns and cancels</p>
              <p className="mt-1 text-lg font-semibold">{(totals?.totalReturned || 0) + (totals?.totalCancelled || 0)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="text-sm text-muted-foreground">Adjustment logs</p>
              <p className="mt-1 text-lg font-semibold">{totals?.totalAdjustments || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Validation Detail</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={showOnlyIssues ? 'default' : 'outline'}
              className={showOnlyIssues ? 'bg-linear-to-r from-slate-950 to-slate-700 text-white' : 'border-border/70 bg-background/70'}
              onClick={() => setShowOnlyIssues(true)}
            >
              Issues only
            </Button>
            <Button
              variant={!showOnlyIssues ? 'default' : 'outline'}
              className={!showOnlyIssues ? 'bg-linear-to-r from-slate-950 to-slate-700 text-white' : 'border-border/70 bg-background/70'}
              onClick={() => setShowOnlyIssues(false)}
            >
              Show all
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Item</th>
                  <th className="px-4 py-3 text-left font-medium">Expected Stock</th>
                  <th className="px-4 py-3 text-left font-medium">Actual Stock</th>
                  <th className="px-4 py-3 text-left font-medium">Difference</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>Loading validation data...</td>
                  </tr>
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No validation issues found.</td>
                  </tr>
                ) : (
                  visibleItems.map(item => {
                    const meta = statusMeta[item.status]
                    const StatusIcon = meta.icon
                    const rowClass = item.status === 'critical'
                      ? 'bg-red-500/10 hover:bg-red-500/15'
                      : item.status === 'mismatch'
                        ? 'bg-rose-500/10 hover:bg-rose-500/15'
                        : item.status === 'missing-history'
                          ? 'bg-amber-500/10 hover:bg-amber-500/15'
                          : 'hover:bg-accent/40'

                    return (
                      <tr key={item.id} className={cn('border-t border-border/60 transition-colors', rowClass)}>
                        <td className="px-4 py-4 align-top">
                          <div className="space-y-1">
                            <div className="font-semibold text-foreground">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.category_name} · Reorder level {item.reorder_level}</div>
                            <div className="text-xs text-muted-foreground">Logs: {item.log_count} · Audit {item.has_audit_trail ? 'available' : 'missing'}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top font-medium text-foreground">{item.expected_stock}</td>
                        <td className="px-4 py-4 align-top font-medium text-foreground">{item.actual_stock}</td>
                        <td className={cn('px-4 py-4 align-top font-semibold', item.difference === 0 ? 'text-emerald-600' : item.difference > 0 ? 'text-amber-600' : 'text-rose-600')}>
                          {item.difference > 0 ? '+' : ''}{item.difference}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-col gap-2">
                            <span className={cn('inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium', meta.className)}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {meta.label}
                            </span>
                            {item.issues.length > 0 ? (
                              <p className="max-w-md text-xs leading-5 text-muted-foreground">{item.issues.join(' · ')}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {item.status === 'valid' ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              No action needed
                            </span>
                          ) : (
                            <Button size="sm" className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={() => openFixDialog(item)}>
                              <Wrench className="mr-2 h-4 w-4" />
                              Fix Stock
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recentLogs || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No inventory logs yet.</p>
            ) : (
              (data?.recentLogs || []).map(log => (
                <div key={log.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-border/70 bg-background/70 text-foreground">{log.action_label}</Badge>
                    <span className="font-medium text-foreground">{log.quantity_changed > 0 ? '+' : ''}{log.quantity_changed}</span>
                    <span className="text-sm text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{log.item_name} · {log.performed_by_name}</p>
                  {log.notes ? <p className="mt-1 text-sm text-muted-foreground">Note: {log.notes}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle>Edge Cases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="font-medium text-foreground">Missing logs</p>
              <p className="mt-1">Items without audit history are flagged so the team can rebuild the trail before trusting the stock number.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="font-medium text-foreground">Duplicate sales</p>
              <p className="mt-1">Sales item totals are compared against the inventory movement trail to surface duplicated or incomplete sale processing.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="font-medium text-foreground">Negative stock</p>
              <p className="mt-1">A negative actual or expected quantity is treated as a critical problem and should be corrected immediately.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <p className="font-medium text-foreground">Manual DB changes</p>
              <p className="mt-1">Any quantity change without matching movement history is surfaced as a mismatch for review and correction.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(fixState)} onOpenChange={open => { if (!open) setFixState(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fix Stock</DialogTitle>
            <DialogDescription>
              Adjust {fixState?.itemName || 'this item'} so it matches the expected quantity and record an adjustment log for auditability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Expected</p>
                <p className="text-2xl font-semibold">{fixState?.expectedStock ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Actual</p>
                <p className="text-2xl font-semibold">{fixState?.actualStock ?? 0}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetQuantity">Target quantity</Label>
              <Input id="targetQuantity" type="number" min={0} value={targetQuantity} onChange={event => setTargetQuantity(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fixNotes">Adjustment note</Label>
              <Textarea id="fixNotes" value={fixNotes} onChange={event => setFixNotes(event.target.value)} placeholder="Optional note for the correction log" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border/70" onClick={() => setFixState(null)} disabled={saving}>
              Cancel
            </Button>
            <Button className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={() => void submitFix()} disabled={saving}>
              <Wrench className="mr-2 h-4 w-4" />
              {saving ? 'Applying fix...' : 'Apply Fix'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InventoryPageShell>
  )
}
