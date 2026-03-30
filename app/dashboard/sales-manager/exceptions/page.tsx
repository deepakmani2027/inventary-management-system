'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BellRing, Filter, RefreshCw, Search, ShieldAlert, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { SalesManagerPageShell } from '@/components/dashboard/sales-manager-page-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type ExceptionStatus = 'open' | 'in_progress' | 'resolved'
type ExceptionFilter = ExceptionStatus | 'all'
type ExceptionTypeFilter = 'all' | 'exception' | 'return_issue' | 'payment_issue' | 'system_issue'

type ExceptionNotification = {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  is_read: boolean
  resolved: boolean
  resolved_at: string | null
  created_at: string
  recipient_name: string
  recipient_role: string
}

type ApiResponse = {
  notifications?: ExceptionNotification[]
  error?: string
}

const typeOptions: Array<{ value: ExceptionTypeFilter; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'exception', label: 'Exception' },
  { value: 'return_issue', label: 'Return issues' },
  { value: 'payment_issue', label: 'Payment issues' },
  { value: 'system_issue', label: 'System issues' },
]

const statusOptions: Array<{ value: ExceptionFilter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]

const typeLabelMap: Record<string, string> = {
  exception: 'Exception',
  return_issue: 'Return issue',
  payment_issue: 'Payment issue',
  system_issue: 'System issue',
}

function getStatus(notification: ExceptionNotification): ExceptionStatus {
  if (notification.resolved) return 'resolved'
  if (notification.is_read) return 'in_progress'
  return 'open'
}

