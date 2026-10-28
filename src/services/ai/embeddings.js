import config from '../../config/index.js';
import { localEmbedder } from './localEmbedder.js';
import { bedrockEmbedder } from './bedrockEmbedder.js';

// Every stored vector is tagged with the embedder's name, so switching providers never mixes
// incompatible vector spaces (run `npm run reindex` after switching).
export function getEmbedder() {
  return config.embeddings.provider === 'bedrock' ? bedrockEmbedder : localEmbedder;
}

const BATCH_SIZE = 32;

export async function embedTexts(texts) {
  const embedder = getEmbedder();
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    vectors.push(...(await embedder.embed(texts.slice(i, i + BATCH_SIZE))));
  }
  return vectors;
}

export async function embedText(text) {
  const [vector] = await embedTexts([text]);
  return vector;
}
