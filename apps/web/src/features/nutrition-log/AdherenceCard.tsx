'use client';

import React, { useState } from 'react';
import { useNutritionSummary } from './useNutritionLogs';
import { rangeEndingToday } from '@/lib/dates';

export type AdherenceCardProps = {
  childId: string;
  defaultDays?: 7 | 30;
  className?: string;
};

export function AdherenceCard({
  childId,
  defaultDays = 7,
  className = '',
}: AdherenceCardProps) {
  const [days, setDays] = useState<7 | 30>(defaultDays);
  const { from, to } = rangeEndingToday(days);

  const { data: summary, isLoading } = useNutritionSummary(childId, from, to);

  const fullCount = summary?.fullCount ?? 0;
  const partialCount = summary?.partialCount ?? 0;
  const skippedCount = summary?.skippedCount ?? 0;
  const loggedCount = summary?.loggedCount ?? 0;
  const plannedCount = summary?.plannedCount ?? 0;

  const fullPct = loggedCount > 0 ? (fullCount / loggedCount) * 100 : 0;
  const partPct = loggedCount > 0 ? (partialCount / loggedCount) * 100 : 0;
  const skipPct = loggedCount > 0 ? (skippedCount / loggedCount) * 100 : 0;

  return (
    <div className={`p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-4 ${className}`}>
      {/* Header with Title and Range Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Meal Adherence</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            The score is based on the meal plan. This card shows what was actually eaten.
          </p>
        </div>

        {/* 7 / 30 day range toggle */}
        <div
          role="tablist"
          aria-label="Adherence timeframe"
          className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={days === 7}
            onClick={() => setDays(7)}
            className={`min-h-11 px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
              days === 7
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={days === 30}
            onClick={() => setDays(30)}
            className={`min-h-11 px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
              days === 30
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading adherence summary...</div>
      ) : loggedCount === 0 ? (
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center">
          <p className="text-sm font-medium text-slate-600">
            No meals logged yet. Tap a meal on Today to start.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Stat Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Planned vs Logged</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                Logged {loggedCount} of {plannedCount} planned meals
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 font-medium block">Portion Eaten</span>
              <span className="text-sm font-bold text-emerald-700 mt-0.5 block">
                Ate about {summary?.eatenPercent ?? 0}% of what was logged
              </span>
            </div>
          </div>

          {/* Stacked Adherence Bar with Accessible ARIA Labels */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Intake breakdown</span>
              <span>{loggedCount} meals logged</span>
            </div>
            <div
              data-testid="stacked-adherence-bar"
              className="h-4 w-full rounded-full bg-slate-100 border border-slate-200 flex overflow-hidden"
            >
              {fullCount > 0 && (
                <div
                  role="img"
                  aria-label={`${fullCount} full`}
                  style={{ width: `${fullPct}%` }}
                  className="bg-emerald-600 h-full transition-all"
                  title={`${fullCount} full`}
                />
              )}
              {partialCount > 0 && (
                <div
                  role="img"
                  aria-label={`${partialCount} partly`}
                  style={{ width: `${partPct}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`${partialCount} partly`}
                />
              )}
              {skippedCount > 0 && (
                <div
                  role="img"
                  aria-label={`${skippedCount} skipped`}
                  style={{ width: `${skipPct}%` }}
                  className="bg-slate-500 h-full transition-all"
                  title={`${skippedCount} skipped`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-slate-600 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span>Full ({fullCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Partly ({partialCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span>Skipped ({skippedCount})</span>
              </div>
            </div>
          </div>

          {/* Slot Breakdown Rows */}
          {summary?.perSlot && summary.perSlot.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Meals Breakdown
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {summary.perSlot.map((slotItem) => (
                  <div
                    key={slotItem.slot}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-slate-800">{slotItem.slot}</span>
                    <span className="text-slate-600 font-medium">
                      Full: {slotItem.full}, Part: {slotItem.partial}, Skipped: {slotItem.skipped}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
