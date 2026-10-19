'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AdminVaccine } from '@/lib/api/models';
import { UpdateVaccineInput } from './useAdminVaccines';

const vaccineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  disease: z.string().min(1, 'Disease is required'),
  description: z.string().min(1, 'Description is required'),
  availability: z.enum(['GOVERNMENT_FREE', 'PRIVATE_PAID', 'BOTH']),
  isMandatory: z.boolean(),
  priceMinBdt: z.number().min(0).optional(),
  priceMaxBdt: z.number().min(0).optional(),
  priceNote: z.string().optional(),
  sourceNote: z.string().min(1, 'Source note is required'),
});

type VaccineFormFields = z.infer<typeof vaccineSchema>;

export type VaccineFormProps = {
  vaccine: AdminVaccine;
  onSubmit: (data: UpdateVaccineInput) => Promise<void> | void;
  apiError?: string | null;
  loading?: boolean;
};

export function VaccineForm({
  vaccine,
  onSubmit,
  apiError,
  loading = false,
}: VaccineFormProps) {
  const [verified, setVerified] = useState(vaccine.verified);
  const [confirmVerifyOpen, setConfirmVerifyOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VaccineFormFields>({
    resolver: zodResolver(vaccineSchema),
    defaultValues: {
      name: vaccine.name,
      disease: vaccine.disease,
      description: vaccine.description,
      availability: vaccine.availability,
      isMandatory: vaccine.isMandatory,
      priceMinBdt: vaccine.priceMinBdt ?? undefined,
      priceMaxBdt: vaccine.priceMaxBdt ?? undefined,
      priceNote: vaccine.priceNote ?? '',
      sourceNote: vaccine.sourceNote,
    },
  });

  const handleVerifiedToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      setConfirmVerifyOpen(true);
    } else {
      setVerified(false);
    }
  };

  const handleConfirmVerify = () => {
    setVerified(true);
    setConfirmVerifyOpen(false);
  };

  const handleFormSubmit = async (values: VaccineFormFields) => {
    const payload: UpdateVaccineInput = {
      name: values.name.trim(),
      disease: values.disease.trim(),
      description: values.description.trim(),
      availability: values.availability,
      isMandatory: values.isMandatory,
      priceMinBdt: values.priceMinBdt ?? null,
      priceMaxBdt: values.priceMaxBdt ?? null,
      priceNote: values.priceNote?.trim() ? values.priceNote.trim() : null,
      sourceNote: values.sourceNote.trim(),
      verified,
    };
    await onSubmit(payload);
  };

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {apiError && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800"
          >
            {apiError}
          </div>
        )}

        {/* Code & Verified Status Header */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Vaccine Code
            </span>
            <div className="text-base font-bold text-slate-900">{vaccine.code}</div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={verified}
              onChange={handleVerifiedToggle}
              className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
            <span className="text-xs font-semibold text-slate-700">
              Verified by Medical Advisor
            </span>
          </label>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="vac-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Vaccine Name *
            </label>
            <input
              id="vac-name"
              type="text"
              {...register('name')}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="vac-disease" className="block text-xs font-semibold text-slate-700 mb-1">
              Target Disease *
            </label>
            <input
              id="vac-disease"
              type="text"
              {...register('disease')}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.disease && (
              <p className="text-xs text-red-600 mt-1">{errors.disease.message}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="vac-desc" className="block text-xs font-semibold text-slate-700 mb-1">
              Description *
            </label>
            <textarea
              id="vac-desc"
              rows={3}
              {...register('description')}
              className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="vac-availability" className="block text-xs font-semibold text-slate-700 mb-1">
              Availability *
            </label>
            <select
              id="vac-availability"
              {...register('availability')}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
            >
              <option value="GOVERNMENT_FREE">Government Free (EPI)</option>
              <option value="PRIVATE_PAID">Private Paid Only</option>
              <option value="BOTH">Both Government & Private</option>
            </select>
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('isMandatory')}
                className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <span className="text-xs font-semibold text-slate-700">
                Mandatory National Schedule
              </span>
            </label>
          </div>
        </div>

        {/* Pricing (BDT) */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Private Market Price Range (BDT)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="vac-price-min" className="block text-xs font-medium text-slate-600 mb-1">
                Min Price (BDT)
              </label>
              <input
                id="vac-price-min"
                type="number"
                {...register('priceMinBdt', {
                  setValueAs: (v) => (v === '' || v === null || isNaN(Number(v)) ? undefined : Number(v)),
                })}
                placeholder="e.g. 300"
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label htmlFor="vac-price-max" className="block text-xs font-medium text-slate-600 mb-1">
                Max Price (BDT)
              </label>
              <input
                id="vac-price-max"
                type="number"
                {...register('priceMaxBdt', {
                  setValueAs: (v) => (v === '' || v === null || isNaN(Number(v)) ? undefined : Number(v)),
                })}
                placeholder="e.g. 500"
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="vac-price-note" className="block text-xs font-medium text-slate-600 mb-1">
                Price Note
              </label>
              <input
                id="vac-price-note"
                type="text"
                {...register('priceNote')}
                placeholder="e.g. Price varies by brand (GlaxoSmithKline vs Sanofi)"
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {vaccine.priceUpdatedAt && (
            <p className="text-[11px] text-slate-400">
              Price last updated:{' '}
              {new Date(vaccine.priceUpdatedAt).toLocaleDateString(undefined, {
                dateStyle: 'medium',
              })}
            </p>
          )}
        </div>

        {/* Source Note */}
        <div>
          <label htmlFor="vac-source" className="block text-xs font-semibold text-slate-700 mb-1">
            Source & Guidelines Reference *
          </label>
          <input
            id="vac-source"
            type="text"
            {...register('sourceNote')}
            placeholder="e.g. Bangladesh EPI Guidelines 2024"
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
          />
          {errors.sourceNote && (
            <p className="text-xs text-red-600 mt-1">{errors.sourceNote.message}</p>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="flat-button-primary text-xs px-5 py-2.5"
          >
            {isSubmitting || loading ? 'Saving...' : 'Save Vaccine Details'}
          </button>
        </div>
      </form>

      {/* Verify Confirmation Modal */}
      <ConfirmDialog
        open={confirmVerifyOpen}
        title="Verify Vaccine"
        description="Mark as verified by the medical advisor?"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={handleConfirmVerify}
        onCancel={() => setConfirmVerifyOpen(false)}
      />
    </>
  );
}
