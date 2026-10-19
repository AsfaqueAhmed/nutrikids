'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useArticle } from '@/features/learn/useArticles';
import { Markdown } from '@/features/learn/Markdown';
import { formatAgeRange } from '@/features/learn/ArticleCard';

export default function ArticleDetailPage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  const { data: article, isLoading, isError } = useArticle(slug);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading article...</p>
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="p-8 bg-white border border-slate-200 rounded-xl space-y-3">
          <h1 className="text-lg font-bold text-slate-900">
            This article is not available.
          </h1>
          <p className="text-sm text-slate-500">
            The article you are looking for might have been moved or unpublished.
          </p>
          <div className="pt-2">
            <Link
              href="/learn"
              className="flat-button-primary inline-flex items-center text-xs"
            >
              Back to Learn
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ageLabel = formatAgeRange(article.ageMinMonths, article.ageMaxMonths);
  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <article className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Back Link */}
      <div>
        <Link
          href="/learn"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
        >
          ← Back to Learn
        </Link>
      </div>

      {/* Header Info */}
      <header className="space-y-3 border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {article.category}
          </span>
          {ageLabel && (
            <span className="rounded bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {ageLabel}
            </span>
          )}
          {article.readingTimeMinutes && (
            <span className="text-xs text-slate-400">
              {article.readingTimeMinutes} min read
            </span>
          )}
          {formattedDate && (
            <span className="text-xs text-slate-400">
              • {formattedDate}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          {article.title}
        </h1>

        {article.summary && (
          <p className="text-base text-slate-600 leading-relaxed font-medium">
            {article.summary}
          </p>
        )}
      </header>

      {/* Optional Cover Image */}
      {article.coverUrl && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-video">
          <img
            src={article.coverUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Markdown Content */}
      <div className="pt-2">
        <Markdown source={article.body} />
      </div>
    </article>
  );
}
