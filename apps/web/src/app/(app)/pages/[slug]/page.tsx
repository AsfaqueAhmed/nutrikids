'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useArticle } from '@/features/learn/useArticles';
import { Markdown } from '@/features/learn/Markdown';

export default function StaticPage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : '';

  const { data: page, isLoading, isError } = useArticle(slug);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading page...</p>
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="p-8 bg-white border border-slate-200 rounded-xl space-y-3">
          <h1 className="text-lg font-bold text-slate-900">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-500">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="flat-button-primary inline-flex items-center text-xs"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const formattedDate = page.publishedAt
    ? new Date(page.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <main className="max-w-2xl mx-auto space-y-6 pb-16">
      <header className="border-b border-slate-200 pb-4 space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          {page.title}
        </h1>
        {formattedDate && (
          <p className="text-xs text-slate-400">
            Last updated: {formattedDate}
          </p>
        )}
      </header>

      {/* Render Markdown without cover */}
      <div className="pt-2">
        <Markdown source={page.body} />
      </div>
    </main>
  );
}
