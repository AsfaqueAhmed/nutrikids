'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAdminSession } from '@/features/auth/useAdminSession';
import { copy } from '@/lib/copy';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { status, login } = useAdminSession();
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authed') {
      router.push('/');
    }
  }, [status, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setApiError(null);
    try {
      await login(values.email, values.password);
      router.push('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError('Authentication failed. Please verify your credentials.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-600 text-white font-bold text-xl shadow-xs">
            N
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {copy.login.title}
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            {copy.login.subtitle}
          </p>
        </div>

        {apiError && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-800"
          >
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              {copy.login.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="admin@nutrikids.com"
              {...register('email')}
              className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.email && (
              <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              {copy.login.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {errors.password && (
              <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm border border-emerald-700 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {isSubmitting ? copy.login.submitting : copy.login.submit}
          </button>
        </form>

        <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-100">
          Strict access control enforced. All actions are logged and audited.
        </div>
      </div>
    </div>
  );
}
