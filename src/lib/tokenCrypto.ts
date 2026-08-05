import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY is not configured');
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32) {
    throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key (openssl rand -base64 32)');
  }
  return key;
}

/**
 * Encrypts a calendar OAuth token (Google/Outlook access/refresh tokens) before it's stored on
 * CalendarConnection, so a database compromise doesn't hand over live third-party calendar access
 * for every connected user. AES-256-GCM with a random IV per call; output is `iv.authTag.ciphertext`
 * (each base64), self-contained so decryptToken needs nothing but the stored string and the key.
 */
export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString('base64')).join('.');
}

export function decryptToken(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split('.');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Stored token is not in the expected encrypted format');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
  return plaintext.toString('utf8');
}

export function encryptTokenOrNull(plaintext: string | null | undefined): string | null | undefined {
  if (plaintext == null) return plaintext;
  return encryptToken(plaintext);
}

export function decryptTokenOrNull(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  return decryptToken(stored);
}
