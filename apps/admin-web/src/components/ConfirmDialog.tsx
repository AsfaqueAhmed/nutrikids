'use client';

import React from 'react';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 space-y-4 shadow-xl">
        <div className="space-y-1">
          <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900">
            {title}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flat-button-secondary text-xs px-4 py-2 min-h-[38px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`${
              destructive ? 'flat-button-danger' : 'flat-button-primary'
            } text-xs px-4 py-2 min-h-[38px]`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
