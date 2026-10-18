'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AllergyBadge } from '@/components/AllergyBadge';
import type { CreateChildDto } from './useChildren';

export const childSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dateOfBirth: z.string().refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime()) && d <= new Date();
  }, 'Birth date cannot be in the future'),
  gender: z.enum(['male', 'female', 'other']),
  heightCm: z.number().min(30, 'Height must be at least 30 cm').max(200, 'Height must be under 200 cm'),
  weightKg: z.number().min(1, 'Weight must be at least 1 kg').max(150, 'Weight must be under 150 kg'),
  activityLevel: z.enum(['sedentary', 'moderate', 'active']),
  dietType: z.string().min(1, 'Diet type is required'),
});

export type ChildFormValues = z.infer<typeof childSchema>;

export interface ChildFormProps {
  initialValues?: Partial<ChildFormValues>;
  onSubmit: (values: CreateChildDto, allergies: { allergenTag: string; severity: 'mild' | 'moderate' | 'severe' }[], dislikes: string[]) => Promise<void>;
  submitLabel?: string;
}

export function ChildForm({
  initialValues,
  onSubmit,
  submitLabel = 'Save Child Profile',
}: ChildFormProps) {
  const [allergies, setAllergies] = useState<
    { allergenTag: string; severity: 'mild' | 'moderate' | 'severe' }[]
  >([]);
  const [newAllergen, setNewAllergen] = useState('');
  const [newSeverity, setNewSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');

  const [dislikes, setDislikes] = useState<string[]>([]);
  const [newDislike, setNewDislike] = useState('');

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
      gender: initialValues?.gender || 'female',
      heightCm: initialValues?.heightCm || 85,
      weightKg: initialValues?.weightKg || 12,
      activityLevel: initialValues?.activityLevel || 'moderate',
      dietType: initialValues?.dietType || 'omnivore',
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
    if (!newAllergen.trim()) return;
    const tag = newAllergen.trim().toLowerCase();
    if (!allergies.some((a) => a.allergenTag === tag)) {
      setAllergies([...allergies, { allergenTag: tag, severity: newSeverity }]);
    }
    setNewAllergen('');
  };

  const handleRemoveAllergy = (tag: string) => {
    setAllergies(allergies.filter((a) => a.allergenTag !== tag));
  };

  const handleAddDislike = () => {
    if (!newDislike.trim()) return;
    const food = newDislike.trim();
    if (!dislikes.includes(food)) {
      setDislikes([...dislikes, food]);
    }
    setNewDislike('');
  };

  const handleRemoveDislike = (food: string) => {
    setDislikes(dislikes.filter((d) => d !== food));
  };

  const onFormSubmit = async (values: ChildFormValues) => {
    setErrorMsg(null);
    try {
      await onSubmit(values, allergies, dislikes);
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
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
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
              <option value="sedentary">Sedentary (quiet play)</option>
              <option value="moderate">Moderate (regular active play)</option>
              <option value="active">Active (very high energy / sports)</option>
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
              <option value="omnivore">Standard / Omnivore</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="halal">Halal</option>
              <option value="kosher">Kosher</option>
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
                key={a.allergenTag}
                allergen={a.allergenTag}
                severity={a.severity}
                onRemove={() => handleRemoveAllergy(a.allergenTag)}
              />
            ))
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            placeholder="e.g. peanut, dairy, egg, gluten"
            value={newAllergen}
            onChange={(e) => setNewAllergen(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 min-h-[40px] focus:outline-none focus:border-emerald-600"
          />
          <select
            value={newSeverity}
            onChange={(e) => setNewSeverity(e.target.value as 'mild' | 'moderate' | 'severe')}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 min-h-[40px] focus:outline-none focus:border-emerald-600"
          >
            <option value="mild">Mild (Warning)</option>
            <option value="moderate">Moderate (Confirmation)</option>
            <option value="severe">Severe (Hard Block)</option>
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
                key={d}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-md text-xs font-medium text-slate-700"
              >
                <span>{d}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDislike(d)}
                  className="text-slate-400 hover:text-slate-700 ml-1 font-bold"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            placeholder="e.g. broccoli, mushrooms"
            value={newDislike}
            onChange={(e) => setNewDislike(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 min-h-[40px] focus:outline-none focus:border-emerald-600"
          />
          <button
            type="button"
            onClick={handleAddDislike}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors min-h-[40px]"
          >
            + Add Dislike
          </button>
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
