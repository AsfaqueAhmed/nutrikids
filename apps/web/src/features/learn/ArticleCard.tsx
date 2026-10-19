import React from 'react';
import Link from 'next/link';
import { ArticleSummary } from '@/lib/api/models';

export function formatAgeRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null) {
    return `${min}–${max} months`;
  }
  if (min != null) {
    return `From ${min} months`;
  }
  if (max != null) {
    return `Up to ${max} months`;
  }
  return null;
}

export function ArticleCard({ article }: { article: ArticleSummary }) {
  const ageLabel = formatAgeRange(article.ageMinMonths, article.ageMaxMonths);

  return (
    <Link
      href={`/learn/${article.slug}`}
      className="group block rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-emerald-500 hover:bg-stone-50"
    >
      {article.coverUrl && (
        <div className="mb-3 overflow-hidden rounded-lg bg-stone-100 aspect-video">
          <img
            src={article.coverUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {article.category}
        </span>
        {ageLabel && (
          <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
            {ageLabel}
          </span>
        )}
        {article.readingTimeMinutes && (
          <span className="text-xs text-stone-400">
            {article.readingTimeMinutes} min read
          </span>
        )}
      </div>
      <h3 className="font-semibold text-stone-900 group-hover:text-emerald-700 line-clamp-2">
        {article.title}
      </h3>
      <p className="mt-1 text-sm text-stone-600 line-clamp-2">
        {article.summary}
      </p>
    </Link>
  );
}
