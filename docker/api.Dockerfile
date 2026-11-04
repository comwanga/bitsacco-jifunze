# syntax=docker/dockerfile:1
# The account API: Node 24 runs the TypeScript sources directly (type stripping). Build from the repo root:
#   docker build -f docker/api.Dockerfile .
# Only api/package*.json, api/src and api/migrations go in: no tests, no secrets (they come from the environment).
FROM node:24.22.2-alpine3.24 AS deps
WORKDIR /app/api
RUN npm install --global npm@12.0.2
# api/.npmrc carries the same hardening as the root one (no git or remote specs, no install scripts).
COPY api/.npmrc api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24.22.2-alpine3.24 AS runner
ENV NODE_ENV=production
WORKDIR /app/api
COPY --from=deps /app/api/node_modules ./node_modules
COPY api/package.json api/package-lock.json ./
COPY api/src ./src
# main.ts migrates from ../migrations at boot.
COPY api/migrations ./migrations
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 3001}/api/health`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "src/main.ts"]
