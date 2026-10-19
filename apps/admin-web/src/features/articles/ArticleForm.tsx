'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArticleKind, ArticleStatus } from '@/lib/api/models';
import { CreateArticleInput } from './useAdminArticles';
import { MarkdownPreview } from './MarkdownPreview';

const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const articleSchema = z.object({
  kind: z.enum(['ARTICLE', 'TIP', 'PAGE']),
  title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug cannot exceed 100 characters')
    .regex(slugRegex, 'Slug must be lower-kebab-case (e.g. solid-foods-guide)'),
  summary: z.string().min(1, 'Summary is required').max(500, 'Summary cannot exceed 500 characters'),
  body: z.string().min(1, 'Article body is required'),
  category: z.string().min(1, 'Category is required').max(60, 'Category cannot exceed 60 characters'),
  ageMinMonths: z.number().min(0).max(240).optional(),
  ageMaxMonths: z.number().min(0).max(240).optional(),
  coverUrl: z.string().optional(),
});

type ArticleFormFields = z.infer<typeof articleSchema>;

export type ArticleFormProps = {
  initial?: Partial<CreateArticleInput>;
  onSubmit: (data: CreateArticleInput) => Promise<void> | void;
  onCancel?: () => void;
  apiError?: string | null;
  loading?: boolean;
};

