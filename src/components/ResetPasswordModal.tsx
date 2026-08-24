'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminResetPassword, sendUserPasswordReset } from '@/lib/actions/users';
import type { ManagedUser } from './UserManagement';

interface ResetPasswordModalProps {
  user: ManagedUser;
  onClose: () => void;
  onShowLinkModal?: (title: string, link: string, message: string) => void;
}

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  let password = '';
  for (let i = 0; i < 14; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function ResetPasswordModal({ user, onClose, onShowLinkModal }: ResetPasswordModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'MANUAL' | 'EMAIL'>('MANUAL');
  const [manualPassword, setManualPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleGenerate() {
    const generated = generateSecurePassword();
    setManualPassword(generated);
    setCopied(false);
  }

  async function handleCopy() {
    if (!manualPassword) return;
    try {
      await navigator.clipboard.writeText(manualPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore clipboard error
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!manualPassword || manualPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    const result = await adminResetPassword(user.id, manualPassword);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Could not reset password.');
      return;
    }

    setSuccessMessage(`Password updated for ${user.name}. Make sure to share the new password with them.`);
    router.refresh();
  }

  async function handleSendEmail() {
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const result = await sendUserPasswordReset(user.id);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Failed to send password reset email.');
      return;
    }

    router.refresh();

    if (onShowLinkModal && result.resetUrl) {
      onClose();
      onShowLinkModal(
        'Password Reset Link Generated',
        result.resetUrl,
        `A password reset email was sent to ${user.email}. You can also copy the direct link below:`,
      );
    } else {
      setSuccessMessage(`Password reset email sent to ${user.email}.`);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reset Password</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage password for <strong className="text-slate-700 dark:text-slate-300">{user.name}</strong> ({user.email})
        </p>

        {/* Tab navigation */}
        <div className="mt-4 flex border-b border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setTab('MANUAL');
              setError(null);
              setSuccessMessage(null);
            }}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'MANUAL'
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Set manually
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('EMAIL');
              setError(null);
              setSuccessMessage(null);
            }}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'EMAIL'
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Send email link
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {successMessage && (
          <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
            {successMessage}
          </div>
        )}

        {tab === 'MANUAL' ? (
          <form onSubmit={handleManualSubmit} className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="reset-pass">
                  New temporary password
                </label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  ⚡ Generate random
                </button>
              </div>
              <div className="mt-1 flex gap-2">
                <input
                  id="reset-pass"
                  type="text"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  placeholder="Enter or generate password"
                  required
                  minLength={8}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                />
                {manualPassword && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                At least 8 characters. You can copy and share this directly with the user.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !manualPassword}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? 'Saving…' : 'Save password'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              An email will be sent to <strong className="text-slate-800 dark:text-slate-200">{user.email}</strong> with a secure, single-use password reset link valid for 24 hours.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={loading}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? 'Sending email…' : 'Send reset email'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

