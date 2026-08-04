import { prisma } from '@/lib/prisma';

interface OutlookCalendarEvent {
  id: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  const clientId = process.env.OUTLOOK_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'openid offline_access https://graph.microsoft.com/Calendars.Read',
    }),
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Fetches upcoming events from the user's connected Outlook Calendar. Complete, working
 * implementation but deliberately not wired to any route, button, or cron — see the
 * CalendarConnection model comment in prisma/schema.prisma. Only a future explicit call site
 * should invoke this.
 */
export async function syncCalendarEvents(connectionId: string): Promise<{ synced: number }> {
  const connection = await prisma.calendarConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.provider !== 'OUTLOOK' || !connection.accessToken) {
    return { synced: 0 };
  }

  let accessToken = connection.accessToken;

  const tokenExpired = connection.tokenExpiresAt ? connection.tokenExpiresAt.getTime() <= Date.now() : false;
  if (tokenExpired && connection.refreshToken) {
    const refreshed = await refreshAccessToken(connection.refreshToken);
    if (!refreshed) return { synced: 0 };

    accessToken = refreshed.accessToken;
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: refreshed.accessToken,
        tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      },
    });
  }

  const listUrl = new URL('https://graph.microsoft.com/v1.0/me/events');
  listUrl.searchParams.set('$orderby', 'start/dateTime');
  listUrl.searchParams.set('$top', '50');

  const response = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return { synced: 0 };

  const data = (await response.json()) as { value?: OutlookCalendarEvent[] };
  const events = data.value ?? [];

  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date() },
  });

  return { synced: events.length };
}
