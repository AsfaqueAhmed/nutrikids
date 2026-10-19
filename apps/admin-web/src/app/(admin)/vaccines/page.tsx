'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAdminVaccines } from '@/features/vaccines/useAdminVaccines';
import { DataTable, Column } from '@/components/DataTable';
import { AdminVaccine } from '@/lib/api/models';

export default function VaccinesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data: vaccines = [], isLoading, isError, refetch } = useAdminVaccines();

  const filteredVaccines = useMemo(() => {
    let result = vaccines;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (v) =>
          v.code.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          v.disease.toLowerCase().includes(q)
      );
    }
    if (availabilityFilter !== 'ALL') {
      result = result.filter((v) => v.availability === availabilityFilter);
    }
    return result;
  }, [vaccines, searchTerm, availabilityFilter]);

  const pagedVaccines = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVaccines.slice(start, start + pageSize);
  }, [filteredVaccines, page, pageSize]);

  const columns: Column<AdminVaccine>[] = useMemo(
    () => [
      {
        key: 'code',
        header: 'Code',
        render: (row) => (
          <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
            {row.code}
          </span>
        ),
      },
      {
        key: 'name',
        header: 'Vaccine & Disease',
        render: (row) => (
          <div>
            <div className="font-semibold text-slate-900">{row.name}</div>
            <div className="text-xs text-slate-500">{row.disease}</div>
          </div>
        ),
      },
      {
        key: 'availability',
        header: 'Availability',
        render: (row) => {
          const map: Record<string, { label: string; bg: string }> = {
            GOVERNMENT_FREE: { label: 'Gov Free (EPI)', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
            PRIVATE_PAID: { label: 'Private Paid', bg: 'bg-blue-50 text-blue-800 border-blue-200' },
            BOTH: { label: 'Gov & Private', bg: 'bg-purple-50 text-purple-800 border-purple-200' },
          };
          const info = map[row.availability] ?? { label: row.availability, bg: 'bg-slate-100 text-slate-700' };
          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${info.bg}`}>
              {info.label}
            </span>
          );
        },
      },
      {
        key: 'mandatory',
        header: 'Mandatory',
        render: (row) => (
          <span className={`text-xs font-semibold ${row.isMandatory ? 'text-emerald-700' : 'text-slate-400'}`}>
            {row.isMandatory ? 'Yes (EPI)' : 'Optional'}
          </span>
        ),
      },
      {
        key: 'price',
        header: 'Price Range (BDT)',
        render: (row) => {
          if (row.priceMinBdt == null && row.priceMaxBdt == null) {
            return <span className="text-xs text-slate-400">—</span>;
          }
          if (row.priceMinBdt != null && row.priceMaxBdt != null) {
            return (
              <span className="text-xs text-slate-800 font-medium">
                ৳{row.priceMinBdt.toLocaleString()} - ৳{row.priceMaxBdt.toLocaleString()}
              </span>
            );
          }
          return (
            <span className="text-xs text-slate-800 font-medium">
              ৳{(row.priceMinBdt ?? row.priceMaxBdt)?.toLocaleString()}
            </span>
          );
        },
      },
      {
        key: 'verified',
        header: 'Verified',
        render: (row) =>
          row.verified ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              ✓ Verified
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              Unverified
            </span>
          ),
      },
      {
        key: 'priceUpdated',
        header: 'Price Updated',
        render: (row) => (
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {row.priceUpdatedAt
              ? new Date(row.priceUpdatedAt).toLocaleDateString()
              : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'text-right',
        render: (row) => (
          <Link
            href={`/vaccines/${row.id}`}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-3 py-1.5 rounded border border-slate-200 hover:border-emerald-300 bg-white inline-block"
          >
            Edit Schedule
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vaccine Catalogue & Schedule</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review official Bangladesh EPI vaccines, private pricing ranges, and dose timing schedules.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-none flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1">
          <input
            type="search"
            placeholder="Search vaccines by code, name, or target disease..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="availability-filter" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Availability:
          </label>
          <select
            id="availability-filter"
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          >
            <option value="ALL">All Availabilities</option>
            <option value="GOVERNMENT_FREE">Government Free (EPI)</option>
            <option value="PRIVATE_PAID">Private Paid Only</option>
            <option value="BOTH">Government & Private</option>
          </select>
        </div>
      </div>

      {/* Vaccines Table */}
      {isError ? (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-red-800">
            Failed to load vaccine catalogue.
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
          rows={pagedVaccines}
          loading={isLoading}
          empty="No matching vaccines found."
          page={page}
          limit={pageSize}
          total={filteredVaccines.length}
          onPage={setPage}
        />
      )}
    </div>
  );
}
