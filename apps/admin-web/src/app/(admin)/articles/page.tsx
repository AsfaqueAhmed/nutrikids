'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useAdminArticles,
  useArticleMutations,
} from '@/features/articles/useAdminArticles';
import { DataTable, Column } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ArticleKind, ArticleStatus, ArticleSummary } from '@/lib/api/models';

export default function ArticlesPage() {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<ArticleStatus | 'ALL'>('ALL');
  const [selectedKind, setSelectedKind] = useState<ArticleKind | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [articleToDelete, setArticleToDelete] = useState<ArticleSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    data: articlePage,
    isLoading,
    isError,
    refetch,
  } = useAdminArticles({
    status: selectedStatus === 'ALL' ? undefined : selectedStatus,
    kind: selectedKind === 'ALL' ? undefined : selectedKind,
    page,
    limit: pageSize,
  });

  const { deleteArticle, isDeleting } = useArticleMutations();

  const filteredItems = useMemo(() => {
    if (!articlePage?.items) return [];
    if (!searchTerm.trim()) return articlePage.items;
    const q = searchTerm.toLowerCase();
    return articlePage.items.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [articlePage, searchTerm]);

  const handleDeleteConfirm = async () => {
    if (!articleToDelete) return;
    setDeleteError(null);
    try {
      await deleteArticle(articleToDelete.id);
      setArticleToDelete(null);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete article.'
      );
    }
  };

  const columns: Column<ArticleSummary>[] = useMemo(
    () => [
      {
        key: 'title',
        header: 'Title & Slug',
        render: (row) => (
          <div>
            <div className="font-semibold text-slate-900">{row.title}</div>
            <div className="text-xs text-slate-400 font-mono">/learn/{row.slug}</div>
          </div>
        ),
      },
      {
        key: 'kind',
        header: 'Kind',
        render: (row) => {
          const badgeColors: Record<ArticleKind, string> = {
            ARTICLE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            TIP: 'bg-amber-50 text-amber-800 border-amber-200',
            PAGE: 'bg-slate-100 text-slate-700 border-slate-200',
          };
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                badgeColors[row.kind]
              }`}
            >
              {row.kind}
            </span>
          );
        },
      },
      {
        key: 'category',
        header: 'Category',
        render: (row) => (
          <span className="text-xs text-slate-600 font-medium">{row.category}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) =>
          row.status === 'PUBLISHED' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              ● Published
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              ○ Draft
            </span>
          ),
      },
      {
        key: 'publishedAt',
        header: 'Published',
        render: (row) => (
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {row.publishedAt ? new Date(row.publishedAt).toLocaleDateString() : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => router.push(`/articles/${row.id}`)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded border border-slate-200 hover:border-emerald-300 bg-white"
            >
              Edit
            </button>
            <button
              onClick={() => {
                setDeleteError(null);
                setArticleToDelete(row);
              }}
              className="text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-1 rounded border border-transparent hover:border-red-200 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [router]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Articles & Education</h1>
          <p className="text-sm text-slate-500 mt-1">
            Author and publish parent education articles, quick tips, and informational static pages.
          </p>
        </div>
        <Link
          href="/articles/new"
          className="flat-button-primary text-xs px-4 py-2 self-start sm:self-auto inline-block"
        >
          + Create New Article
        </Link>
      </div>

      {deleteError && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800"
        >
          {deleteError}
        </div>
      )}

      {/* Filters Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-none flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1">
          <input
            type="search"
            placeholder="Search articles by title, slug, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="kind-filter" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Kind:
          </label>
          <select
            id="kind-filter"
            value={selectedKind}
            onChange={(e) => {
              setSelectedKind(e.target.value as ArticleKind | 'ALL');
              setPage(1);
            }}
            className="h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600"
          >
            <option value="ALL">All Kinds</option>
            <option value="ARTICLE">Article</option>
            <option value="TIP">Tip</option>
            <option value="PAGE">Page</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Status:
          </label>
          <select
            id="status-filter"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as ArticleStatus | 'ALL');
              setPage(1);
            }}
            className="h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      {isError ? (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-red-800">
            Failed to load articles.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="flat-button-secondary text-xs px-4 py-2"
          >
            Retry
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filteredItems}
          loading={isLoading}
          empty="No articles found matching your filters."
          page={page}
          limit={pageSize}
          total={articlePage?.total ?? 0}
          onPage={setPage}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(articleToDelete)}
        title="Delete Article"
        description={`Are you sure you want to delete "${articleToDelete?.title}"? This will remove the article and its URL permanently.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Article'}
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setArticleToDelete(null)}
      />
    </div>
  );
}
