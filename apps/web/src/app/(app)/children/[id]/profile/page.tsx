'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChildren, type Child, type UpdateChildDto } from '@/features/children/useChildren';
import { ChildForm } from '@/features/children/ChildForm';
import type { Allergy } from '@/lib/api/models';
import { useFoodsByIds } from '@/features/children/useFoodSearch';
import Link from 'next/link';

export default function ChildProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const childId = resolvedParams.id;
  const router = useRouter();
  const { children, updateChild, saveExtras, deleteChild } = useChildren();
  const [child, setChild] = useState<Child | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);
  const { foods: dislikedFoods, isLoading: loadingDislikes } = useFoodsByIds(child?.dislikes ?? []);

  useEffect(() => {
    const found = children.find((c) => c.id === childId);
    if (found) {
      setChild(found);
    }
  }, [children, childId]);

  if (!child || loadingDislikes) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center">
        <p className="text-sm text-slate-500">Loading child profile...</p>
      </div>
    );
  }

  const handleUpdate = async (
    values: UpdateChildDto,
    allergies: Allergy[],
    dislikeFoodIds: string[],
  ) => {
    await updateChild({ id: childId, dto: values });
    await saveExtras({ id: childId, allergies, dislikeFoodIds });
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 3000);
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${child.name}'s profile?`)) {
      await deleteChild(childId);
      router.push('/');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            ← Back to Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            {child.name}&apos;s Profile
          </h1>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          className="text-xs font-semibold text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-300 transition-colors"
        >
          Delete Child
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center gap-2">
          <span>✓</span> Profile updated successfully!
        </div>
      )}

      <ChildForm
        initialValues={{
          name: child.name,
          dateOfBirth: child.dateOfBirth,
          gender: child.gender,
          heightCm: child.heightCm ?? undefined,
          weightKg: child.weightKg ?? undefined,
          activityLevel: child.activityLevel,
          dietType: child.dietType,
        }}
        initialAllergies={child.allergies}
        initialDislikes={dislikedFoods}
        onSubmit={handleUpdate}
        submitLabel="Update Child Profile"
      />
    </div>
  );
}
