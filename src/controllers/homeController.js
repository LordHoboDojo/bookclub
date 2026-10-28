import mongoose from 'mongoose';
import config, { googleAuthEnabled } from '../config/index.js';
import { Club, Invite } from '../models/index.js';

export function landing(req, res) {
  if (req.user) return res.redirect('/dashboard');
  return res.render('home/landing', { title: 'Welcome' });
}

export function login(req, res) {
  if (req.user) return res.redirect('/dashboard');
  return res.render('home/login', {
    title: 'Sign in',
    googleEnabled: googleAuthEnabled(),
    devLoginEnabled: config.devLoginEnabled,
  });
}

export async function dashboard(req, res) {
  const [clubs, invites] = await Promise.all([
    Club.forUser(req.user._id).populate('books.book', 'title authors coverUrl'),
    Invite.find({ email: req.user.email, status: 'pending', expiresAt: { $gt: new Date() } })
      .populate('club', 'name description')
      .populate('invitedBy', 'name email'),
  ]);
  res.render('home/dashboard', {
    title: 'Your clubs',
    clubs,
    invites: invites.filter((i) => i.club),
    devLoginEnabled: config.devLoginEnabled,
  });
}

export function healthz(req, res) {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp });
}
