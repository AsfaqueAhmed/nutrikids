'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useArticles } from '@/features/learn/useArticles';
import { ArticleCard } from '@/features/learn/ArticleCard';
import { useActiveChild } from '@/features/children/useActiveChild';
import { ArticleKind } from '@/lib/api/models';

export default function LearnPage() {
  const { activeChild } = useActiveChild();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<ArticleKind | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [ageFiltered, setAgeFiltered] = useState(false);
  const [limit, setLimit] = useState(12);

  // 300ms debounce for search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filters = useMemo(() => {
    return {
      kind: selectedKind === 'ALL' ? undefined : selectedKind,
      category: selectedCategory ?? undefined,
      ageMonths: ageFiltered && activeChild?.ageMonths ? activeChild.ageMonths : undefined,
      q: debouncedQuery || undefined,
      limit,
    };
  }, [selectedKind, selectedCategory, ageFiltered, activeChild, debouncedQuery, limit]);

  const { data, isLoading, isError, refetch } = useArticles(filters);

  // Extract unique categories from current items
  const categories = useMemo(() => {
    if (!data?.items) return [];
    const set = new Set<string>();
    for (const item of data.items) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set);
  }, [data?.items]);

  const childName = activeChild?.name ? activeChild.name : 'child';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Knowledge & Tips
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Pediatric nutrition guides, feeding advice, and healthy habits verified by specialists.
        </p>
      </div>

      {/* Search & Kind Tabs */}
      <div className="space-y-4">
        <div className="relative">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search articles, guides, and tips..."
            className="w-full h-11 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Kind Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Article type" className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            {(['ALL', 'ARTICLE', 'TIP'] as const).map((kind) => {
              const label = kind === 'ALL' ? 'All' : kind === 'ARTICLE' ? 'Articles' : 'Tips';
              const active = selectedKind === kind;
              return (
                <button
                  key={kind}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedKind(kind);
                    setSelectedCategory(null);
                  }}
                  className={`min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Age filter toggle */}
          {activeChild && (
            <button
              type="button"
              onClick={() => setAgeFiltered((prev) => !prev)}
              className={`min-h-[36px] inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                ageFiltered
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{ageFiltered ? '✓' : '○'}</span>
              <span>For {childName}&apos;s age ({activeChild.ageMonths}m)</span>
            </button>
          )}
        </div>

        {/* Category Chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                selectedCategory === null
                  ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Listing State */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading resources...</p>
        </div>
      ) : isError ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
          <p className="text-sm font-medium text-red-800">
            Failed to load articles. Please check your connection and try again.
          </p>
          <button
            onClick={() => refetch()}
            className="flat-button-secondary text-xs"
          >
            Retry
          </button>
        </div>
      ) : !data?.items || data.items.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl space-y-2">
          <p className="text-base font-semibold text-slate-800">Nothing here yet.</p>
          <p className="text-xs text-slate-500">
            Try adjusting your search keywords or switching filters.
          </p>
          {(searchTerm || selectedCategory || ageFiltered || selectedKind !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory(null);
                setAgeFiltered(false);
                setSelectedKind('ALL');
              }}
              className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
            >
              Reset all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {/* Load More Pagination */}
          {data.total > data.items.length && (
            <div className="pt-4 text-center">
              <button
                onClick={() => setLimit((prev) => prev + 12)}
                className="flat-button-secondary text-xs px-6 py-2"
              >
                Load more articles ({data.items.length} of {data.total})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
