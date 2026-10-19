'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export type SignupsChartProps = {
  data: { date: string; count: number }[];
};

export function SignupsChart({ data }: SignupsChartProps) {
  const totalSignups = data.reduce((acc, curr) => acc + curr.count, 0);

  if (!data || data.length === 0 || totalSignups === 0) {
    return (
      <div className="flat-card p-8 text-center border border-slate-200 bg-white rounded-xl">
        <p className="text-sm font-semibold text-slate-600">
          No sign-ups in the last 30 days.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          New registered parent and staff accounts will display here.
        </p>
      </div>
    );
  }

  const ariaLabel = `New sign-ups in the last 30 days: ${totalSignups} total`;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="flat-card p-5 border border-slate-200 bg-white rounded-xl space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            User Registrations
          </h2>
          <p className="text-xs text-slate-500">
            Daily parent & staff registrations
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
          {totalSignups} total
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: string) => {
                const parts = val.split('-');
                return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : val;
              }}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                fontSize: '12px',
                fontWeight: '600',
                boxShadow: 'none',
              }}
              labelStyle={{ color: '#0f172a' }}
            />
            <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Visually hidden table for screen readers (WCAG 2.1 AA) */}
      <div className="sr-only">
        <table>
          <caption>Daily Sign-ups Data</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.date}>
                <td>{item.date}</td>
                <td>{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
