'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Disclaimer } from '@/components/Disclaimer';
import { ChildForm } from '@/features/children/ChildForm';
import { useChildren, CreateChildDto } from '@/features/children/useChildren';
import type { Allergy } from '@/lib/api/models';

export default function OnboardingPage() {
  const router = useRouter();
  const { createChild, saveExtras } = useChildren();
  const [step, setStep] = useState<1 | 2>(1);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateChild = async (
    dto: CreateChildDto,
    allergies: Allergy[],
    dislikeFoodIds: string[],
  ) => {
    setErrorMsg(null);
    try {
      const created = await createChild(dto);

      if (allergies.length || dislikeFoodIds.length) {
        await saveExtras({ id: created.id, allergies, dislikeFoodIds });
      }

      router.push('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to create child profile. Please try again.');
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-4">
      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
            Step {step} of 2
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            {step === 1 ? 'Important Health Notice' : 'Add Your Child'}
          </h1>
        </div>
        <div className="flex gap-1.5">
          <div
            className={`w-8 h-1.5 rounded-full ${step >= 1 ? 'bg-emerald-600' : 'bg-slate-200'}`}
          />
          <div
            className={`w-8 h-1.5 rounded-full ${step >= 2 ? 'bg-emerald-600' : 'bg-slate-200'}`}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {errorMsg}
        </div>
      )}

      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <Disclaimer />

          <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={disclaimerAccepted}
              onChange={(e) => setDisclaimerAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-600"
            />
            <span className="text-xs sm:text-sm font-medium text-slate-800 leading-normal">
              I understand that NutriKids provides nutritional, meal planning, and growth tracking guidance based on standard references (e.g. WHO). It is not a clinical medical device and does not substitute professional medical care.
            </span>
          </label>

          <button
            type="button"
            disabled={!disclaimerAccepted}
            onClick={() => setStep(2)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold rounded-lg text-sm border border-emerald-700 transition-colors min-h-[44px]"
          >
            Continue to Child Profile →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <ChildForm
            onSubmit={handleCreateChild}
            submitLabel="Complete Setup & Go to Dashboard"
          />
        </div>
      )}
    </div>
  );
}
