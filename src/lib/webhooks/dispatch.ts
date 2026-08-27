import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { WebhookEvent } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolvePinnedAddress } from '@/lib/webhooks/urlSafety';

const DELIVERY_TIMEOUT_MS = 5000;

function signPayload(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function deliver(url: string, secret: string, body: string) {
  // Re-checked here, not just at registration — DNS for the webhook's host can be repointed at
  // an internal address after the webhook was created.
  let target: Awaited<ReturnType<typeof resolvePinnedAddress>>;
  try {
    target = await resolvePinnedAddress(url);
  } catch (err) {
    console.error('Webhook delivery blocked: unsafe URL', url, err);
    return;
  }
  const { url: parsed, address } = target;
  const client = parsed.protocol === 'https:' ? https : http;

  await new Promise<void>((resolve) => {
    const req = client.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Webhook-Signature': signPayload(secret, body),
        },
        timeout: DELIVERY_TIMEOUT_MS,
        // Pin the connection to the address validated above instead of letting Node resolve
        // parsed.hostname again — that second, unpinned lookup is exactly the DNS-rebinding gap
        // resolvePinnedAddress exists to close. http.request never follows redirects on its
        // own, so this also closes the matching bypass where a webhook responds with a redirect
        // to a target this check never saw.
        lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      },
      (res) => {
        res.resume();
        resolve();
      }
    );
    req.on('timeout', () => req.destroy(new Error('Webhook delivery timed out')));
    req.on('error', (err) => {
      console.error('Webhook delivery failed', url, err);
      resolve();
    });
    req.write(body);
    req.end();
  });
}

/**
 * Fire-and-forget, same idiom as sendNotificationEmail: callers are mid-mutation and must never
 * be slowed down or failed by a dead/slow webhook endpoint.
 */
export async function dispatchWebhooks(event: WebhookEvent, payload: unknown) {
  const webhooks = await prisma.webhook.findMany({
    where: { isActive: true, events: { has: event } },
  });
  if (webhooks.length === 0) return;

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });

  for (const webhook of webhooks) {
    void deliver(webhook.url, webhook.secret, body);
  }
}
