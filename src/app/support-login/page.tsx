'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function SupportLoginInner() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing token.');
      return;
    }

    signIn('credentials', { supportToken: token, callbackUrl: '/my-tasks' }).then((result) => {
      if (result?.error) setError('This link is invalid or has expired.');
    });
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <p className="text-sm text-slate-500">{error ?? 'Signing in…'}</p>
    </div>
  );
}

export default function SupportLoginPage() {
  return (
    <Suspense fallback={null}>
      <SupportLoginInner />
    </Suspense>
  );
}
