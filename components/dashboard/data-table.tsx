'use client'

import { useMemo, useState } from 'react'
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
}

export function DataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  pageSize = 8,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const currentPage = Math.min(page, totalPages)
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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/70 hover:bg-transparent">
                {columns.map((column, index) => (
                  <TableHead key={`${String(column.key)}-${index}`} className="text-muted-foreground">
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
                  <TableRow key={idx} className="border-border/70 hover:bg-accent/40">
                    {columns.map((column, index) => (
                      <TableCell key={`${String(column.key)}-${index}`} className="text-foreground">
                        {column.render
                          ? column.render(row[column.key], row)
                          : row[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {data.length > pageSize && (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-border/70"
                disabled={currentPage === 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-border/70"
                disabled={currentPage === totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
