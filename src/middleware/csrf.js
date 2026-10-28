import crypto from 'node:crypto';

// Synchronizer-token CSRF protection: one random token per session, required on every
// state-changing request as a hidden `_csrf` form field.
export function csrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('base64url');
  res.locals.csrfToken = req.session.csrfToken;

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const sent = Buffer.from(String(req.body?._csrf ?? req.get('x-csrf-token') ?? ''));
  const expected = Buffer.from(req.session.csrfToken);
  if (sent.length !== expected.length || !crypto.timingSafeEqual(sent, expected)) {
    const err = new Error('Your session expired or the form was tampered with. Please try again.');
    err.status = 403;
    return next(err);
  }
  return next();
}
