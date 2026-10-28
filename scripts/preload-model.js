// Downloads the local embedding model at image build time so containers start offline-ready.
import { localEmbedder } from '../src/services/ai/localEmbedder.js';

const [vector] = await localEmbedder.embed(['warm up']);
console.log(`Embedding model ready (${localEmbedder.name}, ${vector.length} dims)`);
