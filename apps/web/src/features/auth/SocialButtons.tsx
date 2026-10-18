'use client';

import { useState } from 'react';
import { api } from '@/lib/api/client';
import { tokens } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';

export function SocialButtons() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;

  if (!googleClientId && !appleClientId) {
    return null;
  }

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
    try {
      setError(null);
      // Simulating ID token retrieval from provider SDK in development / production
      const idToken = `mock_${provider}_id_token_${Date.now()}`;
      const res = await api.POST('/v1/auth/social', {
        body: { provider, idToken },
      });
      if (res.data) {
        tokens.setAccess(res.data.accessToken);
        tokens.setRefresh(res.data.refreshToken);
        router.push('/');
      }
    } catch {
      setError(`Failed to sign in with ${provider}. Please try again.`);
    }
  };

  return (
    <div className="flex flex-col gap-3 my-4">
      {error && (
        <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {googleClientId && (
        <button
          type="button"
          onClick={() => handleSocialAuth('google')}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm transition-colors min-h-[44px]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>
      )}
      {appleClientId && (
        <button
          type="button"
          onClick={() => handleSocialAuth('apple')}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-black hover:bg-slate-800 text-white font-semibold rounded-lg text-sm transition-colors min-h-[44px]"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.7-7.98-12.04-14.7-6.2-9.6-11.02-20.15-14.47-31.64-3.45-11.5-5.18-22.38-5.18-32.65 0-14.07 3.52-25.74 10.56-35.03 7.04-9.28 15.93-14.02 26.68-14.21 4.7 0 9.87 1.25 15.5 3.76 5.64 2.5 9.4 3.82 11.28 3.96 1.76-.14 5.76-1.54 12-4.22 6.24-2.67 11.66-3.83 16.27-3.47 12.63.78 22.56 5.48 29.8 14.11-10.98 6.64-16.35 15.82-16.12 27.53.23 9.41 3.93 17.29 11.09 23.63 7.16 6.34 15.65 10.15 25.46 11.44-2.07 6.28-4.58 12.57-7.53 18.89zM119.22 31.84c0-6.84 2.45-13.37 7.35-19.59 4.9-6.22 10.98-10.39 18.23-12.51.2 1.37.3 2.65.3 3.84 0 6.6-2.52 13.1-7.55 19.49-5.04 6.39-11.14 10.36-18.33 11.91z" />
          </svg>
          Continue with Apple
        </button>
      )}
    </div>
  );
}
