'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MEAL_SLOTS,
  DIET_TYPES,
  allergenLabel,
  type MealSlot,
  type DietType,
  type Allergen,
} from '@/lib/api/domain';
import { useFoods } from '@/features/foods/useFoods';
import type { CreateRecipeInput } from './useRecipes';
import type { Food } from '@/lib/api/models';

const recipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required'),
  instructions: z.string().min(1, 'Instructions are required'),
  prepMinutes: z.number().min(0, 'Prep minutes must be non-negative'),
  ageMinMonths: z.number().min(0, 'Min age must be non-negative'),
  ageMaxMonths: z.number().min(0, 'Max age must be non-negative'),
});

type RecipeFormFields = z.infer<typeof recipeSchema>;

export type IngredientRow = {
  foodId: string;
  name?: string;
  quantityG: number;
  allergens?: Allergen[];
};

export type RecipeFormProps = {
  initial?: Partial<CreateRecipeInput> & {
    foods?: IngredientRow[];
  };
  onSubmit: (data: CreateRecipeInput) => Promise<void> | void;
  onCancel?: () => void;
  apiError?: string | null;
  loading?: boolean;
};

export function RecipeForm({
  initial,
  onSubmit,
  onCancel,
  apiError,
  loading = false,
}: RecipeFormProps) {
  const [slots, setSlots] = useState<MealSlot[]>(initial?.slots ?? []);
  const [diets, setDiets] = useState<DietType[]>(initial?.suitableDiets ?? []);

  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    initial?.foods && initial.foods.length > 0
      ? initial.foods
      : [{ foodId: '', quantityG: 100, allergens: [] }]
  );

  const [ingredientError, setIngredientError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormFields>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      name: initial?.name ?? '',
      instructions: initial?.instructions ?? '',
      prepMinutes: initial?.prepMinutes,
      ageMinMonths: initial?.ageMinMonths,
      ageMaxMonths: initial?.ageMaxMonths,
    },
  });

  // Food Search for each row
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({});
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);

  const activeQuery = activeSearchIndex !== null ? searchQueries[activeSearchIndex] ?? '' : '';
  const { data: foodPage } = useFoods({ search: activeQuery, pageSize: 10 });

  const toggleSlot = (s: MealSlot) => {
    setSlots((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const toggleDiet = (d: DietType) => {
    setDiets((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handleAddIngredient = () => {
    setIngredients((prev) => [...prev, { foodId: '', quantityG: 50, allergens: [] }]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectFood = (index: number, food: Food) => {
    setIngredients((prev) =>
      prev.map((ing, i) =>
        i === index
          ? {
              ...ing,
              foodId: food.id,
              name: food.name,
              allergens: food.allergens ?? [],
            }
          : ing
      )
    );
    setActiveSearchIndex(null);
  };

  const handleQuantityChange = (index: number, qty: number) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, quantityG: qty } : ing))
    );
  };

  // Computed Allergen tags from all selected foods
  const computedAllergens = useMemo(() => {
    const set = new Set<Allergen>();
    for (const ing of ingredients) {
      if (ing.allergens) {
        for (const a of ing.allergens) {
          set.add(a);
        }
      }
    }
    return Array.from(set).sort();
  }, [ingredients]);

  const handleFormSubmit = async (values: RecipeFormFields) => {
    const validIngredients = ingredients.filter((ing) => ing.foodId.trim() !== '');
    if (validIngredients.length === 0) {
      setIngredientError('At least one ingredient with a selected food is required.');
      return;
    }
    if (slots.length === 0) {
      setIngredientError('At least one meal slot must be selected.');
      return;
    }
    if (diets.length === 0) {
      setIngredientError('At least one suitable diet must be selected.');
      return;
    }
    setIngredientError(null);

    const payload: CreateRecipeInput = {
      name: values.name.trim(),
      instructions: values.instructions.trim(),
      prepMinutes: values.prepMinutes,
      ageMinMonths: values.ageMinMonths,
      ageMaxMonths: values.ageMaxMonths,
      slots,
      suitableDiets: diets,
      foods: validIngredients.map((ing) => ({
        foodId: ing.foodId,
        quantityG: ing.quantityG,
      })),
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {(apiError || ingredientError) && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800"
        >
          {apiError || ingredientError}
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="recipe-name" className="block text-xs font-semibold text-slate-700 mb-1">
            Recipe Name *
          </label>
          <input
            id="recipe-name"
            type="text"
            placeholder="e.g. Warm Apple Puree"
            {...register('name')}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          {errors.name && (
            <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="recipe-instructions" className="block text-xs font-semibold text-slate-700 mb-1">
            Instructions *
          </label>
          <textarea
            id="recipe-instructions"
            rows={4}
            placeholder="Describe preparation and cooking steps..."
            {...register('instructions')}
            className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          {errors.instructions && (
            <p className="text-xs text-red-600 mt-1">{errors.instructions.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="recipe-prep-minutes" className="block text-xs font-semibold text-slate-700 mb-1">
            Prep Minutes *
          </label>
          <input
            id="recipe-prep-minutes"
            type="number"
            {...register('prepMinutes', { valueAsNumber: true })}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          {errors.prepMinutes && (
            <p className="text-xs text-red-600 mt-1">{errors.prepMinutes.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="recipe-min-age" className="block text-xs font-semibold text-slate-700 mb-1">
              Min Age (m) *
            </label>
            <input
              id="recipe-min-age"
              type="number"
              {...register('ageMinMonths', { valueAsNumber: true })}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.ageMinMonths && (
              <p className="text-xs text-red-600 mt-1">{errors.ageMinMonths.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="recipe-max-age" className="block text-xs font-semibold text-slate-700 mb-1">
              Max Age (m) *
            </label>
            <input
              id="recipe-max-age"
              type="number"
              {...register('ageMaxMonths', { valueAsNumber: true })}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.ageMaxMonths && (
              <p className="text-xs text-red-600 mt-1">{errors.ageMaxMonths.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Meal Slots Multi-Select */}
      <div className="space-y-2">
        <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Meal Slots *
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {MEAL_SLOTS.map((s) => {
            const checked = slots.includes(s.value);
            return (
              <label
                key={s.value}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  checked
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSlot(s.value)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>{s.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Diets Multi-Select */}
      <div className="space-y-2">
        <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Suitable Diets *
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DIET_TYPES.map((d) => {
            const checked = diets.includes(d.value);
            return (
              <label
                key={d.value}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                  checked
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDiet(d.value)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>{d.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Ingredients List */}
      <div className="space-y-3 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Ingredients ({ingredients.length}) *
          </span>
          <button
            type="button"
            onClick={handleAddIngredient}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 border border-emerald-600 rounded-md px-3 py-1 bg-white hover:bg-emerald-50"
          >
            + Add Ingredient
          </button>
        </div>

        <div className="space-y-3">
          {ingredients.map((ing, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-3"
            >
              <div className="text-xs font-bold text-slate-500 min-w-24">
                Ingredient {idx + 1}
              </div>

              {/* Food Picker */}
              <div className="flex-1 relative w-full sm:w-auto">
                <input
                  type="text"
                  placeholder={ing.name || 'Search and select a food...'}
                  value={
                    activeSearchIndex === idx
                      ? searchQueries[idx] ?? ''
                      : ing.name ?? ing.foodId
                  }
                  onFocus={() => setActiveSearchIndex(idx)}
                  onChange={(e) =>
                    setSearchQueries((prev) => ({ ...prev, [idx]: e.target.value }))
                  }
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />

                {activeSearchIndex === idx && foodPage && foodPage.items.length > 0 && (
                  <div className="absolute left-0 right-0 top-10 z-20 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {foodPage.items.map((food) => (
                      <button
                        key={food.id}
                        type="button"
                        onClick={() => handleSelectFood(idx, food)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 border-b border-slate-100 last:border-none flex items-center justify-between"
                      >
                        <span className="font-medium text-slate-900">{food.name}</span>
                        <span className="text-[10px] text-slate-500">{food.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity in Grams */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={ing.quantityG}
                  onChange={(e) => handleQuantityChange(idx, Number(e.target.value) || 0)}
                  className="w-20 h-9 px-2 text-center bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                <span className="text-xs text-slate-600">g</span>
              </div>

              {/* Remove Row Button */}
              <button
                type="button"
                onClick={() => handleRemoveIngredient(idx)}
                className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded border border-transparent hover:border-red-200"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Computed Allergen Tags */}
      <div
        data-testid="computed-allergens"
        className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5"
      >
        <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Computed Allergens ({computedAllergens.length})
        </span>
        <p className="text-[11px] text-slate-500">
          Automatically aggregated from all ingredients above to warn parents and filter meal plans.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {computedAllergens.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No allergens detected</span>
          ) : (
            computedAllergens.map((alg) => (
              <span
                key={alg}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300"
              >
                {allergenLabel(alg)}
              </span>
            ))
          )}
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
          {isSubmitting || loading ? 'Saving...' : 'Save Recipe'}
        </button>
      </div>
    </form>
  );
}
