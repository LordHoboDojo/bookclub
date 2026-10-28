// Authentication gate. Remembers where the user was headed so login can send them back.
export function requireAuth(req, res, next) {
  if (req.user) return next();
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  req.flash('info', 'Please sign in to continue.');
  return res.redirect('/login');
}

export function safeReturnTo(value) {
  // Only allow same-site relative paths (blocks //evil.com and absolute URLs).
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}
