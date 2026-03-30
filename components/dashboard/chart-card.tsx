import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartLegend } from '@/components/ui/chart'

interface ChartCardProps {
  title: string
  children: React.ReactNode
}

export function ChartCard({ title, children }: ChartCardProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            desktop: {
              label: 'Desktop',
              color: 'hsl(var(--chart-1))',
            },
            mobile: {
              label: 'Mobile',
              color: 'hsl(var(--chart-2))',
            },
          }}
          className="h-75"
        >
          {children}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
