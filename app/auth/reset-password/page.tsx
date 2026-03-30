'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardDescription, CardTitle } from '@/components/ui/card'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { getSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    const verifySession = async () => {
      const supabase = getSupabaseClient()
      const { data } = await supabase.auth.getSession()
      setSessionReady(Boolean(data.session))
    }

    verifySession()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!sessionReady) {
        toast.error('Open this page from the password reset link in your email')
        return
      }

      if (!formData.password || !formData.confirmPassword) {
        toast.error('Please fill in all fields')
        return
      }

      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match')
        return
      }

      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters')
        return
      }

      const supabase = getSupabaseClient()
      const { error } = await supabase.auth.updateUser({ password: formData.password })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Password updated successfully')
      router.push('/auth/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      eyebrow="Secure recovery"
      title="Create a new password"
      description="Use the reset link from your email to set a new password for your account."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Return to{' '}
          <Link href="/auth/login" className="font-medium text-foreground underline decoration-cyan-500/50 underline-offset-4 hover:text-cyan-600">
            sign in
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">Reset your password</CardTitle>
          <CardDescription className="text-muted-foreground">
            Choose a new password to finish recovering your account.
          </CardDescription>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">New password</label>
            <Input
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              className="border-border/70 bg-background/80 placeholder:text-muted-foreground/60"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Confirm password</label>
            <Input
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="border-border/70 bg-background/80 placeholder:text-muted-foreground/60"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/15"
            disabled={loading}
          >
            {loading ? 'Updating password...' : <><CheckCircle2 className="mr-2 h-4 w-4" /> Update password</>}
          </Button>
        </form>

        {!sessionReady ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700">
            This page must be opened from the email reset link before you can change the password.
          </div>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
            Your reset session is active and ready.
          </div>
        )}
      </div>
    </AuthPageShell>
  )
}
