import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptToken, encryptTokenOrNull } from '@/lib/tokenCrypto';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(new URL('/sign-in', request.url));

  const integrationsUrl = new URL('/settings/integrations', request.url);

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expectedState = request.cookies.get('outlook_calendar_oauth_state')?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    integrationsUrl.searchParams.set('error', 'outlook_oauth_failed');
    return NextResponse.redirect(integrationsUrl);
  }

  const clientId = process.env.OUTLOOK_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CALENDAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    integrationsUrl.searchParams.set('error', 'outlook_not_configured');
    return NextResponse.redirect(integrationsUrl);
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/outlook/callback`;

  try {
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid offline_access https://graph.microsoft.com/Calendars.Read',
      }),
    });

    if (!tokenResponse.ok) {
      integrationsUrl.searchParams.set('error', 'outlook_oauth_failed');
      return NextResponse.redirect(integrationsUrl);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    await prisma.calendarConnection.upsert({
      where: { userId_provider: { userId: session.user.id, provider: 'OUTLOOK' } },
      create: {
        userId: session.user.id,
        provider: 'OUTLOOK',
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptTokenOrNull(tokens.refresh_token) ?? null,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptTokenOrNull(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    integrationsUrl.searchParams.set('connected', 'outlook');
    const response = NextResponse.redirect(integrationsUrl);
    response.cookies.delete('outlook_calendar_oauth_state');
    return response;
  } catch (err) {
    console.error('Outlook Calendar OAuth callback failed', err);
    integrationsUrl.searchParams.set('error', 'outlook_oauth_failed');
    return NextResponse.redirect(integrationsUrl);
  }
}
