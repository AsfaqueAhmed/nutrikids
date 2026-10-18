'use client';

import { useSession } from '@/features/auth/useSession';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anon') {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Loading NutriKids...</p>
        </div>
      </div>
    );
  }

  if (status === 'anon') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Email Verification Banner */}
      {user && !user.emailVerified && (
        <aside
          aria-label="Account Notice"
          className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <span className="font-bold">⚠️ Notice:</span>
            <span>
              Please check your email (<strong>{user.email}</strong>) to verify your account.
            </span>
          </div>
        </aside>
      )}

      {/* Main Top Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
                N
              </span>
              <span className="font-bold text-lg tracking-tight text-slate-900 hidden sm:inline">
                NutriKids
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-600 hidden sm:inline font-medium">
              {user?.email}
            </span>
            <button
              onClick={() => logout()}
              className="text-xs font-semibold text-slate-600 hover:text-red-600 px-2.5 py-1.5 rounded border border-slate-200 hover:border-red-200 hover:bg-red-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* App Content Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 mb-16">{children}</main>
    </div>
  );
}
