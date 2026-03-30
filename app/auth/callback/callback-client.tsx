'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { getSupabaseClient } from '@/lib/supabase/client'

export function AuthCallbackClient({
  code,
  nextPath,
}: {
  code: string
  nextPath: string
}) {
  const router = useRouter()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const run = async () => {
      const supabase = getSupabaseClient()

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
          router.replace('/auth/login')
          return
        }

        router.replace(nextPath)
        return
      }

      router.replace('/auth/login')
    }

    run()
  }, [code, nextPath, router])

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
