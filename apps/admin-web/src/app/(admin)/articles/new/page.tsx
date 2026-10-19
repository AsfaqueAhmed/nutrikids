'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useArticleMutations, CreateArticleInput } from '@/features/articles/useAdminArticles';
import { ArticleForm } from '@/features/articles/ArticleForm';

export default function NewArticlePage() {
  const router = useRouter();
  const { createArticle, isCreating } = useArticleMutations();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (data: CreateArticleInput) => {
    setErrorMsg(null);
    try {
      await createArticle(data);
      router.push('/articles');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create article.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <Link
          href="/articles"
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
        >
          &larr; Back to Articles
        </Link>
      </div>

      <div className="border-b border-slate-200 pb-3">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Article</h1>
        <p className="text-xs text-slate-500 mt-1">
          Draft educational content with real-time Markdown preview.
        </p>
      </div>

      <ArticleForm
        onSubmit={handleSubmit}
        onCancel={() => router.push('/articles')}
        apiError={errorMsg}
        loading={isCreating}
      />
    </div>
  );
}
