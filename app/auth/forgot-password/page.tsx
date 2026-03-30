'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardDescription, CardTitle } from '@/components/ui/card'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { toast } from 'sonner'
import { Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      const trimmedEmail = email.trim()

      if (!trimmedEmail) {
        toast.error('Please enter your email address')
        return
      }

      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      })

      const data = await response.json().catch(() => ({})) as { error?: string }

      if (!response.ok) {
        toast.error(data.error || 'Failed to send reset link')
        return
      }

      toast.success('Password reset link requested. Check your inbox and spam folder in a few minutes.')
      setEmail('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      eyebrow="Account recovery"
      title="Forgot your password?"
      description="Enter your email and we will send you a secure link to create a new password."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link href="/auth/login" className="font-medium text-foreground underline decoration-cyan-500/50 underline-offset-4 hover:text-cyan-600">
            Back to sign in
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">Reset password</CardTitle>
          <CardDescription className="text-muted-foreground">
            We will send a password reset link to your inbox.
          </CardDescription>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Email</label>
            <Input
              name="email"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border-border/70 bg-background/80 placeholder:text-muted-foreground/60"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/15"
            disabled={loading}
          >
            {loading ? 'Sending link...' : <><Mail className="mr-2 h-4 w-4" /> Send reset link</>}
          </Button>
        </form>

        <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
          If the address exists in the system, a reset link will be delivered there. Delivery can take a few minutes, so also check your spam or promotions folder.
        </div>
      </div>
    </AuthPageShell>
  )
}
