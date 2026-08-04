import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(new URL('/sign-in', request.url));

  const clientId = process.env.OUTLOOK_CALENDAR_CLIENT_ID;
  if (!clientId) {
    const url = new URL('/settings/integrations', request.url);
    url.searchParams.set('error', 'outlook_not_configured');
    return NextResponse.redirect(url);
  }

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/outlook/callback`;

  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', 'openid offline_access https://graph.microsoft.com/Calendars.Read');
  authUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('outlook_calendar_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
