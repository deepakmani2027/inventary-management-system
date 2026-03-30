"use client"

import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AuthPageShellProps {
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  className
}: AuthPageShellProps) {
  return (
    <div className={cn('min-h-screen overflow-hidden bg-background text-foreground', className)}>
      
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-10 h-80 w-80 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-blue-500/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        
        {/* LEFT SIDE */}
        <section className="flex items-center px-4 py-10 sm:px-6 lg:px-12 xl:px-16">
          <div className="max-w-2xl space-y-8">

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur transition-colors hover:bg-background"
            >
              <span className="h-2 w-2 rounded-full bg-cyan-500" />
              InventoryPro
            </Link>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-4 py-2 text-sm backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                {eyebrow}
              </div>

              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                {title}
              </h1>

              {description && (
                <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {description}
                </p>
              )}
            </div>

            {/* Features */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Fast access', value: 'Instant role routing' },
                { label: 'Secure auth', value: 'Supabase powered sign-in' },
                { label: 'Clear UI', value: 'Matches the dashboard system' },
              ].map(item => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-sm backdrop-blur"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT SIDE */}
        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-12 xl:px-16">
          <div className="w-full max-w-md">
            <div className="rounded-4xl border border-border/70 bg-background/80 p-1 shadow-2xl shadow-slate-950/10 backdrop-blur-xl">
              <div className="rounded-[1.85rem] border border-border/40 bg-background/90 p-6 sm:p-8">
                {children}
              </div>
            </div>

            {footer && <div className="mt-6">{footer}</div>}
          </div>
        </section>
      </div>
    </div>
  )
}