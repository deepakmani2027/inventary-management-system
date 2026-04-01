'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Column<T> {
  key: keyof T
  label: string
  render?: (value: any, row: T) => React.ReactNode
}

interface DataTableProps<T> {
  title: string
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  pageSize?: number
  hidePagination?: boolean
  action?: React.ReactNode
}

export function DataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  pageSize = 8,
  hidePagination = false,
  action,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  // Clamp page if totalPages shrinks
  useEffect(() => {
    setPage(prev => Math.min(Math.max(1, prev), totalPages))
  }, [totalPages])

  // Reset to first page when the data set itself changes (e.g., new filter/search)
  useEffect(() => {
    setPage(1)
  }, [data])
  const visibleRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return data.slice(startIndex, startIndex + pageSize)
  }, [data, currentPage, pageSize])

  return (
    <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur">
      <CardHeader>
        <CardTitle className="tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full max-h-[260px] overflow-y-auto relative">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-background/80 sticky top-0 z-20 border-border/70">
                {columns.map((column, index) => (
                  <TableHead key={`${String(column.key)}-${index}`} className="px-4 py-3 text-left">
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((row, idx) => (
                  <TableRow key={(row as any).id ?? idx} className="border-t border-border/70 hover:bg-accent/40">
                    {columns.map((column, index) => (
                      <TableCell key={`${String(column.key)}-${index}`} className="px-4 py-3">
                        {column.render ? column.render(row[column.key], row) : row[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {(action || (!hidePagination && Math.ceil(data.length / pageSize) > 1)) && (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              {!hidePagination && Math.ceil(data.length / pageSize) > 1 ? (
                <>Page {currentPage} of {totalPages}</>
              ) : (
                <>&nbsp;</>
              )}
            </span>
            <div className="flex items-center gap-2">
              {!hidePagination && Math.ceil(data.length / pageSize) > 1 ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/70"
                    disabled={currentPage === 1}
                    onClick={() => setPage(curr => Math.max(1, curr - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border/70"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(curr => Math.min(Math.max(1, Math.ceil(data.length / pageSize)), curr + 1))}
                  >
                    Next
                  </Button>
                </>
              ) : (
                action
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
