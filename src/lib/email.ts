import nodemailer from 'nodemailer';
import { APP_NAME, ORG_NAME } from '@/lib/site';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = process.env;

const DEFAULT_EMAIL_FROM = ORG_NAME
  ? `${APP_NAME} (${ORG_NAME}) <notifications@example.org>`
  : `${APP_NAME} <notifications@example.org>`;

const emailEnabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);

const transporter = emailEnabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    })
  : null;

/**
 * Fire-and-forget: notifications must never fail the calling request, since
 * most callers are in the middle of an unrelated write (assigning a task,
 * posting a comment). Missing SMTP config silently no-ops instead of throwing.
 */
export async function sendNotificationEmail(to: string, subject: string, body: string) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: EMAIL_FROM || DEFAULT_EMAIL_FROM,
      to,
      subject,
      text: body,
    });
  } catch (err) {
    console.error('Failed to send notification email', err);
  }
}
