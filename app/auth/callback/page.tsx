import { Suspense } from 'react'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { AuthCallbackClient } from './callback-client'

export const dynamic = 'force-dynamic'

export const revalidate = 0

export default function AuthCallbackPage({
  searchParams,
}: {
  searchParams?: { code?: string; next?: string }
}) {
  return (
    <Suspense
      fallback={
        <AuthPageShell
          eyebrow="Completing sign-in"
          title="Preparing your session"
          description="Please wait while we verify your secure link and route you to the next step."
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
              We are checking your secure link now.
            </div>
          </div>
        </AuthPageShell>
      }
    >
      <AuthCallbackClient code={searchParams?.code || ''} nextPath={searchParams?.next || '/auth/reset-password'} />
    </Suspense>
  )
}
