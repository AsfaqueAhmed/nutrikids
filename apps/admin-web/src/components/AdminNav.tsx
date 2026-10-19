'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const ADMIN_NAV_LINKS = [
  { label: 'Dashboard', href: '/', icon: '📊' },
  { label: 'Users', href: '/users', icon: '👥' },
  { label: 'Foods', href: '/foods', icon: '🥑' },
  { label: 'Recipes', href: '/recipes', icon: '🍲' },
  { label: 'Vaccines', href: '/vaccines', icon: '💉' },
  { label: 'Articles', href: '/articles', icon: '📝' },
  { label: 'Hospitals', href: '/hospitals', icon: '🏥' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin Navigation" className="flex items-center gap-1 overflow-x-auto py-2">
      {ADMIN_NAV_LINKS.map((item) => {
        const isActive =
          item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`min-h-[40px] inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
