import crypto from 'crypto';

export interface SupportTokenPayload {
  email: string;
  role: string;
  exp: number; // unix seconds
  jti: string;
}

/**
 * Verifies an HQ-minted "log in as admin" token: HMAC signature (against this
 * deployment's own HQ_SUPPORT_SECRET, so a leaked secret only ever grants
 * access to the one deployment it belongs to) and expiry. Does NOT check
 * single-use — that's enforced by inserting the jti into SupportLoginToken
 * under its unique constraint, done by the caller (src/lib/auth.ts), since
 * that's the atomic step and belongs next to the Prisma call.
 */
export function verifySupportToken(token: string, secret: string): SupportTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }
  if (expectedSig.length !== providedSig.length || !crypto.timingSafeEqual(expectedSig, providedSig)) {
    return null;
  }

  let payload: SupportTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
  if (!payload.jti || !payload.email || !payload.role) return null;

  return payload;
}
