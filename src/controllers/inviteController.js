import mongoose from 'mongoose';
import { Club, Invite } from '../models/index.js';
import {
  acceptInvite,
  assertUsable,
  declineInvite,
  InviteError,
  MAX_INVITES_PER_REQUEST,
  parseEmails,
  resendInvite,
  revokeInvite,
  sendInvites,
} from '../services/invites.js';
import { HttpError } from '../middleware/clubAccess.js';

const clubUrl = (club) => `/clubs/${club._id}#invites`;

// ---- Leader actions (club context) ---------------------------------------------------------

export async function create(req, res) {
  const { valid, invalid } = parseEmails(req.body.emails);
  if (!valid.length) {
    req.flash('error', 'Enter at least one valid email address.');
    return res.redirect(clubUrl(req.club));
  }
  const { sent, skipped } = await sendInvites({ club: req.club, inviter: req.user, emails: valid });
  if (sent.length) req.flash('success', `Invite${sent.length > 1 ? 's' : ''} sent to ${sent.join(', ')}.`);
  for (const s of skipped) req.flash('info', `Skipped ${s.email}: ${s.reason}.`);
  if (invalid.length) req.flash('error', `Not valid email addresses: ${invalid.join(', ')}.`);
  if (valid.length > MAX_INVITES_PER_REQUEST) {
    req.flash('info', `Only the first ${MAX_INVITES_PER_REQUEST} addresses were processed.`);
  }
  return res.redirect(clubUrl(req.club));
}

async function findClubInvite(req) {
  const { inviteId } = req.params;
  if (!mongoose.isValidObjectId(inviteId)) throw new HttpError(404, 'Invite not found');
  const invite = await Invite.findOne({ _id: inviteId, club: req.club._id });
  if (!invite) throw new HttpError(404, 'Invite not found');
  return invite;
}

export async function resend(req, res) {
  const invite = await findClubInvite(req);
  try {
    await resendInvite({ invite, club: req.club, inviter: req.user });
    req.flash('success', `Invite re-sent to ${invite.email}. The previous link no longer works.`);
  } catch (err) {
    if (!(err instanceof InviteError)) throw err;
    req.flash('error', err.message);
  }
  res.redirect(clubUrl(req.club));
}

export async function revoke(req, res) {
  const invite = await findClubInvite(req);
  try {
    await revokeInvite(invite);
    req.flash('success', `Invite for ${invite.email} revoked.`);
  } catch (err) {
    if (!(err instanceof InviteError)) throw err;
    req.flash('error', err.message);
  }
  res.redirect(clubUrl(req.club));
}

// ---- Invitee actions (token link) ----------------------------------------------------------

async function loadInvite(token) {
  const invite = await Invite.findByToken(token);
  const club = invite ? await Club.findById(invite.club).populate('leader', 'name email') : null;
  return { invite: club ? invite : null, club };
}

export async function show(req, res) {
  const { invite, club } = await loadInvite(req.params.token);
  let problem = null;
  try {
    assertUsable(invite, req.user);
  } catch (err) {
    if (!(err instanceof InviteError)) throw err;
    problem = err.message;
  }
  const alreadyMember = Boolean(req.user && club?.isMember(req.user._id));
  if (!req.user) req.session.returnTo = req.originalUrl; // come back here after signing in
  res.render('invites/show', {
    title: club ? `Join ${club.name}` : 'Invite',
    invite,
    inviteClub: club,
    token: req.params.token,
    problem,
    alreadyMember,
  });
}

export async function accept(req, res) {
  const { invite, club } = await loadInvite(req.params.token);
  try {
    await acceptInvite({ invite, club, user: req.user });
  } catch (err) {
    if (!(err instanceof InviteError)) throw err;
    req.flash('error', err.message);
    return res.redirect(`/invites/${req.params.token}`);
  }
  req.flash('success', `Welcome to ${club.name}!`);
  return res.redirect(`/clubs/${club._id}`);
}

export async function decline(req, res) {
  const { invite, club } = await loadInvite(req.params.token);
  try {
    await declineInvite({ invite, user: req.user });
    req.flash('info', `You declined the invite to ${club.name}.`);
  } catch (err) {
    if (!(err instanceof InviteError)) throw err;
    req.flash('error', err.message);
  }
  return res.redirect('/dashboard');
}
