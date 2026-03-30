'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Search, Sparkles, Tags, Trash2, TriangleAlert } from 'lucide-react'

type CategoryRow = { id: string; name: string; created_at: string; item_count: number }

const SEARCH_DEBOUNCE_MS = 300

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [formName, setFormName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const loadCategories = async (query = search) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/categories?search=${encodeURIComponent(query)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load categories')
      }

      setCategories((data.categories as CategoryRow[]) || [])
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load categories'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories(search)
  }, [search])

  const trimmedFormName = formName.trim()
  const canSubmit = trimmedFormName.length >= 2 && !saving && (!editing || trimmedFormName !== editing.name.trim())

  const openCreate = () => {
    setEditing(null)
    setFormName('')
    setOpen(true)
  }

  const openEdit = (category: CategoryRow) => {
    setEditing(category)
    setFormName(category.name)
    setOpen(true)
  }

  const submit = async () => {
    const nextName = formName.trim()

    if (nextName.length < 2) {
      toast.error('Category name must be at least 2 characters')
      return
    }

    if (editing && nextName === editing.name.trim()) {
      toast.message('No changes to save')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(editing ? `/api/admin/categories/${editing.id}` : '/api/admin/categories', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(data.error || 'Category name already exists')
        }

        throw new Error(data.error || 'Failed to save category')
      }

      toast.success(editing ? 'Category updated' : 'Category created')
      setOpen(false)
      setEditing(null)
      setFormName('')
      await loadCategories(search)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error || 'Failed to save category'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (category: CategoryRow) => {
    const response = await fetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' })
    const responseText = await response.text()

    let data: { error?: string } = {}
    try {
      data = responseText ? JSON.parse(responseText) : {}
    } catch {
      data = {}
    }

    if (!response.ok) {
      toast.error(data.error || 'Failed to delete category')
      return
    }

    toast.success('Category deleted')
    setDeleteTarget(null)
    await loadCategories(search)
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-background via-card/70 to-background p-6 shadow-2xl shadow-slate-950/10 backdrop-blur sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_30%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-cyan-500" />
              Admin catalog structure
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Categories</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Manage product categories.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search categories"
                className="h-11 pl-10"
              />
            </div>
            <Button onClick={openCreate} className="h-11 bg-linear-to-r from-slate-950 to-slate-700 text-white shadow-lg shadow-slate-900/20">
              <Plus className="mr-2 h-4 w-4" /> Add Category
            </Button>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden border-border/70 bg-background/75 shadow-sm backdrop-blur">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4 sm:p-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="grid grid-cols-[1fr_160px_120px] gap-4 rounded-2xl border border-border/60 p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-32 justify-self-start" />
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
                <TriangleAlert className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Unable to load categories</h2>
                <p className="max-w-md text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={() => loadCategories(search)} variant="outline">
                Retry
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Tags className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">No categories found</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Click "Add Category" to create one.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="px-4 py-3 font-semibold">Category Name</TableHead>
                  <TableHead className="px-4 py-3 font-semibold">Created At</TableHead>
                  <TableHead className="px-4 py-3 text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map(category => (
                  <TableRow key={category.id} className="group border-border/60 hover:bg-muted/80">
                    <TableCell className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{category.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {category.item_count > 0
                              ? `Linked to ${category.item_count} item${category.item_count === 1 ? '' : 's'}`
                              : 'Not linked to any items'}
                          </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {formatCreatedAt(category.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-background hover:text-foreground"
                          onClick={() => openEdit(category)}
                          aria-label={`Edit ${category.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                          onClick={() => setDeleteTarget(category)}
                          aria-label={`Delete ${category.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={value => {
          setOpen(value)
          if (!value) {
            setEditing(null)
            setFormName('')
          }
        }}
      >
        <DialogContent className="max-w-100 border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update the category name and keep your catalog organized.' : 'Create a new category for your product catalog.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Enter category name"
              minLength={2}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="bg-linear-to-r from-slate-950 to-slate-700 text-white"
              onClick={submit}
              disabled={!canSubmit}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={value => {
          if (!value) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-600/90"
              onClick={async event => {
                event.preventDefault()
                if (deleteTarget) {
                  await remove(deleteTarget)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
