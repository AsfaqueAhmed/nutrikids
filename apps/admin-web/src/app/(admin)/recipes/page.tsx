'use client';

import React, { useState, useMemo } from 'react';
import { useRecipes, useRecipeMutations, CreateRecipeInput } from '@/features/recipes/useRecipes';
import { RecipeForm } from '@/features/recipes/RecipeForm';
import { DataTable, Column } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MEAL_SLOTS, MealSlot, allergenLabel } from '@/lib/api/domain';
import { Recipe } from '@/lib/api/models';

export default function RecipesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<MealSlot | 'ALL'>('ALL');

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: recipes = [], isLoading, isError, refetch } = useRecipes(
    selectedSlot === 'ALL' ? undefined : { slot: selectedSlot }
  );

  const { createRecipe, updateRecipe, deleteRecipe, isCreating, isUpdating, isDeleting } =
    useRecipeMutations();

  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filteredRecipes = useMemo(() => {
    if (!searchTerm.trim()) return recipes;
    const q = searchTerm.toLowerCase();
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.instructions.toLowerCase().includes(q) ||
        r.foods.some((f) => f.name.toLowerCase().includes(q))
    );
  }, [recipes, searchTerm]);

  const pagedRecipes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecipes.slice(start, start + pageSize);
  }, [filteredRecipes, page, pageSize]);

  const handleOpenCreate = () => {
    setEditingRecipe(null);
    setFormError(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveRecipe = async (payload: CreateRecipeInput) => {
    setFormError(null);
    try {
      if (editingRecipe) {
        await updateRecipe(editingRecipe.id, payload);
      } else {
        await createRecipe(payload);
      }
      setFormOpen(false);
      setEditingRecipe(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save recipe.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!recipeToDelete) return;
    setDeleteError(null);
    try {
      await deleteRecipe(recipeToDelete.id);
      setRecipeToDelete(null);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete this recipe.'
      );
    }
  };

  const columns: Column<Recipe>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Recipe',
        render: (row) => (
          <div>
            <div className="font-semibold text-slate-900">{row.name}</div>
            <div className="text-xs text-slate-500">{row.prepMinutes} mins prep</div>
          </div>
        ),
      },
      {
        key: 'slots',
        header: 'Slots',
        render: (row) => (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {row.slots.map((s) => (
              <span
                key={s}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700"
              >
                {s.toLowerCase().replace('_', ' ')}
              </span>
            ))}
          </div>
        ),
      },
      {
        key: 'ingredients',
        header: 'Ingredients',
        render: (row) => (
          <div className="text-xs text-slate-700 max-w-xs truncate" title={row.foods.map((f) => `${f.name} (${f.quantityG}g)`).join(', ')}>
            <span className="font-semibold text-slate-900">{row.foods.length} items:</span>{' '}
            {row.foods.map((f) => f.name).join(', ')}
          </div>
        ),
      },
      {
        key: 'allergens',
        header: 'Allergens',
        render: (row) => (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {row.allergens.length === 0 ? (
              <span className="text-xs text-slate-400">—</span>
            ) : (
              row.allergens.map((alg) => (
                <span
                  key={alg}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                >
                  {allergenLabel(alg)}
                </span>
              ))
            )}
          </div>
        ),
      },
      {
        key: 'age',
        header: 'Age Range',
        render: (row) => (
          <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
            {row.ageMinMonths} - {row.ageMaxMonths}m
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handleOpenEdit(row)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded border border-slate-200 hover:border-emerald-300 bg-white"
            >
              Edit
            </button>
            <button
              onClick={() => {
                setDeleteError(null);
                setRecipeToDelete(row);
              }}
              className="text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-1 rounded border border-transparent hover:border-red-200 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recipes Catalogue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage nutrient-balanced meal recipes, ingredients, and computed allergen profiles.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flat-button-primary text-xs px-4 py-2 self-start sm:self-auto"
        >
          + Add New Recipe
        </button>
      </div>

      {deleteError && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800"
        >
          {deleteError}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-none flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1">
          <input
            type="search"
            placeholder="Search recipes by name, instructions, or ingredients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="slot-filter" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Slot:
          </label>
          <select
            id="slot-filter"
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value as MealSlot | 'ALL')}
            className="h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          >
            <option value="ALL">All Meal Slots</option>
            {MEAL_SLOTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Recipes Data Table */}
      {isError ? (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-red-800">
            Failed to load recipes.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="flat-button-secondary text-xs px-4 py-2"
          >
            Retry
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={pagedRecipes}
          loading={isLoading}
          empty="No matching recipes found in catalogue."
          page={page}
          limit={pageSize}
          total={filteredRecipes.length}
          onPage={setPage}
        />
      )}

      {/* Create / Edit Recipe Modal */}
      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingRecipe ? `Edit Recipe: ${editingRecipe.name}` : 'Create New Recipe'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            <RecipeForm
              initial={
                editingRecipe
                  ? {
                      name: editingRecipe.name,
                      instructions: editingRecipe.instructions,
                      prepMinutes: editingRecipe.prepMinutes,
                      ageMinMonths: editingRecipe.ageMinMonths,
                      ageMaxMonths: editingRecipe.ageMaxMonths,
                      slots: editingRecipe.slots,
                      suitableDiets: editingRecipe.suitableDiets,
                      foods: editingRecipe.foods.map((f) => ({
                        foodId: f.foodId,
                        name: f.name,
                        quantityG: f.quantityG,
                      })),
                    }
                  : undefined
              }
              onSubmit={handleSaveRecipe}
              onCancel={() => setFormOpen(false)}
              apiError={formError}
              loading={isCreating || isUpdating}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(recipeToDelete)}
        title="Delete Recipe"
        description={`Are you sure you want to delete "${recipeToDelete?.name}"? Meal plans that already include this recipe will not be affected.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Recipe'}
        cancelLabel="Cancel"
        destructive={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setRecipeToDelete(null)}
      />
    </div>
  );
}
