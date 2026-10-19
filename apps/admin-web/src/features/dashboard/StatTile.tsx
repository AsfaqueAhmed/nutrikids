import React from 'react';

export type StatTileProps = {
  label: string;
  value: number;
  hint?: string;
  icon?: string;
  className?: string;
};

export function StatTile({ label, value, hint, icon, className = '' }: StatTileProps) {
  const formattedValue = value.toLocaleString('en-US');

  return (
    <div
      className={`flat-card p-5 space-y-2 border border-slate-200 bg-white rounded-xl ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-lg" aria-hidden="true">{icon}</span>}
      </div>
      <div className="text-3xl font-extrabold tracking-tight text-slate-900">
        {formattedValue}
      </div>
      {hint && (
        <p className="text-xs text-slate-500 font-medium">
          {hint}
        </p>
      )}
    </div>
  );
}
