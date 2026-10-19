'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UpdateScheduleItemInput } from './useAdminVaccines';

const scheduleItemSchema = z
  .object({
    suggestedAgeDays: z.number().min(0, 'Suggested age must be non-negative'),
    minAgeDays: z.number().min(0, 'Min age must be non-negative'),
    maxAgeDays: z.number().min(0).optional(),
    intervalFromPreviousDays: z.number().min(0).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.minAgeDays <= data.suggestedAgeDays, {
    message: 'Minimum age cannot be greater than suggested age',
    path: ['minAgeDays'],
  });

type ScheduleItemFormFields = z.infer<typeof scheduleItemSchema>;

export type ScheduleItem = {
  id: string;
  doseNumber: number;
  suggestedAgeDays: number;
  minAgeDays: number;
  maxAgeDays: number | null;
  intervalFromPreviousDays: number | null;
  notes: string | null;
};

export type ScheduleItemFormProps = {
  item: ScheduleItem;
  onSubmit: (data: UpdateScheduleItemInput) => Promise<void> | void;
  apiError?: string | null;
  loading?: boolean;
};

export function ScheduleItemForm({
  item,
  onSubmit,
  apiError,
  loading = false,
}: ScheduleItemFormProps) {
  const [successMsg, setSuccessMsg] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleItemFormFields>({
    resolver: zodResolver(scheduleItemSchema),
    defaultValues: {
      suggestedAgeDays: item.suggestedAgeDays,
      minAgeDays: item.minAgeDays,
      maxAgeDays: item.maxAgeDays ?? undefined,
      intervalFromPreviousDays: item.intervalFromPreviousDays ?? undefined,
      notes: item.notes ?? '',
    },
  });

  const handleFormSubmit = async (values: ScheduleItemFormFields) => {
    setSuccessMsg(false);
    const payload: UpdateScheduleItemInput = {
      suggestedAgeDays: values.suggestedAgeDays,
      minAgeDays: values.minAgeDays,
      maxAgeDays: values.maxAgeDays ?? null,
      intervalFromPreviousDays: values.intervalFromPreviousDays ?? null,
      notes: values.notes?.trim() ? values.notes.trim() : null,
    };
    await onSubmit(payload);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 3000);
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="p-4 bg-white border border-slate-200 rounded-lg space-y-4"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 className="text-sm font-bold text-slate-900">Dose #{item.doseNumber}</h4>
        {successMsg && (
          <span className="text-xs font-semibold text-emerald-600 animate-fade-in">
            ✓ Dose #{item.doseNumber} updated
          </span>
        )}
      </div>

      {apiError && (
        <div
          role="alert"
          className="p-2.5 bg-red-50 border border-red-200 rounded text-xs font-semibold text-red-800"
        >
          {apiError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <label
            htmlFor={`item-${item.id}-suggested`}
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Suggested Age (Days) *
          </label>
          <input
            id={`item-${item.id}-suggested`}
            type="number"
            {...register('suggestedAgeDays', { valueAsNumber: true })}
            className="w-full h-9 px-3 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
          />
          {errors.suggestedAgeDays && (
            <p className="text-[11px] text-red-600 mt-1">{errors.suggestedAgeDays.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor={`item-${item.id}-min`}
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Min Age (Days) *
          </label>
          <input
            id={`item-${item.id}-min`}
            type="number"
            {...register('minAgeDays', { valueAsNumber: true })}
            className="w-full h-9 px-3 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
          />
          {errors.minAgeDays && (
            <p className="text-[11px] text-red-600 mt-1">{errors.minAgeDays.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor={`item-${item.id}-max`}
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Max Age (Days)
          </label>
          <input
            id={`item-${item.id}-max`}
            type="number"
            placeholder="None"
            {...register('maxAgeDays', {
              setValueAs: (v) => (v === '' || v === null || isNaN(Number(v)) ? undefined : Number(v)),
            })}
            className="w-full h-9 px-3 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div>
          <label
            htmlFor={`item-${item.id}-interval`}
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Interval from Prev (Days)
          </label>
          <input
            id={`item-${item.id}-interval`}
            type="number"
            placeholder="None"
            {...register('intervalFromPreviousDays', {
              setValueAs: (v) => (v === '' || v === null || isNaN(Number(v)) ? undefined : Number(v)),
            })}
            className="w-full h-9 px-3 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div className="sm:col-span-3">
          <label
            htmlFor={`item-${item.id}-notes`}
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Dose Notes
          </label>
          <input
            id={`item-${item.id}-notes`}
            type="text"
            placeholder="e.g. At birth or first contact"
            {...register('notes')}
            className="w-full h-9 px-3 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div className="sm:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full h-9 flat-button-primary text-xs"
          >
            {isSubmitting || loading ? 'Saving...' : `Save Dose ${item.doseNumber}`}
          </button>
        </div>
      </div>
    </form>
  );
}
