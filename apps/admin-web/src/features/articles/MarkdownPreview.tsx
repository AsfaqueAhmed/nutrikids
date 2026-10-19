'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export type MarkdownPreviewProps = {
  markdown: string;
  className?: string;
};

export function MarkdownPreview({ markdown, className = '' }: MarkdownPreviewProps) {
  if (!markdown.trim()) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-lg">
        Markdown preview will render here as you type...
      </div>
    );
  }

  return (
    <div
      className={`prose prose-slate prose-sm max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-emerald-700 prose-emerald ${className}`}
    >
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
