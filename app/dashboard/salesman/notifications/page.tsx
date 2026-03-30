'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, BellRing, CheckCheck, Clock3, Filter, RefreshCw, Search, Send } from 'lucide-react'
import { toast } from 'sonner'

import { SalesmanPageShell } from '@/components/dashboard/salesman-page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { getSupabaseClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type NotificationType = 'low_stock' | 'exception'
type NotificationFilter = NotificationType | 'all'

type NotificationRow = {
  id: string
  title: string
  message: string
  type: NotificationType
  is_read: boolean
  created_at: string
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.round(diffMs / 60000))

  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return `${Math.round(hours / 24)}d ago`
}

function getTypeLabel(type: NotificationType) {
  return type === 'low_stock' ? 'Low stock' : 'Exception'
}

function getTypeStyles(type: NotificationType) {
  return type === 'low_stock'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
}

export default function SalesmanNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [type, setType] = useState<NotificationType>('low_stock')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const supabase = getSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setNotifications([])
        return
      }

      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (notificationError) {
        toast.error(notificationError.message)
        return
      }

      setNotifications((notificationData as NotificationRow[]) || [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const supabase = getSupabaseClient()
    const channel = supabase
      .channel('salesman-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        void load(true)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    if (selectedId && !notifications.some(notification => notification.id === selectedId)) {
      setSelectedId(null)
    }
  }, [notifications, selectedId])

  const unreadCount = useMemo(() => notifications.filter(notification => !notification.is_read).length, [notifications])
  const lowStockCount = useMemo(() => notifications.filter(notification => notification.type === 'low_stock').length, [notifications])
  const exceptionCount = useMemo(() => notifications.filter(notification => notification.type === 'exception').length, [notifications])
  const todayCount = useMemo(
    () => notifications.filter(notification => new Date(notification.created_at).toDateString() === new Date().toDateString()).length,
    [notifications],
  )

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase()

    return notifications.filter(notification => {
      if (filter !== 'all' && notification.type !== filter) {
        return false
      }

      if (!query) {
        return true
      }

      return [notification.title, notification.message, notification.type].join(' ').toLowerCase().includes(query)
    })
  }, [notifications, search, filter])

  const selectedNotification = useMemo(
    () => filteredNotifications.find(notification => notification.id === selectedId) || null,
    [filteredNotifications, selectedId],
  )

  const lowStockPreview = useMemo(() => {
    const match = message.match(/([A-Za-z0-9\s-]+)\s+stock\s+is\s+low\s*\((\d+)\)/i)
    return match ? `${match[1].trim()} stock is low (${match[2]})` : ''
  }, [message])

  const sendNotification = async () => {
    const supabase = getSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error('User not authenticated')
      return
    }

    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      toast.error('Message is required')
      return
    }

    if (trimmedMessage.length > 200) {
      toast.error('Message should be 200 characters or less')
      return
    }

    setSending(true)

    try {
      const response = await fetch('/api/salesman/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: trimmedMessage,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send notification')
      }

      toast.success(`Notification sent to ${payload.recipientCount} manager${payload.recipientCount === 1 ? '' : 's'}`)
      setMessage('')
      setType('low_stock')
      setSendOpen(false)
      await load(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)

    if (error) {
      toast.error(error.message)
      return
    }

    setNotifications(prev =>
      prev.map(notification => (notification.id === notificationId ? { ...notification, is_read: true } : notification)),
    )
  }

  return (
    <SalesmanPageShell
      badge={
        <>
          <Bell className="h-4 w-4 text-cyan-500" />
          Team alerts
        </>
      }
      title="Notifications"
      description="Send alerts to managers and review the inbox in a focused workspace."
      actions={
        <>
          <Button
            variant="outline"
            className="border-border/70 bg-background/80 backdrop-blur"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>

          <Dialog open={sendOpen} onOpenChange={setSendOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-950 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800">
                <Send className="h-4 w-4" />
                Send notification
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Send notification</DialogTitle>
                <DialogDescription>
                  Route low stock alerts to the inventory manager and exceptions to the sales manager.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={type} onValueChange={value => setType(value as NotificationType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low_stock">Low stock</SelectItem>
                      <SelectItem value="exception">Exception</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    placeholder={type === 'low_stock' ? 'Laptop stock is low (2)' : 'Customer issue reported for review'}
                    maxLength={200}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{type === 'low_stock' ? 'Sends to inventory manager(s).' : 'Sends to sales manager(s).'}</span>
                    <span>{message.length}/200</span>
                  </div>
                </div>

                {type === 'low_stock' && lowStockPreview ? (
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                    Auto message preview: {lowStockPreview}
                  </div>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSendOpen(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button onClick={() => void sendNotification()} disabled={sending} className="bg-slate-950 text-white hover:bg-slate-800">
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Unread', value: unreadCount, icon: <BellRing className="h-5 w-5 text-blue-600" /> },
          { label: 'Low stock', value: lowStockCount, icon: <CheckCheck className="h-5 w-5 text-emerald-600" /> },
          { label: 'Exceptions', value: exceptionCount, icon: <Filter className="h-5 w-5 text-amber-600" /> },
          { label: 'Today', value: todayCount, icon: <Clock3 className="h-5 w-5 text-slate-700" /> },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-lg shadow-slate-950/5 backdrop-blur">
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
              <h2 className="text-xl font-semibold tracking-tight">Inbox</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredNotifications.length} of {notifications.length} notifications shown
              </p>
            </div>

            <div className="relative w-full min-w-60 flex-1 lg:max-w-md lg:flex-none">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title or message" className="h-10 pl-9" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(['all', 'low_stock', 'exception'] as const).map(option => {
              const active = filter === option
              const label = option === 'all' ? 'All' : getTypeLabel(option)

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-wide transition-all',
                    active
                      ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/20'
                      : 'border-border/70 bg-background/80 text-muted-foreground hover:border-slate-400 hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <Separator className="my-4" />

          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading notifications...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              No notifications match the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map(notification => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(notification.id)
                    void markAsRead(notification.id)
                  }}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-4 text-left transition-all hover:border-foreground/20',
                    notification.is_read
                      ? 'border-border/70 bg-background/50'
                      : 'border-emerald-500/25 bg-emerald-500/5 shadow-sm',
                    selectedId === notification.id && 'ring-2 ring-blue-500/20',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', notification.is_read ? 'bg-slate-400' : 'bg-emerald-500')} />
                      <span className="font-medium">{notification.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatRelativeTime(notification.created_at)}
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>

                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Badge variant={notification.type === 'low_stock' ? 'default' : 'secondary'} className={notification.type === 'low_stock' ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''}>
                      {getTypeLabel(notification.type)}
                    </Badge>
                    <Badge variant={notification.is_read ? 'outline' : 'default'} className={notification.is_read ? '' : 'bg-emerald-600 text-white hover:bg-emerald-600'}>
                      {notification.is_read ? 'Read' : 'Unread'}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-lg shadow-slate-950/5 backdrop-blur sm:p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Overview</h2>
              <p className="mt-1 text-sm text-muted-foreground">Monitor unread updates and send new alerts from the same screen.</p>
            </div>

            <div className="space-y-3">
              {[
                { label: 'Unread', value: unreadCount, note: 'Still waiting for review' },
                { label: 'Low stock', value: lowStockCount, note: 'Routes to inventory manager' },
                { label: 'Exceptions', value: exceptionCount, note: 'Routes to sales manager' },
              ].map(item => (
                <div key={item.label} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                    </div>
                    <div className="max-w-40 text-right text-xs leading-5 text-muted-foreground">{item.note}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/8 p-4 text-sm text-muted-foreground">
              Low stock messages are sent to inventory managers. Exception messages are sent to sales managers.
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
                  <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', getTypeStyles(selectedNotification.type))}>
                    {getTypeLabel(selectedNotification.type)}
                  </span>
                  <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', selectedNotification.is_read ? 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}>
                    {selectedNotification.is_read ? 'Read' : 'Unread'}
                  </span>
                </div>
                <SheetTitle className="text-xl">{selectedNotification.title}</SheetTitle>
                <SheetDescription>{formatTime(selectedNotification.created_at)}</SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto py-6 pr-2">
                <div className="rounded-2xl border border-border/70 bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Message</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{selectedNotification.message}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                    <p className="mt-1 font-medium">{getTypeLabel(selectedNotification.type)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Time</p>
                    <p className="mt-1 font-medium">{formatTime(selectedNotification.created_at)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Quick note</p>
                  <p className="mt-2">Clicking a notification marks it as read. Use the send button to create a new alert for the managers.</p>
                </div>
              </div>

              <SheetFooter className="border-t border-border/70 bg-background/80 pr-0 backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row">
                  {!selectedNotification.is_read ? (
                    <Button
                      variant="outline"
                      onClick={() => void markAsRead(selectedNotification.id)}
                      className="sm:flex-1"
                    >
                      Mark as read
                    </Button>
                  ) : null}

                  <Button variant="ghost" onClick={() => setSelectedId(null)} className="sm:flex-1">
                    Close
                  </Button>
                </div>
              </SheetFooter>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </SalesmanPageShell>
  )
}