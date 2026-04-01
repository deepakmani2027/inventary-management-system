'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { ArrowRight, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!formData.email || !formData.password) {
        toast.error('Please fill in all fields')
        setLoading(false)
        return
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json().catch(() => ({})) as { error?: string; user?: { role?: string } }

      if (!response.ok) {
        toast.error(data.error || 'Login failed')
        setLoading(false)
        return
      }

      const role = data.user?.role || 'user'

      // Redirect based on role
      const roleRoutes: Record<string, string> = {
        admin: '/admin/dashboard',
        salesman: '/salesman/dashboard',
        inventory_manager: '/inventory/dashboard',
        sales_manager: '/sales-manager/dashboard',
      }

      const redirectUrl = roleRoutes[role] || '/auth/login'
      toast.success('Login successful!')
      router.push(redirectUrl)
    } catch (error) {
      toast.error('An error occurred during login')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      eyebrow="Secure role access"
      title="Sign in to your workspace"
      description="Use your account to access the dashboard assigned to your role. The interface stays aligned with the rest of the product: clear, modern, and readable."
      footer={
        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="font-medium text-foreground underline decoration-cyan-500/50 underline-offset-4 hover:text-cyan-600">
            Create one
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">Sign In</CardTitle>
          <CardDescription className="text-muted-foreground">
            Access your inventory management dashboard
          </CardDescription>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-muted-foreground underline decoration-cyan-500/50 underline-offset-4 transition-colors hover:text-cyan-600"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/15"
            disabled={loading}
          >
            {loading ? 'Signing in...' : <><ShieldCheck className="mr-2 h-4 w-4" /> Sign In</>}
          </Button>
        </form>

      </div>
    </AuthPageShell>
  )
}