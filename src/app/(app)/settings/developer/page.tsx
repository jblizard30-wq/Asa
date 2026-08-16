import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listApiKeys } from '@/lib/actions/apiKeys';
import { listWebhooks } from '@/lib/actions/webhooks';
import { ApiKeysPanel } from '@/components/ApiKeysPanel';
import { WebhooksPanel } from '@/components/WebhooksPanel';

export default async function SettingsDeveloperPage() {
  const [session, apiKeys, webhooks] = await Promise.all([
    getServerSession(authOptions),
    listApiKeys(),
    listWebhooks(),
  ]);
  const isAdmin = session?.user.role === 'ADMIN';

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Developer</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          API keys and webhooks for integrating with the public API at <code>/api/v1</code>.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">API keys</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Use a key as a Bearer token: <code>Authorization: Bearer &lt;key&gt;</code>.
        </p>
        <div className="mt-4 max-w-xl">
          <ApiKeysPanel initialKeys={apiKeys} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Webhooks</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          We&apos;ll POST a JSON payload to your URL and sign it with{' '}
          <code>X-Webhook-Signature</code> (HMAC-SHA256 of the body, using your secret). Webhooks
          receive events across every project org-wide, so only admins can create them.
        </p>
        <div className="mt-4 max-w-xl">
          <WebhooksPanel initialWebhooks={webhooks} canCreate={isAdmin} />
        </div>
      </section>
    </div>
  );
}
