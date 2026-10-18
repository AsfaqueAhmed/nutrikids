'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useActiveChild } from './useActiveChild';

export function ChildSwitcher() {
  const { children, activeChild, setActiveChildId } = useActiveChild();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!children.length) {
    return (
      <Link
        href="/children/new"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold border border-emerald-700 transition-colors"
      >
        <span>+ Add Child</span>
      </Link>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-semibold text-slate-800 transition-colors min-h-[36px]"
        aria-expanded={open}
        aria-label="Switch child"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="max-w-[120px] truncate">{activeChild?.name || 'Select Child'}</span>
        <span className="text-slate-400 text-[10px]">▼</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-none z-50 py-1 divide-y divide-slate-100">
          <div className="py-1">
            <p className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Children
            </p>
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => {
                  setActiveChildId(child.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                  activeChild?.id === child.id ? 'font-bold text-emerald-800 bg-emerald-50' : 'text-slate-700'
                }`}
              >
                <span className="truncate">{child.name}</span>
                {activeChild?.id === child.id && <span className="text-emerald-600 font-bold">✓</span>}
              </button>
            ))}
          </div>
          <div className="p-1">
            <Link
              href="/children/new"
              onClick={() => setOpen(false)}
              className="w-full block px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded transition-colors text-center"
            >
              + Add another child
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
