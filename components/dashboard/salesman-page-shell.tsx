import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SalesmanPageShellProps {
  badge: ReactNode
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function SalesmanPageShell({ badge, title, description, actions, children, className }: SalesmanPageShellProps) {
  return (
    <div className={cn('space-y-6 p-4 sm:p-6 lg:p-8', className)}>
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-background via-card/70 to-background p-6 shadow-2xl shadow-slate-950/10 sm:p-8 backdrop-blur">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.10),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm backdrop-blur">
              {badge}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
            </div>
          </div>

          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </section>

      {children}
    </div>
  )
}