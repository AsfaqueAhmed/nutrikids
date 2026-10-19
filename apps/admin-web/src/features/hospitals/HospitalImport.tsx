'use client';

import React, { useState } from 'react';
import { ImportHospitalsResult } from './useImportHospitals';

export type HospitalImportProps = {
  onImport: (csvText: string) => Promise<ImportHospitalsResult>;
  loading?: boolean;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function HospitalImport({ onImport, loading = false }: HospitalImportProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [result, setResult] = useState<ImportHospitalsResult | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) {
      setCsvText('');
      setFileName('');
      setPreviewRows([]);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError('File size exceeds 5 MB limit. Please upload a smaller file.');
      setCsvText('');
      setFileName('');
      setPreviewRows([]);
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);

      // Parse first 5 preview rows
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const parsed: string[][] = [];
      for (let i = 0; i < Math.min(6, lines.length); i++) {
        parsed.push(lines[i].split(','));
      }
      setPreviewRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (!csvText || fileError) return;
    setImporting(true);
    setFileError(null);
    try {
      const res = await onImport(csvText);
      setResult(res);
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : 'Failed to import CSV file.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* File Upload Box */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-4">
        <div>
          <label htmlFor="csv-upload" className="block text-sm font-bold text-slate-900 mb-1">
            Choose CSV File
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Expected columns: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">name,type,address,district,lat,lng,phone,services,source</code> (max 5 MB).
          </p>
          <input
            id="csv-upload"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
          />
        </div>

        {fileError && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800"
          >
            {fileError}
          </div>
        )}

        {/* First 5 rows preview */}
        {previewRows.length > 1 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>File Preview ({fileName})</span>
              <span className="text-slate-400 font-normal">First 5 rows</span>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] uppercase text-slate-600">
                  <tr>
                    {previewRows[0].map((header, i) => (
                      <th key={i} className="px-3 py-2 whitespace-nowrap">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-50">
                      {row.map((col, colIdx) => (
                        <td key={colIdx} className="px-3 py-2 whitespace-nowrap">
                          {col}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleImportSubmit}
            disabled={!csvText || Boolean(fileError) || importing || loading}
            className="flat-button-primary text-xs px-5 py-2.5"
          >
            {importing || loading ? 'Importing CSV...' : 'Import Hospitals'}
          </button>
        </div>
      </div>

      {/* Import Result Summary */}
      {result && (
        <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Import Summary
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-xs font-bold text-emerald-800">
                {result.imported} new hospitals imported
              </span>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-xs font-bold text-blue-800">
                {result.updated} hospital record{result.updated === 1 ? '' : 's'} updated
              </span>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider">
                Row Errors ({result.errors.length})
              </h4>
              <div className="border border-red-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-red-50 border-b border-red-200 text-red-900 font-semibold">
                    <tr>
                      <th className="px-3 py-2 w-24">Row</th>
                      <th className="px-3 py-2">Error Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {result.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-50/50">
                        <td className="px-3 py-2 font-mono text-red-800 font-bold whitespace-nowrap">
                          Line {err.line}
                        </td>
                        <td className="px-3 py-2 text-red-700">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
