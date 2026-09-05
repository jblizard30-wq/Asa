'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { setPasswordWithToken } from '@/lib/actions/users';

interface SetPasswordFormProps {
  token?: string;
  initialToken?: string;
  orgName: string;
}

function extractToken(raw?: string | null): string {
  if (!raw) return '';
  let str = raw.trim();
  if (str.includes('token=')) {
    try {
      const url = new URL(str, 'http://localhost');
      str = url.searchParams.get('token') || str;
    } catch {
      const match = str.match(/token=([A-Za-z0-9_.-]+)/);
      if (match) str = match[1];
    }
  }
  // Strip trailing punctuation from copy-pasting links embedded in sentences
  return str.replace(/[.,;:)\s]+$/, '').trim();
}

export function SetPasswordForm({ token: propToken, initialToken, orgName }: SetPasswordFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pastedInput, setPastedInput] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [showManualBox, setShowManualBox] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Progressive token detection:
  // 1. manualToken (user pasted)
  // 2. propToken / initialToken (server component prop)
  // 3. searchParams.get('token') (Next.js navigation)
  // 4. window.location.search / window.location.hash (browser fallback)
  const [clientToken, setClientToken] = useState<string>(() => {
    return extractToken(propToken || initialToken || '');
  });

  useEffect(() => {
    if (clientToken) return;

    // Check useSearchParams
    const spToken = searchParams?.get('token');
    if (spToken) {
      setClientToken(extractToken(spToken));
      return;
    }

    // Check window.location directly (handles direct query or hash routing)
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const queryToken = sp.get('token');
      if (queryToken) {
        setClientToken(extractToken(queryToken));
        return;
      }

      if (window.location.hash) {
        const hp = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const hashToken = hp.get('token');
        if (hashToken) {
          setClientToken(extractToken(hashToken));
          return;
        }
      }
    }
  }, [searchParams, clientToken]);

  const effectiveToken = manualToken || clientToken;

  if (!effectiveToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Setup Link Missing Token</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            This setup or reset link is missing a valid token. If you received this in an email or chat message, the link may have been cut off or broken across lines.
          </p>

          {showManualBox ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPasteError(null);
                const cleaned = extractToken(pastedInput);
                if (!cleaned || !cleaned.includes('.')) {
                  setPasteError('Please enter a valid link or token containing a signature.');
                  return;
                }
                setManualToken(cleaned);
              }}
              className="mt-5 space-y-3 text-left"
            >
              <div>
                <label htmlFor="pastedLink" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Paste full invitation URL or token:
                </label>
                <textarea
                  id="pastedLink"
                  rows={3}
                  value={pastedInput}
                  onChange={(e) => setPastedInput(e.target.value)}
                  placeholder="https://.../set-password?token=eyJ... or eyJ..."
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
                {pasteError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{pasteError}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-brand-600 py-2 text-xs font-medium text-white hover:bg-brand-700"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowManualBox(false);
                    setPasteError(null);
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => setShowManualBox(true)}
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Paste link or token manually
              </button>
              <Link
                href="/sign-in"
                className="inline-block w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Go to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    const result = await setPasswordWithToken(effectiveToken, password);

    if (!result.success) {
      setLoading(false);
      setError(result.error ?? 'Unable to set password. Link may be expired or already used.');
      return;
    }

    setSuccess(true);

    // Auto sign-in if email is returned
    if (result.email) {
      const signInResult = await signIn('credentials', {
        email: result.email,
        password,
        redirect: false,
      });

      if (!signInResult?.error) {
        router.push('/my-tasks');
        router.refresh();
        return;
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Set your password</h1>
        {orgName && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{orgName}</p>}

        {success ? (
          <div className="mt-6 space-y-4 text-center">
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
              Password saved successfully!
            </div>
            <Link
              href="/sign-in"
              className="inline-block w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Sign in with new password
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                placeholder="Re-enter password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Saving password…' : 'Save and continue'}
            </button>

            <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Already know your password?{' '}
              <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

