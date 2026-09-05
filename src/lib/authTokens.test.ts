import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAuthToken, verifyAuthToken } from './authTokens';
import { prisma } from './prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('authTokens', () => {
  const mockUser = {
    id: 'user-123',
    email: 'jane@example.org',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
    name: 'Jane Smith',
    role: 'USER' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'test-secret-do-not-use-in-prod';
  });

  it('generates a valid invite token and verifies it', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

    const token = generateAuthToken(mockUser, 'INVITE', 3600);
    expect(token).toContain('.');

    const result = await verifyAuthToken(token, 'INVITE');
    expect(result.valid).toBe(true);
    expect(result.user?.id).toBe(mockUser.id);
    expect(result.payload?.type).toBe('INVITE');
  });

  it('generates a valid password reset token and verifies it', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

    const token = generateAuthToken(mockUser, 'PASSWORD_RESET', 3600);
    const result = await verifyAuthToken(token, 'PASSWORD_RESET');
    expect(result.valid).toBe(true);
    expect(result.user?.id).toBe(mockUser.id);
    expect(result.payload?.type).toBe('PASSWORD_RESET');
  });

  it('rejects expired tokens', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

    const token = generateAuthToken(mockUser, 'INVITE', -10); // already expired
    const result = await verifyAuthToken(token, 'INVITE');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it('rejects when token purpose does not match expectedType', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

    const token = generateAuthToken(mockUser, 'INVITE', 3600);
    const result = await verifyAuthToken(token, 'PASSWORD_RESET');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/purpose/i);
  });

  it('rejects tampered tokens', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

    const token = generateAuthToken(mockUser, 'INVITE', 3600);
    const [payloadB64, sigB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    payload.email = 'attacker@example.org';
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tamperedToken = `${tamperedPayloadB64}.${sigB64}`;

    const result = await verifyAuthToken(tamperedToken, 'INVITE');
    expect(result.valid).toBe(false);
  });

  it('automatically invalidates tokens when passwordHash changes', async () => {
    // 1. Generate token with old password hash
    const token = generateAuthToken(mockUser, 'PASSWORD_RESET', 3600);

    // 2. User sets new password -> passwordHash changes in database
    const updatedUser = {
      ...mockUser,
      passwordHash: '$2a$10$NEW_HASH_9876543210zyxwvutsrqponm',
    };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(updatedUser as any);

    // 3. Old token should now be rejected as already used / invalid signature
    const result = await verifyAuthToken(token, 'PASSWORD_RESET');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/already been used|invalid/i);
  });

  it('rejects if user does not exist in database', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const token = generateAuthToken(mockUser, 'INVITE', 3600);
    const result = await verifyAuthToken(token, 'INVITE');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/user not found/i);
  });

  it('accepts tokens with trailing punctuation from copy-paste', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

    const token = generateAuthToken(mockUser, 'INVITE', 3600);
    const tokenWithPeriod = `${token}.`;
    const result = await verifyAuthToken(tokenWithPeriod, 'INVITE');
    expect(result.valid).toBe(true);
    expect(result.user?.id).toBe(mockUser.id);
  });
});

