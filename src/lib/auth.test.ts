import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';

// Models the two Prisma calls `authorizeSupportToken` makes, backed by in-memory state that
// mirrors the real DB semantics the source code depends on:
//   - `supportLoginToken.create` throws on a duplicate `jti`, modeling the unique constraint on
//     SupportLoginToken.jti that is the *only* single-use guard (see supportLogin.ts + auth.ts).
//   - `user.upsert` only creates when the keyed email is absent; if a user already exists it is
//     returned UNCHANGED (matching the real call's `update: {}`).
const state = vi.hoisted(() => ({
  tokens: new Set<string>(),
  users: new Map<
    string,
    { id: string; name: string; email: string; role: string; passwordHash: string }
  >(),
  userIdCounter: 0,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    supportLoginToken: {
      create: vi.fn(async ({ data }: { data: { jti: string } }) => {
        if (state.tokens.has(data.jti)) {
          throw new Error('Unique constraint failed on the fields: (`jti`)');
        }
        state.tokens.add(data.jti);
        return { id: `tok-${data.jti}`, jti: data.jti, usedAt: new Date() };
      }),
    },
    user: {
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { email: string };
          update: Record<string, never>;
          create: { email: string; name: string; passwordHash: string; role: string };
        }) => {
          const existing = state.users.get(where.email);
          if (existing) return existing;
          const user = { id: `user-${++state.userIdCounter}`, ...create };
          state.users.set(where.email, user);
          return user;
        }
      ),
    },
  },
}));

// Do NOT mock '@/lib/supportLogin' — mint real tokens against the real verifySupportToken so
// signature/expiry verification is exercised end-to-end, not assumed.
import { authorizeSupportToken } from './auth';
import { prisma } from '@/lib/prisma';

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

// Wire format from supportLogin.ts: "<base64url payload>.<base64url HMAC-SHA256 signature>",
// signature computed over the payload's base64url text (not the raw JSON).
function mintToken(secret: string, payload: Record<string, unknown>): string {
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  return `${payloadB64}.${base64url(sig)}`;
}

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600;
}

const SECRET = 'hq-test-secret';

describe('authorizeSupportToken', () => {
  beforeEach(() => {
    state.tokens.clear();
    state.users.clear();
    state.userIdCounter = 0;
    vi.clearAllMocks();
    process.env.HQ_SUPPORT_SECRET = SECRET;
  });

  it('creates the SupportLoginToken row and upserts+returns a new admin user for a valid ADMIN token', async () => {
    const token = mintToken(SECRET, {
      email: 'admin@example.com',
      role: 'ADMIN',
      exp: futureExp(),
      jti: 'jti-1',
    });

    const result = await authorizeSupportToken(token);

    expect(result).toEqual({
      id: expect.any(String),
      name: 'Support Admin',
      email: 'admin@example.com',
      role: 'ADMIN',
    });
    expect(state.tokens.has('jti-1')).toBe(true);
    expect(state.users.size).toBe(1);
    expect(prisma.supportLoginToken.create).toHaveBeenCalledWith({ data: { jti: 'jti-1' } });
    expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
  });

  it('rejects a replay of the exact same token/jti, and never creates a second user', async () => {
    const token = mintToken(SECRET, {
      email: 'admin@example.com',
      role: 'ADMIN',
      exp: futureExp(),
      jti: 'jti-replay',
    });

    const first = await authorizeSupportToken(token);
    expect(first).not.toBeNull();

    const second = await authorizeSupportToken(token);
    expect(second).toBeNull();

    expect(state.users.size).toBe(1);
    // The replay's create() throw short-circuits before the upsert is ever reached again.
    expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
  });

  it('reuses the existing user (same id, no duplicate) for a second, freshly-minted token with a different jti for the same email', async () => {
    const token1 = mintToken(SECRET, {
      email: 'admin@example.com',
      role: 'ADMIN',
      exp: futureExp(),
      jti: 'jti-a',
    });
    const token2 = mintToken(SECRET, {
      email: 'admin@example.com',
      role: 'ADMIN',
      exp: futureExp(),
      jti: 'jti-b',
    });

    const first = await authorizeSupportToken(token1);
    const second = await authorizeSupportToken(token2);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second!.id).toBe(first!.id);
    expect(state.users.size).toBe(1);
    expect(prisma.user.upsert).toHaveBeenCalledTimes(2);
  });

  it('rejects a non-ADMIN role token without consuming its jti, so a later ADMIN token reusing that jti still succeeds', async () => {
    // Source checks `payload.role !== 'ADMIN'` and returns null BEFORE the try/create block —
    // confirmed by reading auth.ts — so a rejected non-admin token must never touch the jti table.
    const sharedJti = 'jti-shared';
    const userToken = mintToken(SECRET, {
      email: 'someone@example.com',
      role: 'USER',
      exp: futureExp(),
      jti: sharedJti,
    });

    const rejected = await authorizeSupportToken(userToken);
    expect(rejected).toBeNull();
    expect(state.tokens.has(sharedJti)).toBe(false);
    expect(prisma.supportLoginToken.create).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();

    const adminToken = mintToken(SECRET, {
      email: 'someone@example.com',
      role: 'ADMIN',
      exp: futureExp(),
      jti: sharedJti,
    });
    const accepted = await authorizeSupportToken(adminToken);
    expect(accepted).not.toBeNull();
    expect(state.tokens.has(sharedJti)).toBe(true);
    expect(prisma.supportLoginToken.create).toHaveBeenCalledWith({ data: { jti: sharedJti } });
  });

  it('returns null without ever calling prisma when HQ_SUPPORT_SECRET is unset', async () => {
    delete process.env.HQ_SUPPORT_SECRET;
    const token = mintToken(SECRET, {
      email: 'admin@example.com',
      role: 'ADMIN',
      exp: futureExp(),
      jti: 'jti-no-secret',
    });

    const result = await authorizeSupportToken(token);

    expect(result).toBeNull();
    expect(prisma.supportLoginToken.create).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = mintToken('a-totally-different-secret', {
      email: 'admin@example.com',
      role: 'ADMIN',
      exp: futureExp(),
      jti: 'jti-wrong-secret',
    });

    const result = await authorizeSupportToken(token);

    expect(result).toBeNull();
    expect(prisma.supportLoginToken.create).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('lowercases/trims the email so it matches an existing user keyed by the lowercased-trimmed form', async () => {
    const token1 = mintToken(SECRET, {
      email: 'admin@example.com',
      role: 'ADMIN',
      exp: futureExp(),
      jti: 'jti-case-1',
    });
    const first = await authorizeSupportToken(token1);
    expect(first).not.toBeNull();

    const token2 = mintToken(SECRET, {
      email: '  Admin@Example.com  ',
      role: 'ADMIN',
      exp: futureExp(),
      jti: 'jti-case-2',
    });
    const second = await authorizeSupportToken(token2);

    expect(second).not.toBeNull();
    expect(second!.email).toBe('admin@example.com');
    expect(second!.id).toBe(first!.id);
    expect(state.users.size).toBe(1);
  });
});
