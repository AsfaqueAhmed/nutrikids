'use client';

import React from 'react';

export type UserFiltersProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedRole: string;
  onRoleChange: (role: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
};

export function UserFilters({
  searchTerm,
  onSearchChange,
  selectedRole,
  onRoleChange,
  selectedStatus,
  onStatusChange,
}: UserFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {/* Search Input */}
      <div className="relative flex-1">
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search users by email..."
          className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Role Filter */}
      <select
        aria-label="Filter by role"
        value={selectedRole}
        onChange={(e) => onRoleChange(e.target.value)}
        className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-600"
      >
        <option value="ALL">All Roles</option>
        <option value="PARENT">Parents</option>
        <option value="NUTRITIONIST">Nutritionists</option>
        <option value="ADMIN">Admins</option>
      </select>

      {/* Status Filter */}
      <select
        aria-label="Filter by status"
        value={selectedStatus}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-600"
      >
        <option value="ALL">All Statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="DISABLED">Disabled</option>
      </select>
    </div>
  );
}
