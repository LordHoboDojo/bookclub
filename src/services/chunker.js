// Splits long text into overlapping, paragraph/sentence-aligned passages for retrieval.
// Paragraphs are natural topic boundaries, so a new passage starts at a paragraph break once
// the current one has some substance; that keeps each embedding focused on one idea.

export function chunkText(text, { maxChars = 900, overlap = 150, paragraphFlushAt = 250 } = {}) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= maxChars && !/\n{2,}/.test(clean)) return [clean];

  const chunks = [];
  let current = '';
  for (const paragraph of clean.split(/\n{2,}/)) {
    const sentences = (paragraph.match(/[^.!?\n]+(?:[.!?]+|$)\s*/g) ?? [paragraph]).map((s) => s.trim()).filter(Boolean);
    for (const sentence of sentences) {
      if (current && current.length + sentence.length + 1 > maxChars) {
        chunks.push(current);
        // Carry a tail of the previous chunk forward so ideas spanning a boundary stay retrievable.
        const tail = current.slice(-overlap);
        const cut = tail.indexOf(' ');
        current = cut >= 0 ? tail.slice(cut + 1) : '';
      }
      if (sentence.length > maxChars) {
        for (let i = 0; i < sentence.length; i += maxChars - overlap) {
          chunks.push(sentence.slice(i, i + maxChars));
        }
        current = '';
        continue;
      }
      current = current ? `${current} ${sentence}` : sentence;
    }
    if (current.length >= paragraphFlushAt) {
      chunks.push(current);
      current = '';
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
