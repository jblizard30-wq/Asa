import { purgeExpiredTrash } from '@/lib/actions/trash';

export const dynamic = 'force-dynamic';

/**
 * Daily hard-delete of trash past its retention window (Vercel Cron, see vercel.json). Not
 * user-session authenticated since it's invoked externally — guarded by a shared secret instead.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { purgedCount } = await purgeExpiredTrash();
  return Response.json({ purged: purgedCount });
}
