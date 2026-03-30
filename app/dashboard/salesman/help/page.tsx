import { HelpCircle } from 'lucide-react'
import { SalesmanPageShell } from '@/components/dashboard/salesman-page-shell'

export default function SalesmanHelpPage() {
  return (
    <SalesmanPageShell
      badge={<><HelpCircle className="h-4 w-4 text-cyan-500" /> Support</>}
      title="Help"
      description="Quick guidance for billing, stock checks, and sales operations."
    >
      <div className="max-w-3xl space-y-3 rounded-3xl border border-border/70 bg-background/75 p-6 text-sm leading-6 text-muted-foreground shadow-sm backdrop-blur">
        <p>1. Open Inventory to verify stock before billing.</p>
        <p>2. Use Create Bill to add items and checkout.</p>
        <p>3. Cancel a sale from Returns when needed. Stock is restored automatically.</p>
        <p>4. Use Notifications to notify inventory or sales management about exceptions.</p>
      </div>
    </SalesmanPageShell>
  )
}
