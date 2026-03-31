'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'

export default function VerifyOtpPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [mounted, setMounted] = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const COOLDOWN = 30
  const cooldownRef = useRef<number | null>(null)

  // ✅ VERIFY
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })

      const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          if (res.status === 404 || data?.code === 'PENDING_NOT_FOUND') {
            // If a real user exists, handle elsewhere. Otherwise redirect to signup
            toast.error('Pending signup not found. Redirecting to signup to recreate account.')
            try {
              localStorage.removeItem('pending_signup_email')
              localStorage.removeItem('pending_signup_sent_at')
            } catch {}
            router.push(`/auth/signup?email=${encodeURIComponent(email)}`)
            return
          }

          if (data?.code === 'EMAIL_EXISTS') {
            setEmailExists(true)
          }

          toast.error(data.error || 'Verification failed')
          return
        }

      try {
        localStorage.removeItem('pending_signup_email')
        localStorage.removeItem('pending_signup_sent_at')
      } catch {}
      toast.success('Verified successfully!')
      router.push('/auth/login')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ✅ RESEND
  const handleResend = async () => {
    if (!email) {
      toast.error('No email found to resend OTP for')
      return
    }

    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data?.code === 'PENDING_NOT_FOUND') {
          // pending signup doesn't exist any more — redirect to signup to recreate
          try {
            localStorage.removeItem('pending_signup_email')
            localStorage.removeItem('pending_signup_sent_at')
          } catch {}
          toast.error('Pending signup not found. Redirecting to signup.')
          router.push(`/auth/signup?email=${encodeURIComponent(email)}`)
          return
        }

        if (data?.code === 'EMAIL_EXISTS') {
          setEmailExists(true)
        }

        console.warn('resend failed', data)
        toast.error(data.error || 'Failed to resend OTP')
        return
      }

      // record sent timestamp and start cooldown
      try {
        localStorage.setItem('pending_signup_sent_at', String(Date.now()))
      } catch (e) {
        console.warn('Could not set pending_signup_sent_at', e)
      }
      setResendCooldown(COOLDOWN)
      // start countdown
      if (cooldownRef.current) {
        window.clearInterval(cooldownRef.current)
      }
      cooldownRef.current = window.setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            if (cooldownRef.current) {
              window.clearInterval(cooldownRef.current)
              cooldownRef.current = null
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)

      // In dev, the server may return the actual OTP for debugging — autofill it
      toast.success('OTP sent again!')
    } finally {
      setResending(false)
    }
  }

  // ✅ GET EMAIL (IMPORTANT)
  useEffect(() => {
    // prefer email passed via URL (router redirect from signup)
    let pending = ''
    try {
      const params = new URLSearchParams(window.location.search)
      const emailFromUrl = params.get('email')
      if (emailFromUrl) pending = emailFromUrl
      else pending = localStorage.getItem('pending_signup_email') || ''
    } catch (e) {
      pending = localStorage.getItem('pending_signup_email') || ''
    }

    setEmail(pending)
    setMounted(true)

    // initialize resend cooldown from stored timestamp
    try {
      const sentAt = Number(localStorage.getItem('pending_signup_sent_at') || '0')
      if (sentAt) {
        const elapsed = Math.floor((Date.now() - sentAt) / 1000)
        const remaining = Math.max(0, COOLDOWN - elapsed)
        setResendCooldown(remaining)
        if (remaining > 0) {
          // start countdown
          if (cooldownRef.current) window.clearInterval(cooldownRef.current)
          cooldownRef.current = window.setInterval(() => {
            setResendCooldown(prev => {
              if (prev <= 1) {
                if (cooldownRef.current) {
                  window.clearInterval(cooldownRef.current)
                  cooldownRef.current = null
                }
                return 0
              }
              return prev - 1
            })
          }, 1000)
        }
      }
    } catch (e) {
      console.warn('Could not read pending_signup_sent_at', e)
    }
  }, [])

  // clear interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) {
        window.clearInterval(cooldownRef.current)
        cooldownRef.current = null
      }
    }
  }, [])

  // ✅ FIXED REDIRECT (WAIT FOR mounted)
  useEffect(() => {
    if (!mounted) return

    if (!email) {
      // session expired or missing pending email
      try {
        localStorage.removeItem('pending_signup_email')
      } catch {}
      toast.error('Session expired. Please sign up again.')
      const t = setTimeout(() => router.push('/auth/signup'), 700)
      return () => clearTimeout(t)
    }
    // intentionally only depend on `mounted` so dependency array size stays constant
    // `email` is read from state which is set before `mounted` becomes true
  }, [mounted])

  // ✅ AUTO SUBMIT
  useEffect(() => {
    if (otp.length === 6 && !loading) {
      const t = setTimeout(() => {
        handleSubmit({ preventDefault: () => {} } as any)
      }, 150)
      return () => clearTimeout(t)
    }
  }, [otp])

  return (
    <AuthPageShell
      eyebrow="Verify email"
      title="Enter verification code"
      footer={
        <div className="text-center text-sm text-muted-foreground space-y-2">
            <div>
            Didn&apos;t get the code?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendCooldown > 0}
              className="font-medium text-foreground underline"
            >
              {resending ? 'Sending...' : resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend'}
            </button>
          </div>

          {emailExists && (
            <div className="text-red-500">
              This email is already registered. Please sign in.
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* HEADER */}
        <div className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Verify OTP
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <br />
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* OTP */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Enter 6-digit OTP
            </p>

            {mounted ? (
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup className="gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="
                        h-12 w-12 
                        bg-white 
                        border 
                        rounded-lg 
                        text-lg font-semibold 
                        shadow-sm
                        focus:ring-2 focus:ring-slate-900
                      "
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            ) : (
              <div className="flex gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 w-12 rounded-lg border bg-white"
                  />
                ))}
              </div>
            )}
          </div>

          {/* BUTTON */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </Button>

          {/* WRONG EMAIL */}
          <div className="text-center text-sm text-muted-foreground">
            Wrong email?{' '}
            <button
              type="button"
              onClick={() => router.push('/auth/signup')}
              className="underline"
            >
              Go back
            </button>
          </div>
        </form>
      </div>
    </AuthPageShell>
  )
}