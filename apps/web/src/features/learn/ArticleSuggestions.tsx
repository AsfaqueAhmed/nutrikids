'use client';

import React from 'react';
import Link from 'next/link';
import { useActiveChild } from '@/features/children/useActiveChild';
import { useArticles } from './useArticles';
import { ArticleCard } from './ArticleCard';

export function ArticleSuggestions() {
  const { activeChild } = useActiveChild();
  const { data, isError, isLoading } = useArticles({
    ageMonths: activeChild?.ageMonths,
    limit: 3,
  });

  if (isLoading || isError || !data?.items?.length) {
    return null;
  }

  const childName = activeChild?.name ? activeChild.name : 'your child';

  return (
    <section className="mt-6 mb-8" aria-label={`Reading for ${childName}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-stone-900">
          Reading for {childName}
        </h2>
        <Link
          href="/learn"
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
        >
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {data.items.map((art) => (
          <ArticleCard key={art.id} article={art} />
        ))}
      </div>
    </section>
  );
}
