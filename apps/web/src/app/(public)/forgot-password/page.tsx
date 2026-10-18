'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { api } from '@/lib/api/client';

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (values: ForgotFormValues) => {
    try {
      await api.POST('/v1/auth/forgot-password', {
        body: { email: values.email },
      });
    } catch {
      // Intentionally silent per security standard
    } finally {
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex w-10 h-10 rounded-lg bg-emerald-600 items-center justify-center text-white font-bold text-xl mb-3">
            N
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reset your password</h1>
          <p className="text-sm text-slate-600 mt-1">
            Enter your email and we will send you password reset instructions.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg">
              If an account with that email exists, we have sent a password reset link to it. Please check your inbox and spam folders.
            </div>
            <Link
              href="/login"
              className="inline-block w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm border border-emerald-700 text-center transition-colors"
            >
              Return to Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 min-h-[44px]"
              />
              {errors.email && (
                <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm border border-emerald-700 transition-colors min-h-[44px]"
            >
              {isSubmitting ? 'Sending instructions...' : 'Send Reset Link'}
            </button>

            <div className="pt-4 text-center">
              <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
                ← Back to Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
