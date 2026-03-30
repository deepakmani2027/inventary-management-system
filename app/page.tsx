"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, BarChart3, CheckCircle2, ChevronRight, ClipboardList, Factory, Package, ShieldCheck, Sparkles, Truck, Users } from 'lucide-react'

const highlights = [
  'Live inventory visibility',
  'Role-based dashboards',
  'Secure sales workflows',
]

const featureCards = [
  {
    icon: BarChart3,
    title: 'Clear analytics',
    desc: 'Track revenue, stock movement, and team performance from a single dashboard.',
  },
  {
    icon: ClipboardList,
    title: 'Fast billing flow',
    desc: 'Create bills, manage line items, and keep your transactions consistent.',
  },
  {
    icon: Truck,
    title: 'Restock ready',
    desc: 'Monitor low inventory and move stock back into the system without friction.',
  },
  {
    icon: ShieldCheck,
    title: 'Safe operations',
    desc: 'Role-aware access and transaction-safe actions keep the data reliable.',
  },
]

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-48 -top-40 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -right-40 top-24 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute -bottom-48 left-[30%] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_28%),linear-gradient(to_bottom,transparent,rgba(2,6,23,0.18))]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-slate-950 via-slate-800 to-slate-700 text-white shadow-lg shadow-cyan-500/20">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">InventoryPro</div>
              <div className="text-xs text-muted-foreground">Sales, stock, and execution in one place</div>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            {mounted ? (
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9 border-border/70 bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground sm:h-10 sm:w-10"
                aria-label="Toggle theme"
              >
                {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            ) : null}

            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20 hover:opacity-95">
              <Link href="/auth/signup">
                Get started
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pt-14">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-4 py-2 shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              <span className="text-sm font-medium text-foreground">Inventory and sales operations, polished for daily use</span>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
                Run stock, billing, and team performance from one command center.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                InventoryPro keeps your workflows aligned across admin, sales, and inventory teams with clean dashboards, secure access, and real-time operational visibility.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild className="bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-xl shadow-slate-900/20">
                <Link href="/auth/signup">
                  Start free trial
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-border/80 bg-background/70 backdrop-blur">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-3">
              {highlights.map(item => (
                <Badge key={item} variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                  {item}
                </Badge>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { value: '24/7', label: 'Team visibility' },
                { value: '99.9%', label: 'Operational uptime' },
                { value: '4 roles', label: 'Tailored experiences' },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm backdrop-blur">
                  <div className="text-2xl font-semibold tracking-tight">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <Card className="overflow-hidden border-border/70 bg-background/70 shadow-2xl shadow-slate-950/10 backdrop-blur">
              <CardContent className="space-y-6 p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Animated preview</div>
                    <div className="text-2xl font-semibold tracking-tight">Your operations, in motion</div>
                  </div>
                  <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
                    Synced
                  </div>
                </div>

                <div className="rounded-3xl border border-border/70 bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 p-4 shadow-inner shadow-slate-950/30 sm:p-6">
                  <div className="mx-auto flex aspect-square w-full max-w-md items-center justify-center">
                    <DotLottieReact
                      src="https://lottie.host/6b0cc379-cbf4-4820-99e7-d5c49f870aea/nH2kS1TTAS.lottie"
                      loop
                      autoplay
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: Users, title: 'Role-based access', value: 'Admin, sales, inventory, manager' },
                    { icon: Factory, title: 'Operational clarity', value: 'One source of truth for your team' },
                    { icon: Package, title: 'Inventory accuracy', value: 'Stock movements stay in sync' },
                    { icon: ShieldCheck, title: 'Safer workflows', value: 'Authenticated actions and checks' },
                  ].map(item => (
                    <div key={item.title} className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm backdrop-blur">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-slate-950 to-slate-700 text-white">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">{item.title}</div>
                          <div className="text-sm font-semibold">{item.value}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="absolute -right-2 -top-2 hidden rounded-2xl border border-border/70 bg-background/90 px-4 py-3 text-sm shadow-lg shadow-slate-900/10 backdrop-blur md:block">
              <div className="font-medium">Built for speed</div>
              <div className="text-muted-foreground">A landing page that feels alive.</div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map(feature => (
            <Card key={feature.title} className="border-border/70 bg-background/70 shadow-sm backdrop-blur">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/15">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-lg font-semibold tracking-tight">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <Card className="border-border/70 bg-background/70 shadow-sm backdrop-blur">
            <CardContent className="space-y-5 p-6 sm:p-8">
              <div>
                <div className="text-sm font-medium text-muted-foreground">What this platform covers</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight">Built around how your team actually works.</h2>
              </div>

              <div className="space-y-4">
                {[
                  'Deduct stock on billing, save the sale, and persist item rows together.',
                  'Restore inventory when a sale is cancelled.',
                  'Increase stock on returns so counts stay accurate.',
                  'Use transactions to keep every adjustment consistent.',
                ].map(item => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/60 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/70 bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-2xl shadow-slate-950/10">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
                  Designed for every role
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight">One platform, four tailored experiences.</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                  Admin, Salesman, Inventory Manager, and Sales Manager each get a focused workflow with the same shared source of truth.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  'Admin: users, categories, items, settings',
                  'Salesman: bills, stock view, returns, help',
                  'Inventory: restock, low stock, validation, reports',
                  'Sales Manager: analytics, exceptions, trends, reports',
                ].map(item => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                    {item}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                  <Link href="/auth/signup">Create account</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                  <Link href="/auth/login">Open login</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="relative border-t border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:px-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-slate-950 via-slate-800 to-slate-700 text-white shadow-lg shadow-cyan-500/20">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-tight">InventoryPro</div>
                <div className="text-xs text-muted-foreground">Modern inventory and sales execution</div>
              </div>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              A focused platform for retail teams that need clarity, role-based access, and dependable workflows.
            </p>
          </div>

          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Product</div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li><Link href="/auth/login" className="transition-colors hover:text-foreground">Login</Link></li>
              <li><Link href="/auth/signup" className="transition-colors hover:text-foreground">Create account</Link></li>
              <li><Link href="/settings" className="transition-colors hover:text-foreground">Settings</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Support</div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li><span className="transition-colors hover:text-foreground">Dashboard help</span></li>
              <li><span className="transition-colors hover:text-foreground">Role access</span></li>
              <li><span className="transition-colors hover:text-foreground">Inventory setup</span></li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Contact</div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>support@inventorypro.app</li>
              <li>+91 98765 43210</li>
              <li>Mon - Sat, 9:00 AM - 6:00 PM</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© 2026 InventoryPro. All rights reserved.</p>
            <p>Built for retail operations, sales execution, and stock accuracy.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}