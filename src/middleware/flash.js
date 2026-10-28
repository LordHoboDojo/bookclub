// Minimal session flash messages: set on one request, shown on the next page that renders.
// Messages are only consumed at render time, so they survive redirect chains.
export function flash(req, res, next) {
  req.flash = (type, message) => {
    req.session.flash ??= [];
    req.session.flash.push({ type, message });
  };
  res.locals.flash = [];
  const render = res.render.bind(res);
  res.render = (...args) => {
    res.locals.flash = req.session?.flash ?? [];
    if (req.session) delete req.session.flash;
    return render(...args);
  };
  next();
}
