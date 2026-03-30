'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { getSupabaseClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const run = async () => {
      const supabase = getSupabaseClient()
      const code = searchParams.get('code')
      const next = searchParams.get('next') || '/auth/reset-password'

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
          router.replace('/auth/login')
          return
        }

        router.replace(next)
        return
      }

      router.replace('/auth/login')
    }

    run()
  }, [router, searchParams])

  return (
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
  )
}
