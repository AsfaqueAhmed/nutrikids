'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ALLERGENS, Allergen } from '@/lib/api/domain';
import { CreateFoodInput } from './useFoods';

const foodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  energyKcal: z.number().min(0, 'Energy must be non-negative'),
  proteinG: z.number().min(0, 'Protein must be non-negative'),
  carbsG: z.number().min(0, 'Carbohydrates must be non-negative'),
  fatG: z.number().min(0, 'Fat must be non-negative'),
  ageMinMonths: z.number().min(0, 'Min age must be non-negative').optional(),
  ageMaxMonths: z.number().min(0, 'Max age must be non-negative').optional(),
});

type FoodFormValues = z.infer<typeof foodSchema>;

export type FoodFormProps = {
  initial?: Partial<CreateFoodInput>;
  onSubmit: (data: CreateFoodInput) => Promise<void> | void;
  onCancel?: () => void;
  apiError?: string | null;
  loading?: boolean;
};

export function FoodForm({
  initial,
  onSubmit,
  onCancel,
  apiError,
  loading = false,
}: FoodFormProps) {
  const [selectedAllergens, setSelectedAllergens] = useState<Allergen[]>(
    initial?.allergens ?? []
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FoodFormValues>({
    resolver: zodResolver(foodSchema),
    defaultValues: {
      name: initial?.name ?? '',
      category: initial?.category ?? '',
      energyKcal: initial?.nutrition?.energyKcal,
      proteinG: initial?.nutrition?.proteinG,
      carbsG: initial?.nutrition?.carbsG,
      fatG: initial?.nutrition?.fatG,
      ageMinMonths: initial?.ageMinMonths,
      ageMaxMonths: initial?.ageMaxMonths,
    },
  });

  const toggleAllergen = (allergen: Allergen) => {
    setSelectedAllergens((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen]
    );
  };

  const handleFormSubmit = async (values: FoodFormValues) => {
    const payload: CreateFoodInput = {
      name: values.name.trim(),
      category: values.category.trim(),
      allergens: selectedAllergens,
      ageMinMonths: values.ageMinMonths,
      ageMaxMonths: values.ageMaxMonths,
      nutrition: {
        energyKcal: values.energyKcal,
        proteinG: values.proteinG,
        carbsG: values.carbsG,
        fatG: values.fatG,
      },
    };
    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {apiError && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800"
        >
          {apiError}
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="food-name" className="block text-xs font-semibold text-slate-700 mb-1">
            Food Name *
          </label>
          <input
            id="food-name"
            type="text"
            placeholder="e.g. Mashed Sweet Potato"
            {...register('name')}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          {errors.name && (
            <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="food-category" className="block text-xs font-semibold text-slate-700 mb-1">
            Category *
          </label>
          <input
            id="food-category"
            type="text"
            placeholder="e.g. Vegetables, Fruits, Grains"
            {...register('category')}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          {errors.category && (
            <p className="text-xs text-red-600 mt-1">{errors.category.message}</p>
          )}
        </div>
      </div>

      {/* Age Guidelines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="food-min-age" className="block text-xs font-semibold text-slate-700 mb-1">
            Min Age (Months)
          </label>
          <input
            id="food-min-age"
            type="number"
            {...register('ageMinMonths', {
              setValueAs: (v) => (v === '' || v === null || isNaN(Number(v)) ? undefined : Number(v)),
            })}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          {errors.ageMinMonths && (
            <p className="text-xs text-red-600 mt-1">{errors.ageMinMonths.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="food-max-age" className="block text-xs font-semibold text-slate-700 mb-1">
            Max Age (Months)
          </label>
          <input
            id="food-max-age"
            type="number"
            {...register('ageMaxMonths', {
              setValueAs: (v) => (v === '' || v === null || isNaN(Number(v)) ? undefined : Number(v)),
            })}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          {errors.ageMaxMonths && (
            <p className="text-xs text-red-600 mt-1">{errors.ageMaxMonths.message}</p>
          )}
        </div>
      </div>

      {/* Nutrition per 100g */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Nutritional Values (per 100g)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="energy-kcal" className="block text-xs font-medium text-slate-600 mb-1">
              Energy (kcal) *
            </label>
            <input
              id="energy-kcal"
              type="number"
              step="any"
              {...register('energyKcal', { valueAsNumber: true })}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
            />
            {errors.energyKcal && (
              <p className="text-xs text-red-600 mt-1">{errors.energyKcal.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="protein-g" className="block text-xs font-medium text-slate-600 mb-1">
              Protein (g) *
            </label>
            <input
              id="protein-g"
              type="number"
              step="any"
              {...register('proteinG', { valueAsNumber: true })}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
            />
            {errors.proteinG && (
              <p className="text-xs text-red-600 mt-1">{errors.proteinG.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="carbs-g" className="block text-xs font-medium text-slate-600 mb-1">
              Carbs (g) *
            </label>
            <input
              id="carbs-g"
              type="number"
              step="any"
              {...register('carbsG', { valueAsNumber: true })}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
            />
            {errors.carbsG && (
              <p className="text-xs text-red-600 mt-1">{errors.carbsG.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="fat-g" className="block text-xs font-medium text-slate-600 mb-1">
              Fat (g) *
            </label>
            <input
              id="fat-g"
              type="number"
              step="any"
              {...register('fatG', { valueAsNumber: true })}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
            />
            {errors.fatG && (
              <p className="text-xs text-red-600 mt-1">{errors.fatG.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Allergen Flags */}
      <div className="space-y-2">
        <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Allergen Flags
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {ALLERGENS.map((alg) => {
            const checked = selectedAllergens.includes(alg.value);
            return (
              <label
                key={alg.value}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  checked
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleAllergen(alg.value)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>{alg.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting || loading}
            className="flat-button-secondary text-xs px-4 py-2"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || loading}
          className="flat-button-primary text-xs px-5 py-2.5"
        >
          {isSubmitting || loading ? 'Saving...' : 'Save Food'}
        </button>
      </div>
    </form>
  );
}
