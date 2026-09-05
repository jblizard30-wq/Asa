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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
    <h1 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Welcome to ${APP_NAME}${orgContext}</h1>
    <p style="font-size: 15px; line-height: 24px; color: #334155; margin-bottom: 16px;">${greeting}</p>
    <p style="font-size: 15px; line-height: 24px; color: #334155; margin-bottom: 24px;">You've been invited to join <strong>${APP_NAME}${orgContext}</strong>. Click the button below to set up your password and access your workspace:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">Set Up Your Password</a>
    </div>
    ${temporaryPassword ? `
    <div style="background-color: #f1f5f9; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <p style="font-size: 13px; color: #475569; margin: 0 0 8px 0;">If you prefer to sign in directly, your temporary password is:</p>
      <code style="font-family: monospace; font-size: 14px; font-weight: bold; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; color: #0f172a;">${temporaryPassword}</code>
      <p style="font-size: 12px; color: #64748b; margin: 8px 0 0 0;">You can change it anytime after signing in.</p>
    </div>` : ''}
    <p style="font-size: 13px; line-height: 20px; color: #64748b; margin-bottom: 8px;">If the button above does not work, copy and paste this complete link into your browser:</p>
    <p style="font-size: 12px; line-height: 18px; color: #2563eb; word-break: break-all; margin-bottom: 24px;">
      <a href="${inviteUrl}" style="color: #2563eb; text-decoration: underline;">${inviteUrl}</a>
    </p>
    <p style="font-size: 13px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">This setup link expires in 7 days.</p>
    <p style="font-size: 14px; color: #475569; margin-bottom: 0;">— The ${APP_NAME} Team</p>
  </div>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: EMAIL_FROM || DEFAULT_EMAIL_FROM,
      to,
      subject,
      text: body,
      html,
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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
    <h1 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Password Reset Request</h1>
    <p style="font-size: 15px; line-height: 24px; color: #334155; margin-bottom: 16px;">${greeting}</p>
    <p style="font-size: 15px; line-height: 24px; color: #334155; margin-bottom: 24px;">An administrator requested a password reset for your <strong>${APP_NAME}${orgContext}</strong> account. Click the button below to choose a new password:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">Reset Your Password</a>
    </div>
    <p style="font-size: 13px; line-height: 20px; color: #64748b; margin-bottom: 8px;">If the button above does not work, copy and paste this complete link into your browser:</p>
    <p style="font-size: 12px; line-height: 18px; color: #2563eb; word-break: break-all; margin-bottom: 24px;">
      <a href="${resetUrl}" style="color: #2563eb; text-decoration: underline;">${resetUrl}</a>
    </p>
    <p style="font-size: 13px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">This link is valid for 24 hours and can only be used once. If you did not request this, you can safely ignore this email.</p>
    <p style="font-size: 14px; color: #475569; margin-bottom: 0;">— The ${APP_NAME} Team</p>
  </div>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: EMAIL_FROM || DEFAULT_EMAIL_FROM,
      to,
      subject,
      text: body,
      html,
    });
  } catch (err) {
    console.error('Failed to send password reset email', err);
  }
}

