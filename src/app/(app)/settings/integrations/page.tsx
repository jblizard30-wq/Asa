import { listConnections } from '@/lib/actions/calendarConnections';
import { IntegrationsPanel } from '@/components/IntegrationsPanel';

const ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: 'Google Calendar is not configured on this server yet.',
  google_oauth_failed: 'Connecting to Google Calendar failed. Please try again.',
  outlook_not_configured: 'Outlook Calendar is not configured on this server yet.',
  outlook_oauth_failed: 'Connecting to Outlook Calendar failed. Please try again.',
};

export default async function SettingsIntegrationsPage({
  searchParams,
}: {
  searchParams: { error?: string; connected?: string };
}) {
  const connections = await listConnections();
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  const providers = [
    {
      provider: 'GOOGLE' as const,
      name: 'Google Calendar',
      configured: Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID),
      connectHref: '/api/integrations/google/connect',
    },
    {
      provider: 'OUTLOOK' as const,
      name: 'Outlook Calendar',
      configured: Boolean(process.env.OUTLOOK_CALENDAR_CLIENT_ID),
      connectHref: '/api/integrations/outlook/connect',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Integrations</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Connect external calendars. Sync is not yet active for any provider.
      </p>

      {errorMessage && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {errorMessage}
        </p>
      )}
      {searchParams.connected && !errorMessage && (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
          Connected successfully.
        </p>
      )}

      <div className="mt-6 max-w-xl">
        <IntegrationsPanel
          providers={providers}
          connections={connections.map((c) => ({
            id: c.id,
            provider: c.provider,
            lastSyncedAt: c.lastSyncedAt,
            createdAt: c.createdAt,
          }))}
        />
      </div>
    </div>
  );
}
