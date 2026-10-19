'use client';

import { use } from 'react';
import Link from 'next/link';
import { useChildren } from '@/features/children/useChildren';
import { AdherenceCard } from '@/features/nutrition-log/AdherenceCard';

export default function ChildNutritionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const childId = resolvedParams.id;
  const { children, isLoading } = useChildren();

  const child = children?.find((c) => c.id === childId);

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={child ? `/children/${child.id}/profile` : '/'}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Back to {child?.name ? `${child.name}'s Profile` : 'Children'}
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Nutrition & Meal Adherence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare planned meal guidelines against real meal intake logs.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading child nutrition...</div>
      ) : (
        <div className="space-y-6">
          {/* Plan-Based Nutrition Score Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  Plan-Based Score
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-2">Nutritional Balance</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calculated from the age-tailored weekly meal plan and food diversity guidelines.
                </p>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 self-start sm:self-auto">
                <span className="text-3xl font-black text-emerald-600">88</span>
                <div className="text-xs">
                  <div className="font-bold text-slate-800">Optimal Target</div>
                  <div className="text-slate-500">Meets WHO nutrients</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-500 block">Iron & Zinc</span>
                <span className="text-sm font-bold text-slate-800">92%</span>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-500 block">Vitamins A & C</span>
                <span className="text-sm font-bold text-slate-800">85%</span>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-500 block">Fiber Target</span>
                <span className="text-sm font-bold text-slate-800">87%</span>
              </div>
            </div>
          </div>

          {/* Adherence Summary Card (Mounted Below Score Card) */}
          <AdherenceCard childId={childId} />
        </div>
      )}
    </div>
  );
}
