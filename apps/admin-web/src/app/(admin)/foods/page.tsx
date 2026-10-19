'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFoods, useFoodCategories, useFoodMutations, CreateFoodInput } from '@/features/foods/useFoods';
import { FoodForm } from '@/features/foods/FoodForm';
import { DataTable, Column } from '@/components/DataTable';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Allergen, allergenLabel } from '@/lib/api/domain';
import { Food } from '@/lib/api/models';

export default function FoodsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [formOpen, setFormOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [foodToDelete, setFoodToDelete] = useState<Food | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: categories } = useFoodCategories();
  const { data, isLoading, isError, refetch } = useFoods({
    search: debouncedSearch || undefined,
    category: selectedCategory === 'ALL' ? undefined : selectedCategory,
    page,
    pageSize,
  });

  const { create, update, remove, isPending } = useFoodMutations();

  const handleOpenCreate = () => {
    setEditingFood(null);
    setFormError(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (food: Food) => {
    setEditingFood(food);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveFood = async (payload: CreateFoodInput) => {
    setFormError(null);
    try {
      if (editingFood) {
        await update({ id: editingFood.id, data: payload });
      } else {
        await create(payload);
      }
      setFormOpen(false);
      setEditingFood(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save food item.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!foodToDelete) return;
    setDeleteError(null);
    try {
      await remove(foodToDelete.id);
      setFoodToDelete(null);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Cannot delete this food. It may be used in one or more active recipes.'
      );
    }
  };

  const columns: Column<Food>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Food Name',
        render: (row) => (
          <div>
            <div className="font-semibold text-slate-900">{row.name}</div>
            <div className="text-xs text-slate-400">{row.category}</div>
          </div>
        ),
      },
      {
        key: 'allergens',
        header: 'Allergens',
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.allergens && row.allergens.length > 0 ? (
              row.allergens.map((alg: Allergen) => (
                <span
                  key={alg}
                  className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium"
                >
                  {allergenLabel(alg)}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">None</span>
            )}
          </div>
        ),
      },
      {
        key: 'ageRange',
        header: 'Age Range',
        render: (row) => (
          <span className="text-xs text-slate-600 font-medium">
            {row.ageMinMonths != null && row.ageMaxMonths != null
              ? `${row.ageMinMonths}–${row.ageMaxMonths}m`
              : row.ageMinMonths != null
              ? `From ${row.ageMinMonths}m`
              : 'All ages'}
          </span>
        ),
      },
      {
        key: 'nutrition',
        header: 'Nutrition (100g)',
        render: (row) => {
          const nut = (row as unknown as { nutrition?: Record<string, number> }).nutrition ?? {};
          return (
            <div className="text-xs text-slate-600 space-y-0.5">
              <div>
                <span className="font-semibold">{nut.energyKcal ?? 0}</span> kcal
              </div>
              <div className="text-[11px] text-slate-400">
                P: {nut.proteinG ?? 0}g • C: {nut.carbsG ?? 0}g • F: {nut.fatG ?? 0}g
              </div>
            </div>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenEdit(row)}
              className="px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setFoodToDelete(row)}
              className="px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 bg-white text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
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
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Food Catalogue
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage ingredient catalogue, allergen flags, and nutritional profiles per 100g.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="flat-button-primary text-xs self-start sm:self-auto"
        >
          + Add New Food
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

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search foods by name..."
            className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1"
            >
              Clear
            </button>
          )}
        </div>

        <select
          aria-label="Filter by category"
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-600"
        >
          <option value="ALL">All Categories</option>
          {categories?.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Food Creation / Edit Modal */}
      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 p-6 space-y-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingFood ? `Edit ${editingFood.name}` : 'Add New Food Item'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <FoodForm
              initial={
                editingFood
                  ? {
                      name: editingFood.name,
                      category: editingFood.category,
                      allergens: editingFood.allergens,
                      ageMinMonths: editingFood.ageMinMonths,
                      ageMaxMonths: editingFood.ageMaxMonths,
                      nutrition: (editingFood as unknown as { nutrition: CreateFoodInput['nutrition'] }).nutrition,
                    }
                  : undefined
              }
              onSubmit={handleSaveFood}
              onCancel={() => setFormOpen(false)}
              apiError={formError}
              loading={isPending}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(foodToDelete)}
        title="Delete Food Item"
        description={`Are you sure you want to delete ${foodToDelete?.name}? Deleting a food used by recipes may be blocked.`}
        confirmLabel="Delete Food"
        destructive={true}
        loading={isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setFoodToDelete(null)}
      />

      {/* Data Table */}
      {isError ? (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-red-800">
            Failed to load food catalogue.
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
          rows={data?.items ?? []}
          loading={isLoading}
          empty="No matching foods found in catalogue."
          page={page}
          limit={pageSize}
          total={data?.total ?? 0}
          onPage={setPage}
        />
      )}
    </div>
  );
}
