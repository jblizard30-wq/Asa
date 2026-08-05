import crypto from 'crypto';

/**
 * Validates the `Authorization: Bearer <CRON_SECRET>` header shared by every /api/cron/* route.
 * Uses a length-independent, constant-time comparison rather than `!==` — a plain string compare
 * leaks how many leading bytes matched via response timing, which a byte-at-a-time attack over
 * enough requests can exploit to recover the secret.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const provided = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
}
