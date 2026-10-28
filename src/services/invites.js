// Invite lifecycle: leader sends -> email link with one-time token -> invitee signs in -> accepts.
import config from '../config/index.js';
import { Invite, User } from '../models/index.js';
import { sendInviteEmail } from './mailer.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_INVITES_PER_REQUEST = 25;

export class InviteError extends Error {}

export function parseEmails(raw) {
  const all = String(raw || '')
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(all)];
  return {
    valid: unique.filter((e) => EMAIL.test(e)),
    invalid: unique.filter((e) => !EMAIL.test(e)),
  };
}

const expiry = () => new Date(Date.now() + config.invites.ttlDays * 24 * 60 * 60 * 1000);
const inviteLink = (token) => `${config.appUrl}/invites/${token}`;

async function issueAndSend(invite, { club, inviter }) {
  const { token, tokenHash } = Invite.generateToken();
  invite.tokenHash = tokenHash; // re-sending rotates the token, so older links stop working
  invite.expiresAt = expiry();
  invite.lastSentAt = new Date();
  invite.sendCount += 1;
  await invite.save();
  await sendInviteEmail({ to: invite.email, club, inviter, link: inviteLink(token), expiresAt: invite.expiresAt });
  return invite;
}

export async function sendInvites({ club, inviter, emails }) {
  const results = { sent: [], skipped: [] };
  const memberUsers = await User.find({ _id: { $in: club.members.map((m) => m.user) } }).select('email');
  const memberEmails = new Set(memberUsers.map((u) => u.email));

  for (const email of emails.slice(0, MAX_INVITES_PER_REQUEST)) {
    if (memberEmails.has(email)) {
      results.skipped.push({ email, reason: 'already a member' });
      continue;
    }
    let invite = await Invite.findOne({ club: club._id, email, status: 'pending' });
    invite ??= new Invite({ club: club._id, email, invitedBy: inviter._id, tokenHash: 'pending', expiresAt: expiry() });
    try {
      await issueAndSend(invite, { club, inviter });
      results.sent.push(email);
    } catch (err) {
      console.error(`[invites] could not send to ${email}: ${err.message}`);
      results.skipped.push({ email, reason: 'email could not be sent' });
    }
  }
  return results;
}

export async function resendInvite({ invite, club, inviter }) {
  if (invite.status !== 'pending') throw new InviteError('Only pending invites can be re-sent.');
  return issueAndSend(invite, { club, inviter });
}

export async function revokeInvite(invite) {
  if (invite.status !== 'pending') throw new InviteError('Only pending invites can be revoked.');
  invite.status = 'revoked';
  await invite.save();
}

/** Throws InviteError with a user-facing message when the invite can't be used by this user. */
export function assertUsable(invite, user) {
  if (!invite) throw new InviteError('This invite link is not valid.');
  if (invite.status === 'accepted') throw new InviteError('This invite has already been accepted.');
  if (invite.status !== 'pending') throw new InviteError('This invite is no longer active.');
  if (invite.isExpired) throw new InviteError('This invite has expired. Ask the club leader to send a new one.');
  if (user && config.invites.requireEmailMatch && user.email !== invite.email) {
    throw new InviteError(
      `This invite was sent to ${invite.email}, but you're signed in as ${user.email}. Sign out and sign in with the invited account.`,
    );
  }
}

export async function acceptInvite({ invite, club, user }) {
  assertUsable(invite, user);
  if (!club.isMember(user._id)) {
    club.members.push({ user: user._id, role: 'member' });
    await club.save();
  }
  invite.status = 'accepted';
  invite.respondedBy = user._id;
  invite.respondedAt = new Date();
  await invite.save();
}

export async function declineInvite({ invite, user }) {
  assertUsable(invite, user);
  invite.status = 'declined';
  invite.respondedBy = user._id;
  invite.respondedAt = new Date();
  await invite.save();
}
