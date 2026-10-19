'use client';

import React from 'react';
import { useImportHospitals } from '@/features/hospitals/useImportHospitals';
import { HospitalImport } from '@/features/hospitals/HospitalImport';

export default function HospitalsPage() {
  const { importHospitals, isPending } = useImportHospitals();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hospital Directory Import</h1>
        <p className="text-sm text-slate-500 mt-1">
          Import and update hospitals, pediatric clinics, and vaccination centers in Bangladesh via CSV.
        </p>
      </div>

      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
        <h2 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
          CSV Format Specifications
        </h2>
        <p className="text-xs text-emerald-900 leading-relaxed">
          The file must contain a header with the following 9 columns in order:
        </p>
        <code className="block p-2.5 bg-white border border-emerald-200 rounded-lg text-xs font-mono text-emerald-800 break-all select-all">
          name,type,address,district,lat,lng,phone,services,source
        </code>
        <ul className="list-disc list-inside text-xs text-emerald-900 space-y-1 pt-1">
          <li><strong>lat & lng:</strong> valid decimal coordinates in Bangladesh (e.g., 23.8103, 90.4125).</li>
          <li><strong>services:</strong> semicolon-separated tags, such as <code className="bg-emerald-100 px-1 py-0.5 rounded text-[11px]">Vaccination;Pediatrics;Emergency</code>.</li>
          <li><strong>Idempotency:</strong> Hospitals with matching name and district will be updated rather than duplicated.</li>
        </ul>
      </div>

      <HospitalImport onImport={importHospitals} loading={isPending} />
    </div>
  );
}
