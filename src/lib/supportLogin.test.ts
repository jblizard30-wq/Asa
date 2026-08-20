import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { verifySupportToken } from './supportLogin';

const SECRET = 'hq-support-secret-for-tests';
const OTHER_SECRET = 'a-completely-different-deployment-secret';

/**
 * Mints a token exactly the way the (separate, vendor-owned) HQ app would, per the wire
 * format documented in src/lib/supportLogin.ts:
 *
 *   token = base64url(payloadBytes) + '.' + base64url(HMAC-SHA256(secret, payloadB64string))
 *
 * Note the HMAC is computed over the base64url *string* of the payload (i.e.
 * `.update(payloadB64)` where payloadB64 is a string), not over the raw payload bytes —
 * mirrored here to match src/lib/supportLogin.ts's verify implementation exactly.
 */
function signPayloadBytes(payloadBytes: Buffer, secret: string): string {
  const payloadB64 = payloadBytes.toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  const sigB64 = sig.toString('base64url');
  return `${payloadB64}.${sigB64}`;
}

function mintToken(payload: Record<string, unknown>, secret: string = SECRET): string {
  return signPayloadBytes(Buffer.from(JSON.stringify(payload), 'utf8'), secret);
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: 'admin@example.com',
    role: 'ADMIN',
    exp: Math.floor(Date.now() / 1000) + 3600,
    jti: 'jti-123',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('verifySupportToken', () => {
  it('round-trips a validly signed, unexpired token to its exact payload', () => {
    const payload = validPayload();
    const token = mintToken(payload);

    expect(verifySupportToken(token, SECRET)).toEqual(payload);
  });

  it('rejects a token whose exp is in the past', () => {
    const payload = validPayload({ exp: Math.floor(Date.now() / 1000) - 3600 });
    const token = mintToken(payload);

    expect(verifySupportToken(token, SECRET)).toBeNull();
  });

  describe('expiry boundary', () => {
    it('accepts a token whose exp exactly equals the current time (not yet expired)', () => {
      const nowMs = 1_700_000_000_000; // multiple of 1000, so /1000 is an exact integer
      vi.spyOn(Date, 'now').mockReturnValue(nowMs);
      const nowSeconds = nowMs / 1000;

      const payload = validPayload({ exp: nowSeconds });
      const token = mintToken(payload);

      expect(verifySupportToken(token, SECRET)).toEqual(payload);
    });

    it('rejects a token whose exp is one second before the current time', () => {
      const nowMs = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(nowMs);
      const nowSeconds = nowMs / 1000;

      const payload = validPayload({ exp: nowSeconds - 1 });
      const token = mintToken(payload);

      expect(verifySupportToken(token, SECRET)).toBeNull();
    });
  });

  it('rejects a token signed with a different secret (cross-deployment secret)', () => {
    const payload = validPayload();
    const token = mintToken(payload, OTHER_SECRET);

    expect(verifySupportToken(token, SECRET)).toBeNull();
  });

  it('rejects a token whose payload was tampered with after signing', () => {
    const payload = validPayload();
    const token = mintToken(payload);
    const [, sigB64] = token.split('.');

    const tamperedPayloadB64 = Buffer.from(
      JSON.stringify({ ...payload, role: 'SUPERADMIN' }),
      'utf8',
    ).toString('base64url');
    const tamperedToken = `${tamperedPayloadB64}.${sigB64}`;

    expect(verifySupportToken(tamperedToken, SECRET)).toBeNull();
  });

  describe('malformed token structure', () => {
    it('rejects a token with no "." separator', () => {
      const token = Buffer.from(JSON.stringify(validPayload()), 'utf8').toString('base64url');
      expect(verifySupportToken(token, SECRET)).toBeNull();
    });

    it('rejects a token with too many "." separators', () => {
      const token = mintToken(validPayload());
      expect(verifySupportToken(`${token}.extra`, SECRET)).toBeNull();
    });

    it('rejects an empty string', () => {
      expect(verifySupportToken('', SECRET)).toBeNull();
    });
  });

  describe('required payload fields', () => {
    it('rejects a payload missing jti', () => {
      const payload = validPayload();
      delete (payload as Record<string, unknown>).jti;
      const token = mintToken(payload);

      expect(verifySupportToken(token, SECRET)).toBeNull();
    });

    it('rejects a payload missing email', () => {
      const payload = validPayload();
      delete (payload as Record<string, unknown>).email;
      const token = mintToken(payload);

      expect(verifySupportToken(token, SECRET)).toBeNull();
    });

    it('rejects a payload missing role', () => {
      const payload = validPayload();
      delete (payload as Record<string, unknown>).role;
      const token = mintToken(payload);

      expect(verifySupportToken(token, SECRET)).toBeNull();
    });
  });

  it('rejects a payload whose exp is not a number', () => {
    const payload = validPayload({ exp: 'soon' });
    const token = mintToken(payload);

    expect(verifySupportToken(token, SECRET)).toBeNull();
  });

  it('rejects a signature that is valid base64url but the wrong byte length, without throwing', () => {
    const payload = validPayload();
    const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    // 16 arbitrary bytes, valid base64url, but not the 32-byte length of a SHA-256 HMAC —
    // must be rejected via the length check before timingSafeEqual (which throws on mismatched
    // lengths), not by an exception propagating out of verifySupportToken.
    const wrongLengthSigB64 = crypto.randomBytes(16).toString('base64url');
    const token = `${payloadB64}.${wrongLengthSigB64}`;

    let result: unknown;
    expect(() => {
      result = verifySupportToken(token, SECRET);
    }).not.toThrow();
    expect(result).toBeNull();
  });

  it('rejects a payloadB64 that decodes to invalid JSON, without throwing', () => {
    // Sign raw garbage bytes directly (not JSON.stringify output) so the signature is valid
    // for these exact bytes, but decoding them as UTF-8 and JSON.parse-ing must fail.
    const garbageBytes = Buffer.from([0xff, 0xfe, 0xfd, 0x00, 0x01, 0x02, 0x7b, 0x3a]);
    const token = signPayloadBytes(garbageBytes, SECRET);

    let result: unknown;
    expect(() => {
      result = verifySupportToken(token, SECRET);
    }).not.toThrow();
    expect(result).toBeNull();
  });
});
