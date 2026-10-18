'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api/client';
import { toProblem } from '@/lib/api/errors';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token.');
      return;
    }

    const verify = async () => {
      try {
        const res = await api.POST('/v1/auth/verify-email', {
          body: { token },
        });
        if (!res.response.ok) {
          setStatus('error');
          setMessage(
            toProblem(res.response, res.error).message || 'Verification link expired or already used.',
          );
        } else {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
        }
      } catch {
        setStatus('error');
        setMessage('Network error during verification. Please try again.');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 text-center">
        <div className="inline-flex w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 items-center justify-center text-2xl mb-4">
          {status === 'verifying' ? '⏳' : status === 'success' ? '✅' : '❌'}
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Email Verification</h1>
        <p className="text-sm text-slate-600 mb-6">{message}</p>

        {status === 'success' && (
          <Link
            href="/login"
            className="inline-block w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm border border-emerald-700 transition-colors"
          >
            Continue to Sign in
          </Link>
        )}

        {status === 'error' && (
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-block w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-sm border border-slate-300 transition-colors"
            >
              Back to Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            Verifying email...
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

