// Retrieval eval for "Ask the club": runs known questions against the demo club and reports
// hit@3 and mean reciprocal rank (MRR). Use it to compare chunking / scoring / embedding changes.
//   npm run eval:rag
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';
import { Club, User } from '../src/models/index.js';
import { createDemoClub } from '../src/seed/index.js';
import { reindexClub } from '../src/services/indexer.js';
import { search } from '../src/services/vectorStore.js';

// Each case: a question and a predicate over the retrieved chunk that marks a correct source.
const CASES = [
  ['Which book did people find too slow?', (c) => /Left Hand/.test(c.title) && /drag|slow|momentum/i.test(c.text)],
  ['What did Jonah think of Klara and the Sun?', (c) => c.title === `Jonah Reyes's review of "Klara and the Sun"` || (/Klara/.test(c.title) && /Jonah/.test(c.text))],
  ['Why is Circe on our list?', (c) => /Circe/.test(c.text) && /mytholog/i.test(c.text)],
  ['What motto did we talk about for the Traveling Symphony?', (c) => /survival is insufficient/i.test(c.text)],
  ['Who struggled with the invented vocabulary?', (c) => /vocabulary|invented terms/i.test(c.text)],
  ['Which book made someone cry?', (c) => /cry/i.test(c.text)],
  ['What did people say about the airport museum?', (c) => /airport|Museum of Civilization/i.test(c.text)],
  ['Did anyone dislike the ending of Klara and the Sun?', (c) => /Klara/.test(c.title + c.text) && /ending|cruel|brutal|cold/i.test(c.text)],
];

await connectDatabase();
const leader = await User.findOneAndUpdate(
  { email: 'rag-eval@example.com' },
  { $setOnInsert: { email: 'rag-eval@example.com', name: 'RAG Eval' } },
  { upsert: true, returnDocument: 'after' },
);
const club = (await Club.findOne({ leader: leader._id })) ?? (await createDemoClub(leader));
await reindexClub(club._id);

let hits = 0;
let rrSum = 0;
for (const [question, isRelevant] of CASES) {
  const results = await search(club._id, question, { k: 6, minScore: 0 });
  const rank = results.findIndex((r) => isRelevant(r.chunk)) + 1;
  if (rank && rank <= 3) hits++;
  rrSum += rank ? 1 / rank : 0;
  console.log(`${rank && rank <= 3 ? 'HIT ' : 'MISS'} rank=${rank || '-'}  ${question}  ->  ${results[0]?.chunk.title}`);
}
console.log(`\nhit@3 = ${hits}/${CASES.length}   MRR = ${(rrSum / CASES.length).toFixed(3)}`);
await disconnectDatabase();
