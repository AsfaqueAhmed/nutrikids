'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  useAdminArticle,
  useArticleMutations,
  CreateArticleInput,
} from '@/features/articles/useAdminArticles';
import { ArticleForm } from '@/features/articles/ArticleForm';

export default function EditArticlePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { data: article, isLoading, isError, refetch } = useAdminArticle(id ?? '');
  const { updateArticle, isUpdating } = useArticleMutations();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (data: CreateArticleInput) => {
    if (!id) return;
    setErrorMsg(null);
    try {
      await updateArticle(id, data);
      router.push('/articles');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update article.');
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Loading article details...
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl space-y-3">
        <p className="text-sm font-semibold text-red-800">
          Article not found or failed to load.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/articles" className="flat-button-secondary text-xs px-4 py-2">
            Back to Articles
          </Link>
          <button
            type="button"
            onClick={() => refetch()}
            className="flat-button-primary text-xs px-4 py-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Edit Article: {article.title}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Update content, category, age targets, or publishing status.
        </p>
      </div>

      <ArticleForm
        initial={{
          kind: article.kind,
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          body: article.body,
          category: article.category,
          ageMinMonths: article.ageMinMonths ?? undefined,
          ageMaxMonths: article.ageMaxMonths ?? undefined,
          coverUrl: article.coverUrl ?? '',
          status: article.status,
        }}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/articles')}
        apiError={errorMsg}
        loading={isUpdating}
      />
    </div>
  );
}
