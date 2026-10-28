// Thin client for the public Open Library API (book search + subject browsing).
const BASE = 'https://openlibrary.org';
const HEADERS = { 'User-Agent': 'BookclubApp/1.0 (book club demo)', Accept: 'application/json' };
const WORK_KEY = /^\/works\/OL\d+W$/;

// Library-housekeeping subjects that say nothing about what a book is like.
const NOISE = /^(fiction|literature|novel|accessible book|protected daisy|in library|large type books|open library staff picks|reading level|nyt:|new york times|award:|place:|person:|time:|translations|english|american|textbooks|history and criticism|criticism and interpretation|juvenile)/i;

export const coverUrl = (coverId) => `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
export const isWorkKey = (key) => WORK_KEY.test(String(key || ''));

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
  return res.json();
}

export function cleanSubjects(subjects = []) {
  const seen = new Set();
  return subjects
    .map((s) => String(s).trim())
    .filter((s) => s && s.length < 60 && !NOISE.test(s))
    .filter((s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 12);
}

export async function searchBooks(query, limit = 12) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    fields: 'key,title,author_name,first_publish_year,cover_i,subject',
  });
  const data = await getJson(`/search.json?${params}`);
  return (data.docs ?? [])
    .filter((d) => isWorkKey(d.key) && d.title)
    .map((d) => ({
      openLibraryKey: d.key,
      title: d.title,
      authors: (d.author_name ?? []).slice(0, 3),
      publishedYear: d.first_publish_year,
      coverUrl: d.cover_i ? coverUrl(d.cover_i) : undefined,
      subjects: cleanSubjects(d.subject),
    }));
}

export async function fetchWork(key) {
  if (!isWorkKey(key)) throw new Error('Invalid Open Library work key');
  const data = await getJson(`${key}.json`);
  const description = typeof data.description === 'string' ? data.description : data.description?.value;
  return {
    title: data.title,
    description: (description || '').replace(/\r\n/g, '\n').slice(0, 4000),
    subjects: cleanSubjects(data.subjects),
    coverUrl: data.covers?.[0] > 0 ? coverUrl(data.covers[0]) : undefined,
  };
}

export async function subjectWorks(subject, limit = 12) {
  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!slug) return [];
  const data = await getJson(`/subjects/${slug}.json?limit=${limit}`);
  return (data.works ?? [])
    .filter((w) => isWorkKey(w.key) && w.title)
    .map((w) => ({
      openLibraryKey: w.key,
      title: w.title,
      authors: (w.authors ?? []).map((a) => a.name).slice(0, 3),
      publishedYear: w.first_publish_year,
      coverUrl: w.cover_id ? coverUrl(w.cover_id) : undefined,
      subjects: cleanSubjects(w.subject),
    }));
}
