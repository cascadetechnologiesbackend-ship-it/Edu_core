"use client";

import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef as TanStackColumnDef,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

export interface ColumnDef<TData> {
  id?: string | undefined;
  header: React.ReactNode | ((info: any) => React.ReactNode);
  accessorKey?: keyof TData | string | undefined;
  sortable?: boolean | undefined;
  cell?: ((row: TData) => React.ReactNode) | undefined;
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  totalRows?: number | undefined;
  pageSize?: number | undefined;
  pageIndex?: number | undefined;
  isLoading?: boolean | undefined;
  onPageChange?: ((page: number) => void) | undefined;
  onRowClick?: ((row: TData) => void) | undefined;
  actions?: ((row: TData) => React.ReactNode) | undefined;
  selectable?: boolean | undefined;
  searchKey?: string | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  emptyState?: {
    title?: string | undefined;
    description?: string | undefined;
    actionLabel?: string | undefined;
    actionHref?: string | undefined;
  } | undefined;
  className?: string | undefined;
}

export function DataTable<TData>({
  columns,
  data,
  totalRows = data.length,
  pageSize = 25,
  pageIndex = 1,
  isLoading = false,
  onPageChange,
  onRowClick,
  actions,
  selectable,
  searchKey,
  emptyTitle = "No records found",
  emptyDescription = "No data matches your active filter criteria.",
  emptyState,
  className,
}: DataTableProps<TData>) {
  const tanstackColumns = useMemo<TanStackColumnDef<TData, any>[]>(() => {
    return columns.map((col) => {
      const colDef: any = {
        header:
          typeof col.header === "function"
            ? (info: any) => (col.header as any)(info)
            : () => col.header,
        enableSorting: !!col.sortable,
        cell: col.cell
          ? (info: any) => col.cell!(info.row.original)
          : (info: any) => (info.getValue() as React.ReactNode),
      };
      if (col.id) {
        colDef.id = col.id;
      }
      if (col.accessorKey) {
        colDef.accessorKey = col.accessorKey;
      }
      return colDef;
    });
  }, [columns]);

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalRows / pageSize),
  });

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <div className={cn("space-y-4", className)}>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-gray-200 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/50"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="p-3.5 text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider select-none whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                {actions && (
                  <th className="p-3.5 text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider text-right whitespace-nowrap">
                    Actions
                  </th>
                )}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skel-${idx}`} className="animate-pulse">
                  {columns.map((_, colIdx) => (
                    <td key={`skel-td-${colIdx}`} className="p-4">
                      <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded-md w-3/4" />
                    </td>
                  ))}
                  {actions && <td className="p-4" />}
                </tr>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick && onRowClick(row.original)}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-slate-800/60"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-3.5 whitespace-nowrap text-gray-700 dark:text-slate-300">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  {actions && (
                    <td
                      className="p-3.5 whitespace-nowrap text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actions(row.original)}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="p-8 text-center">
                  <EmptyState
                    title={emptyState?.title || emptyTitle}
                    description={emptyState?.description || emptyDescription}
                    actionLabel={emptyState?.actionLabel}
                    actionHref={emptyState?.actionHref}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && onPageChange && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-xs text-gray-500 dark:text-slate-400">
          <div>
            Showing {(pageIndex - 1) * pageSize + 1} to{" "}
            {Math.min(pageIndex * pageSize, totalRows)} of {totalRows} entries
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={pageIndex <= 1}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(pageIndex - 1)}
              disabled={pageIndex <= 1}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-semibold text-gray-800 dark:text-slate-200">
              Page {pageIndex} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => onPageChange(pageIndex + 1)}
              disabled={pageIndex >= totalPages}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={pageIndex >= totalPages}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
