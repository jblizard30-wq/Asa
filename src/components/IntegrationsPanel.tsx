'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { disconnectConnection } from '@/lib/actions/calendarConnections';

export interface IntegrationConnection {
  id: string;
  provider: 'GOOGLE' | 'OUTLOOK';
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface IntegrationProviderInfo {
  provider: 'GOOGLE' | 'OUTLOOK';
  name: string;
  configured: boolean;
  connectHref: string;
}

export function IntegrationsPanel({
  providers,
  connections,
}: {
  providers: IntegrationProviderInfo[];
  connections: IntegrationConnection[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDisconnect(id: string) {
    startTransition(async () => {
      await disconnectConnection(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {providers.map((provider) => {
        const connection = connections.find((c) => c.provider === provider.provider);
        return (
          <div
            key={provider.provider}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{provider.name}</p>
                {!provider.configured ? (
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Not configured</p>
                ) : connection ? (
                  <p className="mt-1 text-xs text-green-700 dark:text-green-400">Connected</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Not connected</p>
                )}
              </div>

              {provider.configured &&
                (connection ? (
                  <button
                    onClick={() => handleDisconnect(connection.id)}
                    disabled={isPending}
                    className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Disconnect
                  </button>
                ) : (
                  <a
                    href={provider.connectHref}
                    className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Connect
                  </a>
                ))}
            </div>

            {connection && (
              <p className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                Sync is not yet active. Connecting stores access for a future sync feature, but no events are
                imported or exported today.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