function getPriority(notification: ExceptionNotification) {
  if (notification.type === 'payment_issue' || notification.type === 'system_issue') {
    return { label: 'High', className: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300' }
  }

  if (notification.type === 'return_issue') {
    return { label: 'Medium', className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' }
  }

  return { label: 'Low', className: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300' }
}

function getStatusStyles(status: ExceptionStatus) {
  if (status === 'resolved') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  }

  if (status === 'in_progress') {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
  }

  return 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300'
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.round(diffMs / 60000))

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default function ExceptionsPage() {
  const [notifications, setNotifications] = useState<ExceptionNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExceptionFilter>('open')
  const [typeFilter, setTypeFilter] = useState<ExceptionTypeFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadNotifications = useCallback(async (showSpinner = false) => {
    if (showSpinner) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const response = await fetch('/api/admin/sales-manager/exceptions', {
        cache: 'no-store',
      })
      const data = (await response.json()) as ApiResponse

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load exceptions')
      }

      setNotifications(data.notifications || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load exceptions'
      toast.error(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadNotifications(true)
    }, 30000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadNotifications(true)
      }
    }

    window.addEventListener('focus', handleVisibilityChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleVisibilityChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadNotifications])

  useEffect(() => {
    if (selectedId && !notifications.some(notification => notification.id === selectedId)) {
      setSelectedId(null)
    }
  }, [notifications, selectedId])

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase()

    const matching = notifications.filter(notification => {
      const status = getStatus(notification)

      if (statusFilter !== 'all' && status !== statusFilter) {
        return false
      }

      if (typeFilter !== 'all' && notification.type !== typeFilter) {
        return false
      }

      if (!query) {
        return true
      }

      return [notification.title, notification.message, notification.recipient_name, notification.type]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })

    return matching.sort((left, right) => {
      const leftStatus = getStatus(left)
      const rightStatus = getStatus(right)
      const statusRank: Record<ExceptionStatus, number> = { open: 0, in_progress: 1, resolved: 2 }
      const priorityRank = (notification: ExceptionNotification) =>
        notification.type === 'payment_issue' || notification.type === 'system_issue'
          ? 3
          : notification.type === 'return_issue'
            ? 2
            : 1

      const statusComparison = statusRank[leftStatus] - statusRank[rightStatus]
      if (statusComparison !== 0) {
        return statusComparison
      }

      const priorityComparison = priorityRank(right) - priorityRank(left)
      if (priorityComparison !== 0) {
        return priorityComparison
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    })
  }, [notifications, search, statusFilter, typeFilter])

  const summary = useMemo(() => {
    const open = notifications.filter(notification => getStatus(notification) === 'open').length
    const inProgress = notifications.filter(notification => getStatus(notification) === 'in_progress').length
    const resolved = notifications.filter(notification => getStatus(notification) === 'resolved').length
    const highPriority = notifications.filter(
      notification => notification.type === 'payment_issue' || notification.type === 'system_issue',
    ).length

    return { open, inProgress, resolved, highPriority, total: notifications.length }
  }, [notifications])

  const selectedNotification = useMemo(
    () => filteredNotifications.find(notification => notification.id === selectedId) || null,
    [filteredNotifications, selectedId],
  )

  const handleAction = useCallback(
    async (id: string, action: 'mark-in-progress' | 'resolve' | 'reopen') => {
      try {
        const response = await fetch('/api/admin/sales-manager/exceptions', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id, action }),
        })

        const data = (await response.json()) as { error?: string }

        if (!response.ok) {
          throw new Error(data.error || 'Unable to update exception')
        }

        toast.success(
          action === 'resolve'
            ? 'Exception resolved'
            : action === 'mark-in-progress'
              ? 'Exception moved to in progress'
              : 'Exception reopened',
        )

        setSelectedId(id)
        await loadNotifications(true)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update exception'
        toast.error(message)
      }
    },
    [loadNotifications],
  )

  const selectedStatus = selectedNotification ? getStatus(selectedNotification) : null
  const visibleCount = filteredNotifications.length
  const hasFilters = Boolean(search.trim()) || statusFilter !== 'open' || typeFilter !== 'all'

  return (
    <SalesManagerPageShell
      badge={
        <>
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          Exception control room
        </>
      }
      title="Exceptions"
      description="Track urgent sales issues, move them through the workflow, and resolve them from one screen."
      actions={
        <>
          <Button
            variant="outline"
            className="border-border/70 bg-background/80 backdrop-blur"
            onClick={() => void loadNotifications(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button asChild className="bg-slate-950 text-white hover:bg-slate-800">
            <Link href="/sales-manager/dashboard/reports">
              Daily reports <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Open', value: summary.open, icon: <BellRing className="h-5 w-5 text-blue-600" /> },
          { label: 'In progress', value: summary.inProgress, icon: <Filter className="h-5 w-5 text-amber-600" /> },
          { label: 'Resolved', value: summary.resolved, icon: <Sparkles className="h-5 w-5 text-emerald-600" /> },
          { label: 'High priority', value: summary.highPriority, icon: <ShieldAlert className="h-5 w-5 text-red-600" /> },
        ].map(card => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-lg shadow-slate-950/5 backdrop-blur"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background p-3">{card.icon}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-lg shadow-slate-950/5 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Live exceptions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {visibleCount} of {summary.total} notifications shown
                {hasFilters ? ' with filters applied' : ''}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full min-w-60 flex-1 lg:w-[320px] lg:flex-none">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search title, message, recipient"
                  className="h-10 pl-9"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {statusOptions.map(option => {
              const active = statusFilter === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-medium transition-all',
                    active
                      ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/20'
                      : 'border-border/70 bg-background/80 text-muted-foreground hover:border-slate-400 hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {typeOptions.map(option => {
              const active = typeFilter === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTypeFilter(option.value)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-wide transition-all',
                    active
                      ? 'border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                      : 'border-border/70 bg-background/80 text-muted-foreground hover:border-blue-300 hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-border/70">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border/70 text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Notification</th>
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Age</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70 bg-background/70">
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        Loading exceptions...
                      </td>
                    </tr>
                  ) : filteredNotifications.length === 0 ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                        No exceptions match the current search and filters.
                      </td>
                    </tr>
                  ) : (
                    filteredNotifications.map(notification => {
                      const status = getStatus(notification)
                      const priority = getPriority(notification)

                      return (
                        <tr
                          key={notification.id}
                          onClick={() => setSelectedId(notification.id)}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-muted/60',
                            selectedId === notification.id && 'bg-blue-500/5',
                          )}
                        >
                          <td className="px-4 py-4 align-top">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                                priority.className,
                              )}
                            >
                              {priority.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{notification.title}</p>
                              <p className="max-w-136 text-sm text-muted-foreground line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {typeLabelMap[notification.type] || notification.type}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{notification.recipient_name}</p>
                              <p className="text-xs text-muted-foreground">{notification.recipient_role}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize',
                                getStatusStyles(status),
                              )}
                            >
                              {status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top text-muted-foreground">
                            {formatRelativeTime(notification.created_at)}
                          </td>
                          <td className="px-4 py-4 align-top text-right">
                            <div className="flex justify-end gap-2">
                              {status === 'open' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={event => {
                                    event.stopPropagation()
                                    void handleAction(notification.id, 'mark-in-progress')
                                  }}
                                >
                                  Start
                                </Button>
                              ) : null}

                              {status !== 'resolved' ? (
                                <Button
                                  size="sm"
                                  onClick={event => {
                                    event.stopPropagation()
                                    void handleAction(notification.id, 'resolve')
                                  }}
                                  className="bg-slate-950 text-white hover:bg-slate-800"
                                >
                                  Resolve
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={event => {
                                    event.stopPropagation()
                                    void handleAction(notification.id, 'reopen')
                                  }}
                                >
                                  Reopen
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-lg shadow-slate-950/5 backdrop-blur sm:p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Workflow summary</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open items stay at the top. Use in-progress to acknowledge work, then resolve when done.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Open', value: summary.open, note: 'Waiting for action' },
                { label: 'In progress', value: summary.inProgress, note: 'Acknowledged by the team' },
                { label: 'Resolved', value: summary.resolved, note: 'Closed and archived from the default view' },
              ].map(item => (
                <div key={item.label} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                    </div>
                    <div className="max-w-40 text-right text-xs leading-5 text-muted-foreground">
                      {item.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/8 p-4 text-sm text-muted-foreground">
              Exceptions are backed by the existing notification fields. Open is unresolved and unread, in progress is
              read but unresolved, and resolved is archived from the default list.
            </div>
          </div>
        </div>
      </section>

      <Sheet open={Boolean(selectedNotification)} onOpenChange={open => !open && setSelectedId(null)}>
        <SheetContent side="right" className="sm:max-w-xl">
          {selectedNotification ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="space-y-3 border-b border-border/70 pb-4 pr-10">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize',
                      getStatusStyles(getStatus(selectedNotification)),
                    )}
                  >
                    {getStatus(selectedNotification).replace('_', ' ')}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                      getPriority(selectedNotification).className,
                    )}
                  >
                    {getPriority(selectedNotification).label} priority
                  </span>
                </div>
                <SheetTitle className="text-xl">{selectedNotification.title}</SheetTitle>
                <SheetDescription>{selectedNotification.recipient_name}</SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto py-6 pr-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                    <p className="mt-1 font-medium">{typeLabelMap[selectedNotification.type] || selectedNotification.type}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="mt-1 font-medium">{formatDateTime(selectedNotification.created_at)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Read state</p>
                    <p className="mt-1 font-medium">{selectedNotification.is_read ? 'Read' : 'Unread'}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Resolved</p>
                    <p className="mt-1 font-medium">{selectedNotification.resolved ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Details</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {selectedNotification.message}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Workflow notes</p>
                  <ul className="mt-3 space-y-2">
                    <li>• Open means unresolved and unread.</li>
                    <li>• In progress means the issue has been acknowledged.</li>
                    <li>• Resolved archives the issue from the default list.</li>
                  </ul>
                </div>

                {selectedNotification.resolved_at ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">
                    Resolved on {formatDateTime(selectedNotification.resolved_at)}
                  </div>
                ) : null}
              </div>

              <SheetFooter className="border-t border-border/70 bg-background/80 pr-0 backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row">
                  {selectedStatus === 'open' ? (
                    <Button
                      variant="outline"
                      onClick={() => void handleAction(selectedNotification.id, 'mark-in-progress')}
                      className="sm:flex-1"
                    >
                      Mark in progress
                    </Button>
                  ) : null}

                  {selectedStatus !== 'resolved' ? (
                    <Button
                      onClick={() => void handleAction(selectedNotification.id, 'resolve')}
                      className="bg-slate-950 text-white hover:bg-slate-800 sm:flex-1"
                    >
                      Resolve now
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => void handleAction(selectedNotification.id, 'reopen')} className="sm:flex-1">
                      Reopen
                    </Button>
                  )}

                  <Button variant="ghost" onClick={() => setSelectedId(null)} className="sm:flex-1">
                    Close
                  </Button>
                </div>
              </SheetFooter>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </SalesManagerPageShell>
  )
}