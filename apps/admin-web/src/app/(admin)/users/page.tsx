'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAdminUsers } from '@/features/users/useAdminUsers';
import { UserActions } from '@/features/users/UserActions';
import { UserFilters } from '@/features/users/UserFilters';
import { DataTable, Column } from '@/components/DataTable';
import { useAdminSession } from '@/features/auth/useAdminSession';
import { AdminUser } from '@/lib/api/models';

export default function UsersPage() {
  const { user: currentAdmin } = useAdminSession();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 10;

  // 300ms debounce for search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filters = useMemo(() => {
    return {
      q: debouncedQuery || undefined,
      role: selectedRole === 'ALL' ? undefined : (selectedRole as 'PARENT' | 'NUTRITIONIST' | 'ADMIN'),
      disabled: selectedStatus === 'ALL' ? undefined : selectedStatus === 'DISABLED',
      page,
      limit,
    };
  }, [debouncedQuery, selectedRole, selectedStatus, page, limit]);

  const { data, isLoading, isError, refetch } = useAdminUsers(filters);

  const columns: Column<AdminUser>[] = useMemo(
    () => [
      {
        key: 'email',
        header: 'Email',
        render: (row) => (
          <div className="font-semibold text-slate-900">
            {row.email}
            {row.id === currentAdmin?.id && (
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                You
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        render: (row) => (
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            {row.role}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              row.disabled
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <span aria-hidden="true">{row.disabled ? '●' : '●'}</span>
            <span>{row.disabled ? 'Disabled' : 'Active'}</span>
          </span>
        ),
      },
      {
        key: 'verified',
        header: 'Verified',
        render: (row) => (
          <span className={`text-xs font-medium ${row.emailVerified ? 'text-emerald-700' : 'text-slate-400'}`}>
            {row.emailVerified ? 'Yes' : 'No'}
          </span>
        ),
      },
      {
        key: 'children',
        header: 'Children',
        render: (row) => (
          <span className="text-xs font-semibold text-slate-700">
            {row.childCount}
          </span>
        ),
      },
      {
        key: 'createdAt',
        header: 'Joined',
        render: (row) => {
          const date = new Date(row.createdAt);
          return (
            <span className="text-xs text-slate-500">
              {date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <UserActions user={row} currentUserId={currentAdmin?.id ?? null} />
        ),
      },
    ],
    [currentAdmin?.id]
  );

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            User Accounts
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage system roles, account permissions, and active statuses.
          </p>
        </div>
        <p className="text-xs text-slate-500 italic">
          Child counts only. No health data is shown here.
        </p>
      </div>

      {/* Filter Controls */}
      <UserFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedRole={selectedRole}
        onRoleChange={(role) => {
          setSelectedRole(role);
          setPage(1);
        }}
        selectedStatus={selectedStatus}
        onStatusChange={(status) => {
          setSelectedStatus(status);
          setPage(1);
        }}
      />

      {/* Error state */}
      {isError ? (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-red-800">
            Failed to load users list. Please try again.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="flat-button-secondary text-xs px-4 py-2"
          >
            Retry
          </button>
        </div>
      ) : (
        /* Data Table */
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          loading={isLoading}
          empty="No matching user accounts found."
          page={page}
          limit={limit}
          total={data?.total ?? 0}
          onPage={setPage}
        />
      )}
    </div>
  );
}
