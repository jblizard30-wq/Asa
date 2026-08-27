import crypto from 'crypto';

/**
 * Constant-time check of the cron endpoint's bearer token against CRON_SECRET, matching the
 * timingSafeEqual pattern used for support-login and auth-token signatures elsewhere. Fails
 * closed (returns false) if CRON_SECRET isn't configured, so a missing secret never becomes an
 * "any request is authorized" bug.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(authHeader);
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}
