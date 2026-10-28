// Local sentence embeddings via transformers.js (ONNX runtime, CPU).
// Lets the whole RAG + recommendation pipeline run in Docker with no API keys.
import path from 'node:path';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const DIMENSIONS = 384;

let extractorPromise;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = process.env.HF_CACHE_DIR || path.resolve('.cache/hf');
      return pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
    })();
    // Don't cache a failed load forever; let the next call retry.
    extractorPromise.catch(() => { extractorPromise = undefined; });
  }
  return extractorPromise;
}

export const localEmbedder = {
  name: `local:${MODEL_ID}`,
  dimensions: DIMENSIONS,
  async embed(texts) {
    const extractor = await getExtractor();
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    return output.tolist();
  },
  warmUp: getExtractor,
};
