'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardDescription, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
// note: do not import server-dependent supabase client in client components
import { toast } from 'sonner'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { ShieldCheck } from 'lucide-react'

const ROLES = [
  { value: 'salesman', label: 'Salesman' },
  { value: 'inventory_manager', label: 'Inventory Manager' },
  { value: 'sales_manager', label: 'Sales Manager' },
]

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: '',
  })

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const prefill = params.get('email')
        if (prefill) setFormData(prev => ({ ...prev, email: prefill }))
      }
    } catch (e) {
      // ignore
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleRoleChange = (value: string) => {
    setFormData(prev => ({ ...prev, role: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!formData.email || !formData.password || !formData.name || !formData.role) {
        toast.error('Please fill in all fields')
        setLoading(false)
        return
      }

      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match')
        setLoading(false)
        return
      }

      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters')
        setLoading(false)
        return
      }

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password,
        }),
      })

      const data = await response.json().catch(() => ({})) as { error?: string }

      if (!response.ok) {
        toast.error(data.error || 'Failed to create account')
        setLoading(false)
        return
      }

      // store pending signup email so verify page can read it
      try {
        localStorage.setItem('pending_signup_email', formData.email)
        // record when OTP was sent so verify page can enforce resend cooldown
        try {
          localStorage.setItem('pending_signup_sent_at', String(Date.now()))
        } catch (e) {
          console.warn('Could not set pending_signup_sent_at', e)
        }
      } catch (e) {
        console.warn('Could not set localStorage pending_signup_email', e)
      }

      toast.success('OTP sent — check your email and verify to complete signup')
      router.push(`/auth/verify-otp?email=${encodeURIComponent(formData.email)}`)
    } catch (error) {
      toast.error('An error occurred during signup')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      eyebrow="Create your profile"
      title="Set up your account"
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-foreground underline decoration-cyan-500/50 underline-offset-4 hover:text-cyan-600">
            Sign in
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">Create Account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Join our inventory management system
          </CardDescription>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Full Name</label>
            <Input
              name="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              className="border-border/70 bg-background/80 placeholder:text-muted-foreground/60"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Email</label>
            <Input
              name="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleChange}
              className="border-border/70 bg-background/80 placeholder:text-muted-foreground/60"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Select Role</label>
            <div role="radiogroup" aria-label="Role" className="grid gap-2">
              {ROLES.map((r) => {
                const selected = formData.role === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleRoleChange(r.value)}
                    className={cn(
                      'w-full rounded-md border p-3 flex items-center gap-3 text-left transition',
                      selected
                        ? 'bg-cyan-900 border-cyan-950 text-white'
                        : 'bg-background/50 border-border/60 text-foreground'
                    )}
                  >
                    <span className={cn('h-3 w-3 rounded-full shrink-0', selected ? 'bg-white' : 'bg-muted-foreground/60')} />
                    <div>
                      <div className="text-sm font-medium">{r.label}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Password</label>
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
            <label className="text-sm font-medium text-foreground/80">Confirm Password</label>
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
            {loading ? 'Creating Account...' : <><ShieldCheck className="mr-2 h-4 w-4" /> Create Account</>}
          </Button>
        </form>
      </div>
    </AuthPageShell>
  )
}
