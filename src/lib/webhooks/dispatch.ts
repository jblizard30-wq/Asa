import crypto from 'crypto';
import { WebhookEvent } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertPublicHttpUrl } from '@/lib/urlSafety';

const DELIVERY_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;

function signPayload(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// fetch() follows redirects by default, which would let a validated public URL hop to an
// internal/metadata address at request time. We re-validate every redirect target ourselves
// before following it, so the SSRF guard in urlSafety.ts can't be bypassed via a 3xx response.
async function deliver(url: string, secret: string, body: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    let currentUrl = url;
    for (let redirects = 0; ; redirects++) {
      try {
        await assertPublicHttpUrl(currentUrl);
      } catch (err) {
        console.error('Webhook delivery blocked: unsafe URL', currentUrl, err);
        return;
      }

      const res = await fetch(currentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signPayload(secret, body),
        },
        body,
        redirect: 'manual',
        signal: controller.signal,
      });

      if (res.status < 300 || res.status >= 400 || !res.headers.get('location')) return;

      if (redirects >= MAX_REDIRECTS) {
        console.error('Webhook delivery blocked: too many redirects', url);
        return;
      }
      currentUrl = new URL(res.headers.get('location')!, currentUrl).toString();
    }
  } catch (err) {
    console.error('Webhook delivery failed', url, err);
  } finally {
    clearTimeout(timeout);
  }
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
