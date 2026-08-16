import crypto from 'crypto';
import { WebhookEvent } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertPublicHttpUrl } from '@/lib/webhooks/urlSafety';

const DELIVERY_TIMEOUT_MS = 5000;

function signPayload(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function deliver(url: string, secret: string, body: string) {
  // Re-checked here, not just at registration — DNS for the webhook's host can be repointed at
  // an internal address after the webhook was created. `redirect: 'error'` closes the matching
  // bypass where a webhook responds with a redirect to a target this check never saw.
  try {
    await assertPublicHttpUrl(url);
  } catch (err) {
    console.error('Webhook delivery blocked: unsafe URL', url, err);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signPayload(secret, body),
      },
      body,
      redirect: 'error',
      signal: controller.signal,
    });
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
