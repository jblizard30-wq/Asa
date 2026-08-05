import { prisma } from '@/lib/prisma';
import { decryptToken, encryptToken } from '@/lib/tokenCrypto';

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Fetches upcoming events from the user's connected Google Calendar. This is a complete, working
 * implementation but is deliberately not wired to any route, button, or cron — see the
 * CalendarConnection model comment in prisma/schema.prisma. Only a future explicit call site
 * (e.g. a cron route or a "Sync now" action) should invoke this.
 */
export async function syncCalendarEvents(connectionId: string): Promise<{ synced: number }> {
  const connection = await prisma.calendarConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.provider !== 'GOOGLE' || !connection.accessToken) {
    return { synced: 0 };
  }

  let accessToken = decryptToken(connection.accessToken);

  const tokenExpired = connection.tokenExpiresAt ? connection.tokenExpiresAt.getTime() <= Date.now() : false;
  if (tokenExpired && connection.refreshToken) {
    const refreshed = await refreshAccessToken(decryptToken(connection.refreshToken));
    if (!refreshed) return { synced: 0 };

    accessToken = refreshed.accessToken;
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: encryptToken(refreshed.accessToken),
        tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      },
    });
  }

  const calendarId = connection.externalCalendarId ?? 'primary';
  const listUrl = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  );
  listUrl.searchParams.set('singleEvents', 'true');
  listUrl.searchParams.set('orderBy', 'startTime');
  listUrl.searchParams.set('timeMin', new Date().toISOString());
  listUrl.searchParams.set('maxResults', '50');

  const response = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return { synced: 0 };

  const data = (await response.json()) as { items?: GoogleCalendarEvent[] };
  const events = data.items ?? [];

  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date() },
  });

  return { synced: events.length };
}
