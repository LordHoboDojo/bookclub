# syntax=docker/dockerfile:1

# ---- deps: install production dependencies only ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HF_CACHE_DIR=/app/.cache/hf
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# Amazon DocumentDB only accepts TLS connections signed by the AWS RDS CA bundle.
RUN curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
      -o /etc/ssl/certs/rds-global-bundle.pem

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Bake the local embedding model into the image so containers start without a download.
# Pass --build-arg PRELOAD_EMBEDDING_MODEL=false when EMBEDDING_PROVIDER=bedrock.
ARG PRELOAD_EMBEDDING_MODEL=true
RUN mkdir -p "$HF_CACHE_DIR" \
 && if [ "$PRELOAD_EMBEDDING_MODEL" = "true" ]; then node scripts/preload-model.js; fi \
 && chown -R node:node /app/.cache

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/healthz || exit 1

CMD ["node", "src/server.js"]
