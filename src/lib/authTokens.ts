import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import type { User } from '@prisma/client';

export type AuthTokenType = 'INVITE' | 'PASSWORD_RESET';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  type: AuthTokenType;
  exp: number; // unix seconds
}

export interface VerifyTokenResult {
  valid: boolean;
  user?: User;
  payload?: AuthTokenPayload;
  error?: string;
}

const DEFAULT_SECRET = 'asa-insecure-dev-auth-secret-change-in-prod';

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || DEFAULT_SECRET;
}

/**
 * Computes an HMAC-SHA256 signature combining the application secret and the user's current
 * password hash. When the user sets or changes their password, `user.passwordHash` updates,
 * immediately and automatically invalidating any previously issued tokens without requiring
 * database table state or cleanup cron jobs.
 */
function computeSignature(payload: AuthTokenPayload, userPasswordHash: string, secret: string): Buffer {
  const message = `${payload.userId}:${payload.email.toLowerCase()}:${userPasswordHash}:${payload.type}:${payload.exp}`;
  return crypto.createHmac('sha256', secret).update(message).digest();
}

/**
 * Generates a signed token for user invitations (7-day default) or password resets (24-hour default).
 */
export function generateAuthToken(
  user: { id: string; email: string; passwordHash: string },
  type: AuthTokenType,
  expiresInSeconds?: number,
): string {
  const defaultExpiry = type === 'INVITE' ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
  const exp = Math.floor(Date.now() / 1000) + (expiresInSeconds ?? defaultExpiry);

  const payload: AuthTokenPayload = {
    userId: user.id,
    email: user.email.toLowerCase().trim(),
    type,
    exp,
  };

  const secret = getSecret();
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = computeSignature(payload, user.passwordHash, secret);
  const sigB64 = sig.toString('base64url');

  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies a token's format, expiration, HMAC signature, and user existence.
 * Returns the matching User record if valid.
 */
export async function verifyAuthToken(
  token: string,
  expectedType?: AuthTokenType,
): Promise<VerifyTokenResult> {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing or invalid token.' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed token.' };
  }

  const [payloadB64, sigB64] = parts;

  let payload: AuthTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, error: 'Invalid token payload.' };
  }

  if (!payload.userId || !payload.email || !payload.type || !payload.exp) {
    return { valid: false, error: 'Incomplete token payload.' };
  }

  if (expectedType && payload.type !== expectedType) {
    return { valid: false, error: 'Invalid token purpose.' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return { valid: false, error: 'This link has expired. Please request a new one.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || user.email.toLowerCase().trim() !== payload.email.toLowerCase().trim()) {
    return { valid: false, error: 'User not found or email mismatch.' };
  }

  const secret = getSecret();
  const expectedSig = computeSignature(payload, user.passwordHash, secret);

  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return { valid: false, error: 'Invalid token signature format.' };
  }

  if (expectedSig.length !== providedSig.length || !crypto.timingSafeEqual(expectedSig, providedSig)) {
    return { valid: false, error: 'This link has already been used or is invalid.' };
  }

  return { valid: true, user, payload };
}

