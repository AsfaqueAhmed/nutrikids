'use client';

import React from 'react';
import { useAdminStats } from '@/features/dashboard/useAdminStats';
import { StatTile } from '@/features/dashboard/StatTile';
import { SignupsChart } from '@/features/dashboard/SignupsChart';

export default function AdminDashboardPage() {
  const { data: stats, isLoading, isError, refetch } = useAdminStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Platform Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            System overview and aggregate platform performance metrics.
          </p>
        </div>
        <p className="text-xs text-slate-500 italic">
          Aggregate numbers only. Individual children&apos;s data is not shown here.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flat-card p-5 h-28 animate-pulse bg-white border border-slate-200 rounded-xl"
              />
            ))}
          </div>
          <div className="flat-card p-8 h-72 animate-pulse bg-white border border-slate-200 rounded-xl" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-red-800">
            Failed to load dashboard statistics.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="flat-button-secondary text-xs px-4 py-2"
          >
            Retry
          </button>
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Key Stat Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatTile
              label="Total Users"
              value={stats.totalUsers}
              hint={`${stats.verifiedUsers} verified accounts`}
              icon="👥"
            />
            <StatTile
              label="Verified Users"
              value={stats.verifiedUsers}
              hint={`${Math.round((stats.verifiedUsers / Math.max(1, stats.totalUsers)) * 100)}% verification rate`}
              icon="✅"
            />
            <StatTile
              label="Disabled Accounts"
              value={stats.disabledUsers}
              hint="Restricted from login"
              icon="🚫"
              className={stats.disabledUsers > 0 ? 'border-amber-300' : ''}
            />
            <StatTile
              label="Registered Children"
              value={stats.totalChildren}
              hint="Active child profiles"
              icon="👶"
            />
            <StatTile
              label="Meal Entries Generated"
              value={stats.mealEntriesGenerated}
              hint="Nutritional plans logged"
              icon="🥗"
            />
            <StatTile
              label="Vaccinations Administered"
              value={stats.vaccinationsGiven}
              hint="Verified immunization records"
              icon="💉"
            />
          </div>

          {/* Signups Chart */}
          <SignupsChart data={stats.signupsByDay ?? []} />
        </div>
      ) : null}
    </div>
  );
}
