'use client';

import React, { useState } from 'react';
import { Check, CircleDashed, X } from 'lucide-react';
import { useLogMeal } from './useNutritionLogs';
import { PartialPercentDialog } from './PartialPercentDialog';
import type { EatenStatus, MealSlot, NutritionLog } from '@/lib/api/models';

export type QuickLogProps = {
  childId: string;
  date: string;
  slot: MealSlot;
  existing?: NutritionLog | null;
  className?: string;
};

export function QuickLog({
  childId,
  date,
  slot,
  existing,
  className = '',
}: QuickLogProps) {
  const { log, clear } = useLogMeal(childId);
  const [partialDialogOpen, setPartialDialogOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const currentStatus = existing?.eatenStatus;

  const handleAction = async (targetStatus: EatenStatus) => {
    // If clicking already active status, toggle clear prompt
    if (currentStatus === targetStatus) {
      setShowClearConfirm(true);
      return;
    }

    setShowClearConfirm(false);

    if (targetStatus === 'PARTIAL') {
      setPartialDialogOpen(true);
      return;
    }

    try {
      const res = await log({
        id: existing?.id,
        date,
        slot,
        eatenStatus: targetStatus,
      });

      if (res.queued) {
        setStatusNotice('Saved offline');
      } else if (res.superseded) {
        setStatusNotice('Your change was replaced by a newer one.');
      } else {
        setStatusNotice(null);
      }
    } catch (err: unknown) {
      setStatusNotice(err instanceof Error ? err.message : 'Failed to save log');
    }
  };

  const handleConfirmPartial = async (percent: number) => {
    setPartialDialogOpen(false);
    try {
      const res = await log({
        id: existing?.id,
        date,
        slot,
        eatenStatus: 'PARTIAL',
        percent,
      });

      if (res.queued) {
        setStatusNotice('Saved offline');
      } else if (res.superseded) {
        setStatusNotice('Your change was replaced by a newer one.');
      } else {
        setStatusNotice(null);
      }
    } catch (err: unknown) {
      setStatusNotice(err instanceof Error ? err.message : 'Failed to save portion');
    }
  };

  const handleClear = async () => {
    if (!existing) return;
    setShowClearConfirm(false);
    try {
      await clear(existing.id);
      setStatusNotice(null);
    } catch (err: unknown) {
      setStatusNotice(err instanceof Error ? err.message : 'Failed to clear');
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        role="group"
        aria-label="How much did they eat?"
        className="flex items-center gap-2"
      >
        {/* Ate all Button */}
        <button
          type="button"
          onClick={() => handleAction('FULL')}
          aria-pressed={currentStatus === 'FULL'}
          className={`flex-1 min-h-11 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
            currentStatus === 'FULL'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          {currentStatus === 'FULL' && (
            <Check data-testid="check-icon" className="w-4 h-4 stroke-[2.5]" />
          )}
          <span>Ate all</span>
        </button>

        {/* Ate some Button */}
        <button
          type="button"
          onClick={() => handleAction('PARTIAL')}
          aria-pressed={currentStatus === 'PARTIAL'}
          className={`flex-1 min-h-11 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
            currentStatus === 'PARTIAL'
              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <CircleDashed className="w-4 h-4 stroke-[2]" />
          <span>
            {currentStatus === 'PARTIAL' && existing?.percent
              ? `Ate ${existing.percent}%`
              : 'Ate some'}
          </span>
        </button>

        {/* Skipped Button */}
        <button
          type="button"
          onClick={() => handleAction('SKIPPED')}
          aria-pressed={currentStatus === 'SKIPPED'}
          className={`flex-1 min-h-11 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
            currentStatus === 'SKIPPED'
              ? 'bg-slate-600 text-white border-slate-600 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <X className="w-4 h-4 stroke-[2]" />
          <span>Skipped</span>
        </button>
      </div>

      {/* Clear Entry Prompt */}
      {showClearConfirm && (
        <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs animate-fade-in">
          <span className="text-slate-600">Want to clear this entry?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="text-slate-500 hover:text-slate-700 font-semibold px-2 py-1"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-red-600 hover:text-red-700 font-semibold px-2 py-1 bg-white border border-red-200 rounded"
            >
              Clear entry
            </button>
          </div>
        </div>
      )}

      {/* Polite Accessibility Status Region */}
      {statusNotice && (
        <div
          role="status"
          aria-live="polite"
          className="text-xs font-medium text-slate-600 px-1 pt-0.5"
        >
          {statusNotice}
        </div>
      )}

      {/* Partial Percentage Dialog */}
      <PartialPercentDialog
        open={partialDialogOpen}
        initialPercent={existing?.percent ?? 50}
        onConfirm={handleConfirmPartial}
        onCancel={() => setPartialDialogOpen(false)}
      />
    </div>
  );
}
