// Claude client factory. One Messages API surface, three ways to reach it:
//   anthropic -> Claude API with an API key
//   bedrock   -> Claude in Amazon Bedrock (IAM / ECS task role, bedrock-mantle:CreateInference)
//   aws       -> Claude Platform on AWS (IAM auth, AWS billing, first-party feature parity)
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import AnthropicAws from '@anthropic-ai/aws-sdk';
import config from '../../config/index.js';

export class LLMRefusalError extends Error {
  constructor(category) {
    super('Claude declined this request.');
    this.name = 'LLMRefusalError';
    this.category = category;
  }
}

let cached;

function buildClient() {
  const { provider } = config.llm;
  switch (provider) {
    case 'anthropic':
      return new Anthropic();
    case 'bedrock':
      return new AnthropicBedrockMantle({ awsRegion: config.aws.region });
    case 'aws':
      return new AnthropicAws();
    default:
      return null;
  }
}

export function llmEnabled() {
  return config.llm.provider !== 'none';
}

export function llmLabel() {
  if (!llmEnabled()) return null;
  const via = { anthropic: 'Claude API', bedrock: 'Amazon Bedrock', aws: 'Claude Platform on AWS' };
  return `${config.llm.model} via ${via[config.llm.provider]}`;
}

function getClient() {
  if (cached === undefined) cached = buildClient();
  return cached;
}

// Server-side refusal fallbacks exist on the Claude API and Claude Platform on AWS, not on Bedrock.
const supportsServerFallbacks = () => ['anthropic', 'aws'].includes(config.llm.provider);

/**
 * Create a message with the configured model. Returns the full Message.
 * Throws LLMRefusalError when the safety classifiers decline the request.
 */
export async function createMessage(params) {
  const client = getClient();
  if (!client) throw new Error('No LLM provider configured');

  const request = { model: config.llm.model, max_tokens: 16000, ...params };
  const response = supportsServerFallbacks()
    ? await client.beta.messages.create({
        ...request,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      })
    : await client.messages.create(request);

  if (response.stop_reason === 'refusal') {
    throw new LLMRefusalError(response.stop_details?.category ?? null);
  }
  return response;
}

export function textOf(message) {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}
