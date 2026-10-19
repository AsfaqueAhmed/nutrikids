'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActiveChild } from '@/features/children/useActiveChild';

export function BottomNav() {
  const pathname = usePathname();
  const { activeChildId } = useActiveChild();

  const childPrefix = activeChildId ? `/children/${activeChildId}` : '';

  const navItems = [
    {
      label: 'Today',
      href: '/',
      icon: '☀️',
      isActive: pathname === '/' || pathname === '',
    },
    {
      label: 'Meals',
      href: activeChildId ? `${childPrefix}/meals` : '/onboarding',
      icon: '🥗',
      isActive: pathname.includes('/meals') || pathname.includes('/grocery'),
    },
    {
      label: 'Learn',
      href: '/learn',
      icon: '📚',
      isActive: pathname.startsWith('/learn'),
    },
    {
      label: 'Health',
      href: activeChildId ? `${childPrefix}/vaccinations` : '/hospitals',
      icon: '🛡️',
      isActive: pathname.includes('/vaccinations') || pathname.includes('/hospitals') || pathname.includes('/feeding'),
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: '⚙️',
      isActive: pathname.includes('/settings') || pathname.includes('/profile'),
    },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex justify-around items-center h-16 max-w-lg mx-auto sm:max-w-2xl md:max-w-4xl"
    >
      {navItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] px-2 py-1 rounded-md transition-colors ${
            item.isActive
              ? 'text-emerald-700 font-bold bg-emerald-50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="text-lg leading-none" aria-hidden="true">
            {item.icon}
          </span>
          <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
