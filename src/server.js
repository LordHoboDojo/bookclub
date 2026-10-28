import config, { assertConfig, googleAuthEnabled } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { seedCatalog } from './seed/index.js';
import { getEmbedder } from './services/ai/embeddings.js';
import { llmLabel } from './services/ai/llm.js';

assertConfig();
await connectDatabase();

if (config.seedCatalog) {
  const added = await seedCatalog();
  if (added) console.log(`[seed] added ${added} starter books to the catalog`);
}

// Import after the DB connection exists: the session store reuses the mongoose client.
const { createApp } = await import('./app.js');
const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[app] ${config.appName} listening on ${config.appUrl} (${config.nodeEnv})`);
  console.log(`[app] auth: ${googleAuthEnabled() ? 'Google OAuth' : 'Google OAuth NOT configured'}${config.devLoginEnabled ? ' + dev login' : ''}`);
  console.log(`[app] llm: ${llmLabel() ?? 'disabled (retrieval-only answers, similarity-only recommendations)'}`);
  console.log(`[app] embeddings: ${getEmbedder().name} | mail: ${config.mail.provider}`);
});

// Load the embedding model in the background so the first question doesn't pay for it.
getEmbedder().warmUp().catch((err) => console.warn(`[embeddings] warm-up failed: ${err.message}`));

async function shutdown(signal) {
  console.log(`[app] ${signal} received, shutting down`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
