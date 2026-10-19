import React, { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty?: string;
  page: number;
  limit: number;
  total: number;
  onPage(p: number): void;
};

export function DataTable<T>({
  columns,
  rows,
  loading = false,
  empty = 'No records found.',
  page,
  limit,
  total,
  onPage,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="w-full space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm text-slate-800">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col" className={`px-4 py-3 ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-500"
                  role="status"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                    <span className="text-xs font-medium">Loading records...</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={(row as { id?: string | number })?.id ?? idx}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3.5 ${col.className ?? ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between px-1 py-1 text-xs text-slate-600">
        <div>
          Showing {total === 0 ? 0 : (page - 1) * limit + 1} to{' '}
          {Math.min(page * limit, total)} of {total} records
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={!hasPrevious}
            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="px-2 font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={!hasNext}
            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
