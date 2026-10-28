// Central, validated configuration. Everything environment-specific lives here so the rest
// of the app never reads process.env directly.

const env = process.env;

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const nodeEnv = env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const port = int(env.PORT, 3000);

function defaultLlmProvider() {
  if (env.LLM_PROVIDER) return env.LLM_PROVIDER;
  return env.ANTHROPIC_API_KEY ? 'anthropic' : 'none';
}

const llmProvider = defaultLlmProvider();
const defaultModelByProvider = {
  anthropic: 'claude-opus-5-5',
  aws: 'claude-opus-5-5', // Claude Platform on AWS uses first-party model IDs
  bedrock: 'anthropic.claude-opus-5-5',
};

const config = {
  nodeEnv,
  isProd,
  port,
  appUrl: (env.APP_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  appName: env.APP_NAME || 'Bookclub',

  mongoUri: env.MONGODB_URI || 'mongodb://localhost:27017/bookclub',
  // Amazon DocumentDB requires TLS with the RDS CA bundle (baked into the Docker image).
  mongoTlsCaFile: env.MONGODB_TLS_CA_FILE || undefined,

  sessionSecret: env.SESSION_SECRET || (isProd ? undefined : 'dev-only-insecure-session-secret'),

  google: {
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '',
  },

  // Password-less "sign in as any email" for local testing of multi-user flows (invites).
  // Hard-disabled in production regardless of the flag.
  devLoginEnabled: !isProd && bool(env.DEV_LOGIN_ENABLED, false),

  aws: {
    region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1',
  },

  llm: {
    provider: llmProvider, // anthropic | aws | bedrock | none
    model: env.LLM_MODEL || defaultModelByProvider[llmProvider] || null,
  },

  embeddings: {
    provider: env.EMBEDDING_PROVIDER || 'local', // local | bedrock
    bedrockModel: env.BEDROCK_EMBEDDING_MODEL || 'amazon.titan-embed-text-v2:0',
    bedrockDimensions: int(env.BEDROCK_EMBEDDING_DIMENSIONS, 512),
  },

  mail: {
    provider: env.MAIL_PROVIDER || 'console', // ses | smtp | console
    from: env.MAIL_FROM || 'Bookclub <no-reply@bookclub.local>',
    smtpHost: env.SMTP_HOST || 'localhost',
    smtpPort: int(env.SMTP_PORT, 1025),
  },

  invites: {
    ttlDays: int(env.INVITE_TTL_DAYS, 14),
    // Require the Google account email to match the invited address.
    requireEmailMatch: bool(env.INVITE_REQUIRE_EMAIL_MATCH, true),
  },

  seedCatalog: bool(env.SEED_CATALOG, false),
  openLibraryEnabled: bool(env.OPEN_LIBRARY_ENABLED, true),
};

export function assertConfig() {
  const problems = [];
  if (!config.sessionSecret) problems.push('SESSION_SECRET is required in production');
  if (config.isProd && (!config.google.clientId || !config.google.clientSecret)) {
    problems.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production');
  }
  if (!['anthropic', 'aws', 'bedrock', 'none'].includes(config.llm.provider)) {
    problems.push(`Unknown LLM_PROVIDER "${config.llm.provider}"`);
  }
  if (!['local', 'bedrock'].includes(config.embeddings.provider)) {
    problems.push(`Unknown EMBEDDING_PROVIDER "${config.embeddings.provider}"`);
  }
  if (!['ses', 'smtp', 'console'].includes(config.mail.provider)) {
    problems.push(`Unknown MAIL_PROVIDER "${config.mail.provider}"`);
  }
  if (problems.length) {
    throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
  }
}

export const googleAuthEnabled = () => Boolean(config.google.clientId && config.google.clientSecret);

export default config;
