import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/** Shared with createApiKey in lib/actions/apiKeys.ts — both must hash the same way, since one
 * writes the keyHash this looks up. */
export function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export async function authenticateApiKey(request: Request) {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const rawKey = header.slice('Bearer '.length).trim();
  if (!rawKey) return null;

  const keyHash = hashKey(rawKey);
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash }, include: { user: true } });
  if (!apiKey || apiKey.revokedAt || (apiKey.expiresAt && apiKey.expiresAt < new Date())) return null;

  void prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return apiKey.user;
}
