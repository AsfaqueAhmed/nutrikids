'use client';

import React from 'react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          System overview and aggregate platform performance.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/users"
          className="flat-card p-5 hover:border-emerald-500 transition-colors block"
        >
          <span className="text-xl">👥</span>
          <h2 className="mt-2 font-semibold text-slate-900">Users</h2>
          <p className="text-xs text-slate-500 mt-1">Manage accounts and roles</p>
        </Link>
        <Link
          href="/foods"
          className="flat-card p-5 hover:border-emerald-500 transition-colors block"
        >
          <span className="text-xl">🥑</span>
          <h2 className="mt-2 font-semibold text-slate-900">Foods</h2>
          <p className="text-xs text-slate-500 mt-1">Nutritional catalogue & allergens</p>
        </Link>
        <Link
          href="/articles"
          className="flat-card p-5 hover:border-emerald-500 transition-colors block"
        >
          <span className="text-xl">📝</span>
          <h2 className="mt-2 font-semibold text-slate-900">Articles</h2>
          <p className="text-xs text-slate-500 mt-1">Publish guides and tips</p>
        </Link>
        <Link
          href="/vaccines"
          className="flat-card p-5 hover:border-emerald-500 transition-colors block"
        >
          <span className="text-xl">💉</span>
          <h2 className="mt-2 font-semibold text-slate-900">Vaccines</h2>
          <p className="text-xs text-slate-500 mt-1">Catalogue and schedules</p>
        </Link>
      </div>
    </div>
  );
}
