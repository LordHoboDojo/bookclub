import config from '../config/index.js';

export function notFound(req, res) {
  res.status(404).render('errors/error', { title: 'Not found', status: 404, message: "We couldn't find that page." });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  const message = status >= 500 && config.isProd ? 'Something went wrong on our side.' : err.message;
  if (res.headersSent) return;
  // Errors can fire before the per-request locals are populated; the layout needs them.
  res.locals.currentUser ??= req.user ?? null;
  res.locals.csrfToken ??= req.session?.csrfToken ?? '';
  res.locals.flash ??= [];
  res.locals.currentPath ??= req.path;
  res.status(status).render('errors/error', { title: 'Error', status, message });
}
