// Outbound email. SES in AWS, SMTP (Mailpit) in docker compose, console as a last resort.
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import nodemailer from 'nodemailer';
import config from '../config/index.js';

let transport;

async function deliver({ to, subject, text, html }) {
  const { provider, from } = config.mail;
  if (provider === 'ses') {
    transport ??= new SESv2Client({ region: config.aws.region });
    await transport.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Text: { Data: text, Charset: 'UTF-8' }, Html: { Data: html, Charset: 'UTF-8' } },
          },
        },
      }),
    );
    return;
  }
  if (provider === 'smtp') {
    transport ??= nodemailer.createTransport({
      host: config.mail.smtpHost,
      port: config.mail.smtpPort,
      secure: false,
    });
    await transport.sendMail({ from, to, subject, text, html });
    return;
  }
  console.log(`[mail] To: ${to}\n[mail] Subject: ${subject}\n${text}\n`);
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function sendInviteEmail({ to, club, inviter, link, expiresAt }) {
  const subject = `${inviter.displayName} invited you to join ${club.name}`;
  const expires = expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const text = [
    `${inviter.displayName} invited you to join the book club "${club.name}".`,
    club.description ? `\n${club.description}\n` : '',
    `Accept the invite: ${link}`,
    `\nThis link expires on ${expires}. Sign in with the Google account for ${to}.`,
  ].join('\n');
  const html = `
  <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:24px;color:#2b2118">
    <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a5a3b;margin:0 0 8px">${escapeHtml(config.appName)}</p>
    <h1 style="font-size:24px;margin:0 0 12px">You're invited to ${escapeHtml(club.name)}</h1>
    <p>${escapeHtml(inviter.displayName)} would like you to join their book club.</p>
    ${club.description ? `<blockquote style="border-left:3px solid #d9b99b;margin:16px 0;padding:4px 12px;color:#5b4a3c">${escapeHtml(club.description)}</blockquote>` : ''}
    <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#8a3b2b;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-family:system-ui,sans-serif">Accept invite</a></p>
    <p style="font-size:13px;color:#7a6a5c">Sign in with the Google account for ${escapeHtml(to)}. This link expires on ${escapeHtml(expires)}.</p>
  </div>`;
  await deliver({ to, subject, text, html });
}
