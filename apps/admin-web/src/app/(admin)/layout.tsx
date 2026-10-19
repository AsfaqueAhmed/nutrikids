'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminSession } from '@/features/auth/useAdminSession';
import { AdminNav } from '@/components/AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAdminSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anon') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Checking credentials...</p>
        </div>
      </div>
    );
  }

  if (status === 'anon') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-base">
              N
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-slate-900 leading-tight">
                NutriKids
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
                Admin Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800">{user?.email}</span>
              <span className="text-[10px] text-slate-400">ADMINISTRATOR</span>
            </div>
            <button
              onClick={() => logout()}
              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 border-t border-slate-100">
          <AdminNav />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        NutriKids Admin Console • Protected system
      </footer>
    </div>
  );
}
