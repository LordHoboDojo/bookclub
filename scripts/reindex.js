// Rebuilds every club's RAG knowledge base and clears stale book embeddings.
// Run after changing EMBEDDING_PROVIDER so all vectors live in the same space.
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Book, Chunk, Club } from '../src/models/index.js';
import { getEmbedder } from '../src/services/ai/embeddings.js';
import { reindexClub } from '../src/services/indexer.js';

await connectDatabase();
const embedder = getEmbedder();
console.log(`Re-indexing with ${embedder.name}`);

const { deletedCount } = await Chunk.deleteMany({ embeddingModel: { $ne: embedder.name } });
await Book.updateMany({ embeddingModel: { $ne: embedder.name } }, { $unset: { embedding: 1, embeddingModel: 1 } });
console.log(`Removed ${deletedCount} passages from other embedding models; book vectors will be recomputed on demand.`);

for (const club of await Club.find().select('name')) {
  const counts = await reindexClub(club._id);
  console.log(`  ${club.name}: ${counts.books} books, ${counts.reviews} reviews, ${counts.notes} notes`);
}
await disconnectDatabase();
