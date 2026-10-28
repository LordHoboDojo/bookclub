import passport from '../config/passport.js';
import { upsertUserFromIdentity } from '../config/passport.js';
import { safeReturnTo } from '../middleware/auth.js';

export const googleStart = passport.authenticate('google', { prompt: 'select_account' });

// keepSessionInfo preserves returnTo across passport's session regeneration on login.
export const googleCallback = [
  passport.authenticate('google', { failureRedirect: '/login', failureFlash: false, keepSessionInfo: true }),
  (req, res) => {
    const target = safeReturnTo(req.session.returnTo);
    delete req.session.returnTo;
    res.redirect(target);
  },
];

/** Local-only login for exercising multi-user flows (e.g. invites) without Google. */
export async function devLogin(req, res, next) {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    req.flash('error', 'Enter a valid email address.');
    return res.redirect('/login');
  }
  const user = await upsertUserFromIdentity({ email, name: String(req.body.name || '').trim() || undefined });
  return req.login(user, { keepSessionInfo: true }, (err) => {
    if (err) return next(err);
    const target = safeReturnTo(req.session.returnTo);
    delete req.session.returnTo;
    return res.redirect(target);
  });
}

export function logout(req, res, next) {
  req.logout((err) => {
    if (err) return next(err);
    return req.session.destroy(() => res.redirect('/'));
  });
}
