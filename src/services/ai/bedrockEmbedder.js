// Amazon Titan Text Embeddings v2 through Bedrock Runtime (IAM auth: bedrock:InvokeModel).
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import config from '../../config/index.js';

const { bedrockModel, bedrockDimensions } = config.embeddings;
let client;

async function embedOne(text) {
  client ??= new BedrockRuntimeClient({ region: config.aws.region });
  const response = await client.send(
    new InvokeModelCommand({
      modelId: bedrockModel,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ inputText: text, dimensions: bedrockDimensions, normalize: true }),
    }),
  );
  return JSON.parse(new TextDecoder().decode(response.body)).embedding;
}

export const bedrockEmbedder = {
  name: `bedrock:${bedrockModel}:${bedrockDimensions}`,
  dimensions: bedrockDimensions,
  async embed(texts) {
    // Titan embeds one input per call; keep a small concurrency window.
    const results = new Array(texts.length);
    const concurrency = 4;
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(concurrency, texts.length) }, async () => {
        while (next < texts.length) {
          const i = next++;
          results[i] = await embedOne(texts[i]);
        }
      }),
    );
    return results;
  },
  warmUp: async () => {},
};
