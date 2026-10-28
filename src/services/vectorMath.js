// Small, dependency-free vector helpers used by retrieval and recommendations.

export function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function norm(a) {
  return Math.sqrt(dot(a, a));
}

export function normalize(a) {
  const n = norm(a);
  return n === 0 ? a.slice() : a.map((x) => x / n);
}

export function cosine(a, b) {
  const denom = norm(a) * norm(b);
  return denom === 0 ? 0 : dot(a, b) / denom;
}

/** Weighted sum of vectors, normalized. Negative weights push the result away from a vector. */
export function weightedCentroid(vectors, weights) {
  if (!vectors.length) return null;
  const out = new Array(vectors[0].length).fill(0);
  vectors.forEach((v, i) => {
    const w = weights[i];
    for (let d = 0; d < v.length; d++) out[d] += w * v[d];
  });
  return norm(out) === 0 ? null : normalize(out);
}

/**
 * Maximal Marginal Relevance: pick items that are relevant to the query but not redundant
 * with each other. `lambda` = 1 is pure relevance, 0 is pure diversity.
 */
export function mmr(candidates, { k, lambda = 0.75 }) {
  const pool = candidates.slice();
  const chosen = [];
  while (chosen.length < k && pool.length) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    pool.forEach((c, idx) => {
      const redundancy = chosen.length ? Math.max(...chosen.map((s) => cosine(c.vector, s.vector))) : 0;
      const score = lambda * c.score - (1 - lambda) * redundancy;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    chosen.push(pool.splice(bestIdx, 1)[0]);
  }
  return chosen;
}
