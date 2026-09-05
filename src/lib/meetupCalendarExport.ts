// src/lib/meetupCalendarExport.ts
import { format } from 'date-fns';

export interface CalendarEventPayload {
  id: string;
  title: string;
  description?: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  location?: string | null;
  virtualUrl?: string | null;
  agenda?: string | null;
  hostName?: string | null;
}

function formatDateForICS(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

function formatDateForGoogle(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

export function generateICSContent(event: CalendarEventPayload): string {
  const startDate = new Date(event.startsAt);
  const endDate = new Date(event.endsAt);
  const now = new Date();

  const uid = `${event.id}@cpcana.church`;
  const location = [event.location, event.virtualUrl].filter(Boolean).join(' | ') || 'TBD';

  let descriptionParts: string[] = [];
  if (event.description) descriptionParts.push(event.description);
  if (event.virtualUrl) descriptionParts.push(`Join Video Call: ${event.virtualUrl}`);
  if (event.agenda) descriptionParts.push(`Agenda:\n${event.agenda}`);
  if (event.hostName) descriptionParts.push(`Organized by: ${event.hostName}`);

  const description = descriptionParts.join('\n\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CPCana//Meetup Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDateForICS(now)}`,
    `DTSTART:${formatDateForICS(startDate)}`,
    `DTEND:${formatDateForICS(endDate)}`,
    `SUMMARY:${event.title.replace(/[,;]/g, ' ')}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `LOCATION:${location.replace(/[,;]/g, ' ')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadICS(event: CalendarEventPayload): void {
  const icsContent = generateICSContent(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${event.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function getGoogleCalendarUrl(event: CalendarEventPayload): string {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const location = [event.location, event.virtualUrl].filter(Boolean).join(' | ');

  let details = event.description || '';
  if (event.virtualUrl) details += `\n\nVideo Call: ${event.virtualUrl}`;
  if (event.agenda) details += `\n\nAgenda:\n${event.agenda}`;
  if (event.hostName) details += `\n\nHost: ${event.hostName}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatDateForGoogle(start)}/${formatDateForGoogle(end)}`,
    details: details.trim(),
    location: location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getOutlookCalendarUrl(event: CalendarEventPayload): string {
  const start = new Date(event.startsAt).toISOString();
  const end = new Date(event.endsAt).toISOString();
  const location = [event.location, event.virtualUrl].filter(Boolean).join(' | ');

  let details = event.description || '';
  if (event.virtualUrl) details += `\n\nVideo Call: ${event.virtualUrl}`;
  if (event.agenda) details += `\n\nAgenda:\n${event.agenda}`;

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start,
    enddt: end,
    body: details,
    location: location,
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function getOffice365CalendarUrl(event: CalendarEventPayload): string {
  const start = new Date(event.startsAt).toISOString();
  const end = new Date(event.endsAt).toISOString();
  const location = [event.location, event.virtualUrl].filter(Boolean).join(' | ');

  let details = event.description || '';
  if (event.virtualUrl) details += `\n\nVideo Call: ${event.virtualUrl}`;
  if (event.agenda) details += `\n\nAgenda:\n${event.agenda}`;

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start,
    enddt: end,
    body: details,
    location: location,
  });

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

