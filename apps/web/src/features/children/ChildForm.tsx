'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AllergyBadge } from '@/components/AllergyBadge';
import {
  ACTIVITY_LEVELS,
  ALLERGENS,
  DIET_TYPES,
  GENDERS,
  SEVERITIES,
  type Allergen,
  type Severity,
} from '@/lib/api/domain';
import type { Allergy, Food } from '@/lib/api/models';
import type { CreateChildDto } from './useChildren';
import { useFoodSearch } from './useFoodSearch';

export const childSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dateOfBirth: z.string().refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime()) && d <= new Date();
  }, 'Birth date cannot be in the future'),
  gender: z.enum(['MALE', 'FEMALE']),
  heightCm: z.number().min(30, 'Height must be at least 30 cm').max(200, 'Height must be under 200 cm'),
  weightKg: z.number().min(1, 'Weight must be at least 1 kg').max(150, 'Weight must be under 150 kg'),
  activityLevel: z.enum(['SEDENTARY', 'MODERATE', 'ACTIVE']),
  dietType: z.enum(['NON_VEGETARIAN', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN']),
});

export type ChildFormValues = z.infer<typeof childSchema>;

export interface ChildFormProps {
  initialValues?: Partial<ChildFormValues>;
  initialAllergies?: Allergy[];
  initialDislikes?: Pick<Food, 'id' | 'name'>[];
  onSubmit: (values: CreateChildDto, allergies: Allergy[], dislikeFoodIds: string[]) => Promise<void>;
  submitLabel?: string;
}

