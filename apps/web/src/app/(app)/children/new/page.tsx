'use client';

import { useRouter } from 'next/navigation';
import { ChildForm } from '@/features/children/ChildForm';
import { useChildren, CreateChildDto } from '@/features/children/useChildren';
import { useActiveChild } from '@/features/children/useActiveChild';
import { api } from '@/lib/api/client';
import Link from 'next/link';

export default function NewChildPage() {
  const router = useRouter();
  const { createChild } = useChildren();
  const { setActiveChildId } = useActiveChild();

  const handleCreate = async (
    dto: CreateChildDto,
    allergies: { allergenTag: string; severity: 'mild' | 'moderate' | 'severe' }[]
  ) => {
    const created = await createChild(dto);

    for (const a of allergies) {
      await api.POST('/v1/children/{id}/allergies', {
        params: { path: { id: created.id } },
        body: a,
      });
    }

    setActiveChildId(created.id);
    router.push('/');
  };

  return (
    <div className="max-w-2xl mx-auto py-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            ← Back to Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Add Another Child
          </h1>
        </div>
      </div>

      <ChildForm onSubmit={handleCreate} submitLabel="Create Child Profile" />
    </div>
  );
}
