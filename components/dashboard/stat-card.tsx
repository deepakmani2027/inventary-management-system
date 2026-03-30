import { Card, CardContent } from '@/components/ui/card'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  change?: number
  subtext?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: 'up' | 'down'
}

export function StatCard({ label, value, change, subtext, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            {change !== undefined ? (
              <div className="mt-3 flex items-center gap-1">
                {trend === 'up' && <ArrowUp className="h-4 w-4 text-green-500" />}
                {trend === 'down' && <ArrowDown className="h-4 w-4 text-red-500" />}
                <span className={trend === 'up' ? 'text-green-600' : 'text-red-600'} style={{ fontSize: '0.875rem' }}>
                  {Math.abs(change)}% from last month
                </span>
              </div>
            ) : subtext ? (
              <p className="mt-3 text-sm text-muted-foreground">{subtext}</p>
            ) : null}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/15">
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
