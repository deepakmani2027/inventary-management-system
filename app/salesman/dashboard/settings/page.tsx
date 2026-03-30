'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, Sparkles, Settings2, ShieldCheck, UserCircle2, Mail, User } from 'lucide-react'

export default function SalesmanSettingsPage() {
	const [loading, setLoading] = useState(false)
	const [profileLoading, setProfileLoading] = useState(true)
	const [profile, setProfile] = useState<{ id: string; full_name: string; email: string } | null>(null)
	const [form, setForm] = useState({ full_name: '', email: '', newPassword: '', confirmPassword: '' })
	const searchParams = useSearchParams()
	const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile')

	useEffect(() => {
		const load = async () => {
			const supabase = getSupabaseClient()
			const {
				data: { user },
			} = await supabase.auth.getUser()
			if (!user) {
				setProfileLoading(false)
				return
			}

			const { data } = await supabase.from('users').select('id, full_name, email').eq('id', user.id).maybeSingle()
			if (data) {
				setProfile(data)
				setForm({ full_name: data.full_name || '', email: data.email || '', newPassword: '', confirmPassword: '' })
			} else {
				const fallbackFullName = user.user_metadata?.full_name || 'Salesman User'
				const fallbackEmail = user.email || ''
				setProfile({ id: user.id, full_name: fallbackFullName, email: fallbackEmail })
				setForm({ full_name: fallbackFullName, email: fallbackEmail, newPassword: '', confirmPassword: '' })
			}
			setProfileLoading(false)
		}

		load()
	}, [])

	useEffect(() => {
		const tab = searchParams.get('tab')
		if (tab === 'profile' || tab === 'security') {
			setActiveTab(tab)
		}
	}, [searchParams])

	const updateProfile = async () => {
		setLoading(true)
		try {
			const supabase = getSupabaseClient()
			const {
				data: { user },
			} = await supabase.auth.getUser()
			if (!user) {
				throw new Error('No authenticated user found')
			}

			const response = await fetch(`/api/admin/users/${user.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ full_name: form.full_name, email: form.email, role: profile?.id ? undefined : 'salesman' }),
			})

			const data = (await response.json().catch(() => ({}))) as { error?: string }

			if (!response.ok) {
				throw new Error(data.error || 'Failed to update profile')
			}

			if (data.user) {
				setProfile({
					id: data.user.id,
					full_name: data.user.full_name,
					email: data.user.email,
				})
			} else {
				setProfile(prev => (prev ? { ...prev, full_name: form.full_name, email: form.email } : prev))
			}

			toast.success('Profile updated')
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to update profile')
		} finally {
			setLoading(false)
		}
	}

	const changePassword = async () => {
		if (form.newPassword !== form.confirmPassword) {
			toast.error('Passwords do not match')
			return
		}

		setLoading(true)
		try {
			const supabase = getSupabaseClient()
			const { error } = await supabase.auth.updateUser({ password: form.newPassword })
			if (error) throw error
			toast.success('Password updated')
			setForm(prev => ({ ...prev, newPassword: '', confirmPassword: '' }))
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to change password')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
			<section className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-background via-card/70 to-background p-6 shadow-2xl shadow-slate-950/10 backdrop-blur sm:p-8">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_30%)]" />
				<div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-3xl space-y-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm backdrop-blur">
							<Sparkles className="h-4 w-4 text-cyan-500" />
							Salesman account controls
						</div>
						<div>
							<h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Settings</h1>
							<p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
								Manage profile details and security controls from a dedicated salesman workspace.
							</p>
						</div>
					</div>
					<div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm backdrop-blur">
						<Avatar className="h-12 w-12">
							<AvatarFallback className="bg-linear-to-br from-slate-950 to-slate-700 text-white">
								{profile?.full_name
									?.split(' ')
									.map(part => part[0])
									.join('')
									.toUpperCase()
									.slice(0, 2) || 'SA'}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="text-sm font-medium text-foreground">{profile?.full_name || 'Salesman account'}</p>
							<p className="text-sm text-muted-foreground">{profile?.email || 'Loading account details...'}</p>
							<p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Salesman only access</p>
						</div>
					</div>
				</div>
			</section>

			<Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
				<CardContent className="grid gap-4 pt-6 md:grid-cols-3">
					<div className="rounded-2xl border border-border/70 bg-background/80 p-4">
						<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600">
							<UserCircle2 className="h-5 w-5" />
						</div>
						<p className="text-sm text-muted-foreground">Profile status</p>
						<p className="mt-1 font-semibold">{profileLoading ? 'Loading...' : 'Ready to edit'}</p>
					</div>
					<div className="rounded-2xl border border-border/70 bg-background/80 p-4">
						<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
							<ShieldCheck className="h-5 w-5" />
						</div>
						<p className="text-sm text-muted-foreground">Security</p>
						<p className="mt-1 font-semibold">Password updates available</p>
					</div>
					<div className="rounded-2xl border border-border/70 bg-background/80 p-4">
						<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600">
							<Settings2 className="h-5 w-5" />
						</div>
						<p className="text-sm text-muted-foreground">Workspace</p>
						<p className="mt-1 font-semibold">Salesman only</p>
					</div>
				</CardContent>
			</Card>

			<Tabs
				value={activeTab}
				onValueChange={value => {
					const nextTab = value as 'profile' | 'security'
					setActiveTab(nextTab)
				}}
				className="space-y-6"
			>
				<TabsList className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-4 rounded-b-sm border border-border/80 bg-muted/40 shadow-sm backdrop-blur">
					<TabsTrigger value="profile" className="rounded-b-sm text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md">
						Profile
					</TabsTrigger>
					<TabsTrigger value="security" className="rounded-b-sm text-sm font-medium text-muted-foreground transition-all data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md">
						Security
					</TabsTrigger>
				</TabsList>

				<TabsContent value="profile" className="space-y-6">
					<div className="grid gap-6 lg:grid-cols-[320px_1fr]">
						<Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
							<CardHeader>
								<CardTitle>Profile summary</CardTitle>
								<CardDescription>Quick view of your salesman identity.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-background/80 p-4">
									<Avatar className="h-14 w-14">
										<AvatarFallback className="bg-linear-to-br from-slate-950 to-slate-700 text-white">
											{profile?.full_name
												?.split(' ')
												.map(part => part[0])
												.join('')
												.toUpperCase()
												.slice(0, 2) || 'SA'}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0">
										<p className="truncate text-base font-semibold">{profile?.full_name || 'Salesman account'}</p>
										<p className="truncate text-sm text-muted-foreground">{profile?.email || 'Loading account details...'}</p>
									</div>
								</div>
								<div className="space-y-3 text-sm text-muted-foreground">
									<div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
										<User className="h-4 w-4" />
										<span>Display name for salesman workspace and logs</span>
									</div>
									<div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
										<Mail className="h-4 w-4" />
										<span>Primary email tied to Supabase auth</span>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
							<CardHeader>
								<CardTitle>Profile</CardTitle>
								<CardDescription>Update your name and email address.</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-4">
								<div className="grid gap-2">
									<label className="text-sm font-medium text-foreground">Full name</label>
									<Input value={form.full_name} onChange={e => setForm(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Full name" disabled={profileLoading} />
								</div>
								<div className="grid gap-2">
									<label className="text-sm font-medium text-foreground">Email</label>
									<Input value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" disabled={profileLoading} />
								</div>
								<div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
									<span>Profile changes are saved for the current salesman account.</span>
									{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
								</div>
								<Button className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={updateProfile} disabled={loading || profileLoading}>
									{loading ? 'Saving...' : 'Save Profile'}
								</Button>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="security" className="space-y-6">
					<div className="grid gap-6 lg:grid-cols-[320px_1fr]">
						<Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
							<CardHeader>
								<CardTitle>Password guidance</CardTitle>
								<CardDescription>Keep your salesman account secure.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3 text-sm text-muted-foreground">
								<div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">Use at least 8 characters.</div>
								<div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">Use a password you have not used elsewhere.</div>
								<div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">Update it anytime from this workspace.</div>
							</CardContent>
						</Card>

						<Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
							<CardHeader>
								<CardTitle>Change Password</CardTitle>
								<CardDescription>Update your Supabase auth password.</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-4">
								<div className="grid gap-2">
									<label className="text-sm font-medium text-foreground">New password</label>
									<Input type="password" value={form.newPassword} onChange={e => setForm(prev => ({ ...prev, newPassword: e.target.value }))} placeholder="New password" />
								</div>
								<div className="grid gap-2">
									<label className="text-sm font-medium text-foreground">Confirm password</label>
									<Input type="password" value={form.confirmPassword} onChange={e => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))} placeholder="Confirm password" />
								</div>
								<Button className="bg-linear-to-r from-slate-950 to-slate-700 text-white" onClick={changePassword} disabled={loading}>
									{loading ? 'Updating...' : 'Change Password'}
								</Button>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	)
}