export function ChildForm({
  initialValues,
  initialAllergies = [],
  initialDislikes = [],
  onSubmit,
  submitLabel = 'Save Child Profile',
}: ChildFormProps) {
  const [allergies, setAllergies] = useState<Allergy[]>(initialAllergies);
  const [newAllergen, setNewAllergen] = useState<Allergen>('MILK');
  const [newSeverity, setNewSeverity] = useState<Severity>('MODERATE');

  const [dislikes, setDislikes] = useState<Pick<Food, 'id' | 'name'>[]>(initialDislikes);
  const [dislikeSearch, setDislikeSearch] = useState('');
  const foodResults = useFoodSearch(dislikeSearch);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ChildFormValues>({
    resolver: zodResolver(childSchema),
    defaultValues: {
      name: initialValues?.name || '',
      dateOfBirth: initialValues?.dateOfBirth || new Date().toISOString().split('T')[0],
      gender: initialValues?.gender || 'FEMALE',
      heightCm: initialValues?.heightCm || 85,
      weightKg: initialValues?.weightKg || 12,
      activityLevel: initialValues?.activityLevel || 'MODERATE',
      dietType: initialValues?.dietType || 'NON_VEGETARIAN',
    },
  });

  const dob = watch('dateOfBirth');
  const derivedAge = useMemo(() => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    const diffMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (diffMonths < 0) return null;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} old`;
    const years = Math.floor(diffMonths / 12);
    const months = diffMonths % 12;
    return `${years} yr${years === 1 ? '' : 's'} ${months ? `${months} mo` : ''}`;
  }, [dob]);

  const handleAddAllergy = () => {
    // one entry per allergen: re-adding replaces the severity
    setAllergies([...allergies.filter((a) => a.allergen !== newAllergen), { allergen: newAllergen, severity: newSeverity }]);
  };

  const handleRemoveAllergy = (allergen: Allergen) => {
    setAllergies(allergies.filter((a) => a.allergen !== allergen));
  };

  const handleAddDislike = (food: Pick<Food, 'id' | 'name'>) => {
    if (!dislikes.some((d) => d.id === food.id)) {
      setDislikes([...dislikes, { id: food.id, name: food.name }]);
    }
    setDislikeSearch('');
  };

  const handleRemoveDislike = (id: string) => {
    setDislikes(dislikes.filter((d) => d.id !== id));
  };

  const onFormSubmit = async (values: ChildFormValues) => {
    setErrorMsg(null);
    try {
      await onSubmit(values, allergies, dislikes.map((d) => d.id));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to save child details. Please check the inputs.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Basic Demographics */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
          General Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="name">
              Child&apos;s Full Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Maya"
              {...register('name')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-600 focus:outline-none min-h-[44px]"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700" htmlFor="dateOfBirth">
                Date of Birth
              </label>
              {derivedAge && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {derivedAge}
                </span>
              )}
            </div>
            <input
              id="dateOfBirth"
              type="date"
              {...register('dateOfBirth')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-600 focus:outline-none min-h-[44px]"
            />
            {errors.dateOfBirth && (
              <p className="text-xs text-red-600 mt-1">{errors.dateOfBirth.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="gender">
              Gender
            </label>
            <select
              id="gender"
              {...register('gender')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-600 focus:outline-none min-h-[44px]"
            >
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="heightCm">
              Height (cm)
            </label>
            <input
              id="heightCm"
              type="number"
              step="0.5"
              {...register('heightCm', { valueAsNumber: true })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-600 focus:outline-none min-h-[44px]"
            />
            {errors.heightCm && (
              <p className="text-xs text-red-600 mt-1">{errors.heightCm.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="weightKg">
              Weight (kg)
            </label>
            <input
              id="weightKg"
              type="number"
              step="0.1"
              {...register('weightKg', { valueAsNumber: true })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-600 focus:outline-none min-h-[44px]"
            />
            {errors.weightKg && (
              <p className="text-xs text-red-600 mt-1">{errors.weightKg.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="activityLevel">
              Activity Level
            </label>
            <select
              id="activityLevel"
              {...register('activityLevel')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-600 focus:outline-none min-h-[44px]"
            >
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="dietType">
              Dietary Preference
            </label>
            <select
              id="dietType"
              {...register('dietType')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:border-emerald-600 focus:outline-none min-h-[44px]"
            >
              {DIET_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Allergies Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Allergies & Sensitivities</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Meals with severe allergens will be strictly blocked from auto-plans and suggestions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {allergies.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No allergies added yet.</p>
          ) : (
            allergies.map((a) => (
              <AllergyBadge
                key={a.allergen}
                allergen={a.allergen}
                severity={a.severity}
                onRemove={() => handleRemoveAllergy(a.allergen)}
              />
            ))
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <select
            value={newAllergen}
            onChange={(e) => setNewAllergen(e.target.value as Allergen)}
            aria-label="Allergen"
            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 min-h-[40px] focus:outline-none focus:border-emerald-600"
          >
            {ALLERGENS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={newSeverity}
            onChange={(e) => setNewSeverity(e.target.value as Severity)}
            aria-label="Severity"
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 min-h-[40px] focus:outline-none focus:border-emerald-600"
          >
            {SEVERITIES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddAllergy}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors min-h-[40px]"
          >
            + Add Allergy
          </button>
        </div>
      </div>

      {/* Dislikes Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Food Dislikes</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Foods your child strongly dislikes. We will avoid recommending recipes containing them.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {dislikes.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No dislikes added.</p>
          ) : (
            dislikes.map((d) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-md text-xs font-medium text-slate-700"
              >
                <span>{d.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDislike(d.id)}
                  className="text-slate-400 hover:text-slate-700 ml-1 font-bold"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-2">
          <input
            type="text"
            placeholder="Search foods, e.g. spinach"
            value={dislikeSearch}
            onChange={(e) => setDislikeSearch(e.target.value)}
            aria-label="Search foods to add as a dislike"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 min-h-[40px] focus:outline-none focus:border-emerald-600"
          />
          {dislikeSearch.trim().length >= 2 && (
            <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
              {foodResults.isLoading && <li className="px-3 py-2 text-xs text-slate-400">Searching...</li>}
              {foodResults.data?.length === 0 && (
                <li className="px-3 py-2 text-xs text-slate-400">No matching foods.</li>
              )}
              {foodResults.data?.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => handleAddDislike(f)}
                    className="w-full text-left px-3 py-2 text-xs text-slate-800 hover:bg-slate-50 min-h-[40px]"
                  >
                    + {f.name} <span className="text-slate-400">({f.category})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm border border-emerald-700 transition-colors min-h-[44px]"
      >
        {isSubmitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
