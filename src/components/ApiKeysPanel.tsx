'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createApiKey, revokeApiKey } from '@/lib/actions/apiKeys';

export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function ApiKeysPanel({ initialKeys }: { initialKeys: ApiKeySummary[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createApiKey(name.trim());
      if (!result.success) {
        setError(result.error ?? 'Could not create key');
        return;
      }
      setRevealedKey(result.rawKey);
      setName('');
      router.refresh();
    });
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeApiKey(id);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. Zapier integration)"
          className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          onClick={handleCreate}
          disabled={isPending || !name.trim()}
          className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Create key
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {revealedKey && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            Copy this key now &mdash; it won&apos;t be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-white px-2 py-1.5 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {revealedKey}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(revealedKey)}
              className="shrink-0 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {initialKeys.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">No API keys yet.</p>
        )}
        {initialKeys.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
          >
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {key.name} {key.revokedAt && <span className="text-xs text-red-600">(revoked)</span>}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {key.keyPrefix}&hellip; · {key.lastUsedAt ? `last used ${key.lastUsedAt.slice(0, 10)}` : 'never used'}
              </p>
            </div>
            {!key.revokedAt && (
              <button
                onClick={() => handleRevoke(key.id)}
                disabled={isPending}
                className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
