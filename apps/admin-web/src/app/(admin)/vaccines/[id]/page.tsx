'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  useAdminVaccines,
  useUpdateVaccine,
  useUpdateScheduleItem,
  UpdateVaccineInput,
  UpdateScheduleItemInput,
} from '@/features/vaccines/useAdminVaccines';
import { VaccineForm } from '@/features/vaccines/VaccineForm';
import { ScheduleItemForm } from '@/features/vaccines/ScheduleItemForm';

export default function VaccineDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { data: vaccines = [], isLoading, isError, refetch } = useAdminVaccines();
  const vaccine = vaccines.find((v) => v.id === id);

  const { mutateAsync: updateVaccine, isPending: isUpdatingVaccine } = useUpdateVaccine();
  const { mutateAsync: updateScheduleItem, isPending: isUpdatingItem } = useUpdateScheduleItem();

  const [vaccineError, setVaccineError] = useState<string | null>(null);
  const [vaccineSuccess, setVaccineSuccess] = useState(false);

  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

  const handleSaveVaccine = async (data: UpdateVaccineInput) => {
    if (!vaccine) return;
    setVaccineError(null);
    setVaccineSuccess(false);
    try {
      await updateVaccine({ id: vaccine.id, data });
      setVaccineSuccess(true);
      setTimeout(() => setVaccineSuccess(false), 3000);
    } catch (err: unknown) {
      setVaccineError(err instanceof Error ? err.message : 'Failed to update vaccine.');
    }
  };

  const handleSaveItem = async (itemId: string, data: UpdateScheduleItemInput) => {
    setItemErrors((prev) => ({ ...prev, [itemId]: '' }));
    try {
      await updateScheduleItem({ id: itemId, data });
    } catch (err: unknown) {
      setItemErrors((prev) => ({
        ...prev,
        [itemId]: err instanceof Error ? err.message : 'Failed to update dose schedule.',
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Loading vaccine details...
      </div>
    );
  }

  if (isError || !vaccine) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl space-y-3">
        <p className="text-sm font-semibold text-red-800">
          Vaccine not found or failed to load.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/vaccines" className="flat-button-secondary text-xs px-4 py-2">
            Back to Vaccines
          </Link>
          <button
            type="button"
            onClick={() => refetch()}
            className="flat-button-primary text-xs px-4 py-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/vaccines"
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
        >
          &larr; Back to Vaccine Catalogue
        </Link>
      </div>

      {/* Advisory Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <span className="text-blue-600 font-bold text-base leading-none mt-0.5">ℹ</span>
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-blue-900">
            Important Note on Vaccine Schedules
          </p>
          <p className="text-xs text-blue-800 leading-relaxed">
            Changing the schedule does not change due dates already generated for existing children.
            Only newly generated schedules or manual recalculations will reflect updated age windows.
          </p>
        </div>
      </div>

      {/* Vaccine Details Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {vaccine.name} ({vaccine.code})
            </h2>
            <p className="text-xs text-slate-500">
              Edit vaccine metadata, target disease, pricing, and advisor verification.
            </p>
          </div>
          {vaccineSuccess && (
            <span className="text-xs font-semibold text-emerald-600">
              ✓ Saved successfully
            </span>
          )}
        </div>

        <VaccineForm
          vaccine={vaccine}
          onSubmit={handleSaveVaccine}
          apiError={vaccineError}
          loading={isUpdatingVaccine}
        />
      </div>

      {/* Dose Schedules Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Dose Schedule Items ({vaccine.schedule.length})
          </h3>
          <p className="text-xs text-slate-500">
            Configure age windows and intervals from birth for each dose.
          </p>
        </div>

        <div className="space-y-3">
          {vaccine.schedule.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
              No schedule items configured for this vaccine.
            </div>
          ) : (
            vaccine.schedule.map((item) => (
              <ScheduleItemForm
                key={item.id}
                item={item}
                onSubmit={(data) => handleSaveItem(item.id, data)}
                apiError={itemErrors[item.id]}
                loading={isUpdatingItem}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
