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

/**
 * Sends a welcome invitation email to a newly invited user with their first-time login/setup link.
 */
export async function sendInviteEmail(
  to: string,
  name: string,
  inviteUrl: string,
  temporaryPassword?: string,
) {
  if (!transporter) return;
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const orgContext = ORG_NAME ? ` for ${ORG_NAME}` : '';
  const subject = `Welcome to ${APP_NAME}${orgContext} — Set up your account`;

  let body = `${greeting}\n\nYou've been invited to join ${APP_NAME}${orgContext}.\n\nClick the link below to set up your password and access your workspace:\n\n${inviteUrl}\n\nThis setup link will expire in 7 days.`;

  if (temporaryPassword) {
    body += `\n\nIf you prefer to sign in directly, your temporary password is:\n${temporaryPassword}\n\nYou will be able to change it after signing in.`;
  }

  body += `\n\n— The ${APP_NAME} Team`;

  try {
    await transporter.sendMail({
      from: EMAIL_FROM || DEFAULT_EMAIL_FROM,
      to,
      subject,
      text: body,
    });
  } catch (err) {
    console.error('Failed to send invitation email', err);
  }
}

/**
 * Sends a password reset email with a secure 24-hour reset link.
 */
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  if (!transporter) return;
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const orgContext = ORG_NAME ? ` (${ORG_NAME})` : '';
  const subject = `Reset your ${APP_NAME}${orgContext} password`;

  const body = `${greeting}\n\nAn administrator requested a password reset for your ${APP_NAME} account.\n\nClick the link below to reset your password:\n\n${resetUrl}\n\nThis link is valid for 24 hours and can only be used once.\n\nIf you did not expect this request, you can safely ignore this email.\n\n— The ${APP_NAME} Team`;

  try {
    await transporter.sendMail({
      from: EMAIL_FROM || DEFAULT_EMAIL_FROM,
      to,
      subject,
      text: body,
    });
  } catch (err) {
    console.error('Failed to send password reset email', err);
  }
}

