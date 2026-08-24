'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { setPasswordWithToken } from '@/lib/actions/users';

interface SetPasswordFormProps {
  token: string;
  orgName: string;
}

export function SetPasswordForm({ token, orgName }: SetPasswordFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Invalid Link</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            This setup or reset link is missing a valid token. Please contact your workspace administrator for a new invitation.
          </p>
          <div className="mt-6">
            <Link
              href="/sign-in"
              className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Go to sign in
            </Link>
          </div>
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
    const result = await setPasswordWithToken(token, password);

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

