import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateApiKey, hashKey } from './apiAuth';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn().mockReturnValue(Promise.resolve()),
    },
  },
}));

describe('authenticateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without Authorization header or Bearer scheme', async () => {
    const req1 = new Request('http://localhost/api/v1/tasks');
    expect(await authenticateApiKey(req1)).toBeNull();

    const req2 = new Request('http://localhost/api/v1/tasks', {
      headers: { authorization: 'Basic 12345' },
    });
    expect(await authenticateApiKey(req2)).toBeNull();
  });

  it('rejects revoked api keys', async () => {
    const rawKey = 'test_key_123';
    (prisma.apiKey.findUnique as any).mockResolvedValue({
      id: 'k-1',
      revokedAt: new Date(Date.now() - 60000),
      expiresAt: null,
      user: { id: 'u-1', name: 'User' },
    });

    const req = new Request('http://localhost/api/v1/tasks', {
      headers: { authorization: `Bearer ${rawKey}` },
    });
    expect(await authenticateApiKey(req)).toBeNull();
  });

  it('rejects expired api keys', async () => {
    const rawKey = 'test_key_expired';
    (prisma.apiKey.findUnique as any).mockResolvedValue({
      id: 'k-2',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000), // expired 1s ago
      user: { id: 'u-1', name: 'User' },
    });

    const req = new Request('http://localhost/api/v1/tasks', {
      headers: { authorization: `Bearer ${rawKey}` },
    });
    expect(await authenticateApiKey(req)).toBeNull();
  });

  it('accepts valid, non-expired, non-revoked api keys', async () => {
    const rawKey = 'test_key_valid';
    const mockUser = { id: 'u-1', name: 'Active User' };
    (prisma.apiKey.findUnique as any).mockResolvedValue({
      id: 'k-3',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000), // expires tomorrow
      user: mockUser,
    });

    const req = new Request('http://localhost/api/v1/tasks', {
      headers: { authorization: `Bearer ${rawKey}` },
    });
    const result = await authenticateApiKey(req);
    expect(result).toEqual(mockUser);
    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'k-3' },
        data: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      })
    );
  });
});
