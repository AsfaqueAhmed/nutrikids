'use client';

import React, { useState } from 'react';

export type PartialPercentDialogProps = {
  open: boolean;
  initialPercent?: number;
  onConfirm: (percent: number) => void;
  onCancel: () => void;
};

export function PartialPercentDialog({
  open,
  initialPercent = 50,
  onConfirm,
  onCancel,
}: PartialPercentDialogProps) {
  const [percent, setPercent] = useState<number>(initialPercent);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="partial-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 space-y-5 shadow-xl">
        <div>
          <h3 id="partial-dialog-title" className="text-base font-bold text-slate-900">
            How much was eaten?
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Choose the approximate portion your child consumed.
          </p>
        </div>

        {/* Radio choices 25% / 50% / 75% */}
        <div className="space-y-2">
          {[25, 50, 75].map((val) => (
            <label
              key={val}
              className={`flex items-center justify-between p-3 rounded-xl border text-sm font-semibold cursor-pointer transition-colors ${
                percent === val
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>About {val}%</span>
              <input
                type="radio"
                name="partial-percent"
                value={val}
                checked={percent === val}
                onChange={() => setPercent(val)}
                aria-label={`${val}%`}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flat-button-secondary text-xs px-4 py-2 min-h-11"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(percent)}
            className="flat-button-primary text-xs px-5 py-2.5 min-h-11 font-semibold"
          >
            Save Portion
          </button>
        </div>
      </div>
    </div>
  );
}