export function ArticleForm({
  initial,
  onSubmit,
  onCancel,
  apiError,
  loading = false,
}: ArticleFormProps) {
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(initial?.slug));
  const [submitStatus, setSubmitStatus] = useState<ArticleStatus>(initial?.status ?? 'DRAFT');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ArticleFormFields>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      kind: initial?.kind ?? 'ARTICLE',
      title: initial?.title ?? '',
      slug: initial?.slug ?? '',
      summary: initial?.summary ?? '',
      body: initial?.body ?? '',
      category: initial?.category ?? '',
      ageMinMonths: initial?.ageMinMonths ?? undefined,
      ageMaxMonths: initial?.ageMaxMonths ?? undefined,
      coverUrl: initial?.coverUrl ?? '',
    },
  });

  const bodyWatch = watch('body') || '';
  const titleWatch = watch('title') || '';
  const coverUrlWatch = watch('coverUrl') || '';

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setValue('title', newTitle, { shouldValidate: true });
    if (!slugManuallyEdited) {
      const generatedSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setValue('slug', generatedSlug, { shouldValidate: true });
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true);
    setValue('slug', e.target.value, { shouldValidate: true });
  };

  const handleFormSubmit = async (values: ArticleFormFields, status: ArticleStatus) => {
    const payload: CreateArticleInput = {
      kind: values.kind as ArticleKind,
      title: values.title.trim(),
      slug: values.slug.trim(),
      summary: values.summary.trim(),
      body: values.body.trim(),
      category: values.category.trim(),
      ageMinMonths: values.ageMinMonths ?? null,
      ageMaxMonths: values.ageMaxMonths ?? null,
      coverUrl: values.coverUrl?.trim() ? values.coverUrl.trim() : null,
      status,
    };
    await onSubmit(payload);
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      {apiError && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800"
        >
          {apiError}
        </div>
      )}

      {/* Two-Column Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Form Fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="article-kind" className="block text-xs font-semibold text-slate-700 mb-1">
                Content Kind *
              </label>
              <select
                id="article-kind"
                {...register('kind')}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
              >
                <option value="ARTICLE">Article (Guides & Medical)</option>
                <option value="TIP">Quick Tip (Bite-sized advice)</option>
                <option value="PAGE">Static Page (Policy & Terms)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="article-category" className="block text-xs font-semibold text-slate-700 mb-1">
                Category *
              </label>
              <input
                id="article-category"
                type="text"
                placeholder="e.g. Infant Nutrition, Sleep, Allergy"
                {...register('category')}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
              {errors.category && (
                <p className="text-xs text-red-600 mt-1">{errors.category.message}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="article-title" className="block text-xs font-semibold text-slate-700 mb-1">
              Title *
            </label>
            <input
              id="article-title"
              type="text"
              placeholder="e.g. Essential Iron Foods for Infants"
              value={titleWatch}
              onChange={handleTitleChange}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.title && (
              <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="article-slug" className="block text-xs font-semibold text-slate-700 mb-1">
              Slug *
            </label>
            <div className="flex items-center">
              <span className="text-xs text-slate-400 bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg h-10 px-2.5 flex items-center select-none font-mono">
                /learn/
              </span>
              <input
                id="article-slug"
                type="text"
                placeholder="essential-iron-foods"
                {...register('slug')}
                onChange={handleSlugChange}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-r-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            {errors.slug && (
              <p className="text-xs text-red-600 mt-1">{errors.slug.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="article-summary" className="block text-xs font-semibold text-slate-700 mb-1">
              Summary *
            </label>
            <textarea
              id="article-summary"
              rows={2}
              placeholder="Brief 1-2 sentence overview shown in lists and search..."
              {...register('summary')}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.summary && (
              <p className="text-xs text-red-600 mt-1">{errors.summary.message}</p>
            )}
          </div>

          {/* Age Guidelines & Cover Image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="article-min-age" className="block text-xs font-semibold text-slate-700 mb-1">
                Min Age (Months)
              </label>
              <input
                id="article-min-age"
                type="number"
                placeholder="Optional"
                {...register('ageMinMonths', {
                  setValueAs: (v) => (v === '' || v === null || isNaN(Number(v)) ? undefined : Number(v)),
                })}
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label htmlFor="article-max-age" className="block text-xs font-semibold text-slate-700 mb-1">
                Max Age (Months)
              </label>
              <input
                id="article-max-age"
                type="number"
                placeholder="Optional"
                {...register('ageMaxMonths', {
                  setValueAs: (v) => (v === '' || v === null || isNaN(Number(v)) ? undefined : Number(v)),
                })}
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="article-cover" className="block text-xs font-semibold text-slate-700 mb-1">
                Cover Image URL (HTTPS)
              </label>
              <input
                id="article-cover"
                type="url"
                placeholder="https://images.unsplash.com/..."
                {...register('coverUrl')}
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="article-body" className="block text-xs font-semibold text-slate-700 mb-1">
              Article Markdown Body *
            </label>
            <textarea
              id="article-body"
              rows={14}
              placeholder="Write content using Markdown: ## Headings, lists, bold text, links..."
              {...register('body')}
              className="w-full p-3 font-mono text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 leading-relaxed"
            />
            {errors.body && (
              <p className="text-xs text-red-600 mt-1">{errors.body.message}</p>
            )}
          </div>
        </div>

        {/* Right Column: Sticky Live Markdown Preview */}
        <div className="lg:sticky lg:top-6 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Live Preview
            </span>
            <span className="text-[11px] text-slate-400">Sanitized HTML output</span>
          </div>

          {coverUrlWatch && coverUrlWatch.startsWith('https://') && (
            <div className="h-40 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 relative">
              <img
                src={coverUrlWatch}
                alt="Article cover preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}

          <div className="p-5 bg-white border border-slate-200 rounded-xl min-h-[400px] max-h-[70vh] overflow-y-auto">
            {titleWatch && (
              <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-4">
                {titleWatch}
              </h1>
            )}
            <MarkdownPreview markdown={bodyWatch} />
          </div>
        </div>
      </div>

      {/* Action Footer Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting || loading}
            className="flat-button-secondary text-xs px-4 py-2"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit((v) => handleFormSubmit(v, 'DRAFT'))}
          disabled={isSubmitting || loading}
          className="flat-button-secondary text-xs px-5 py-2.5 font-semibold"
        >
          {isSubmitting || loading ? 'Saving...' : 'Save as Draft'}
        </button>
        <button
          type="button"
          onClick={handleSubmit((v) => handleFormSubmit(v, 'PUBLISHED'))}
          disabled={isSubmitting || loading}
          className="flat-button-primary text-xs px-5 py-2.5 font-semibold"
        >
          {isSubmitting || loading ? 'Publishing...' : 'Publish Now'}
        </button>
      </div>
    </form>
  );
}
