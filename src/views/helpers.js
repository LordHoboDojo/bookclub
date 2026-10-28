// Presentation helpers exposed to every template as `h`.

export function formatDate(date, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', opts);
}

export function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export function plural(n, word, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export function stars(rating) {
  if (rating == null) return '';
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function truncate(text, n = 160) {
  const s = String(text || '');
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

/** Stable hue per title so placeholder covers are colorful but consistent. */
export function coverHue(title = '') {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.codePointAt(0)) % 360;
  return hash;
}

export function displayName(user) {
  if (!user) return 'Former member';
  return user.name || String(user.email || '').split('@')[0];
}

export function initials(user) {
  return displayName(user)
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export const statusLabel = { reading: 'Reading now', upcoming: 'Up next', finished: 'Finished' };
