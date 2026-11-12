# syntax=docker/dockerfile:1
# Build the static export, then serve plain files from a non-root nginx.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global npm@12.0.2
COPY package.json package-lock.json .npmrc ./
COPY api/.npmrc api/package.json api/package-lock.json ./api/
RUN npm ci && npm ci --prefix api
COPY . .
# These are public metadata, never credentials. Railway provides the same origin to the API at runtime.
ARG SITE_ORIGIN
ENV SITE_ORIGIN=$SITE_ORIGIN
# Public recipient, embedded in the static export. Empty uses the application's single default.
ARG JIFUNZE_FEEDBACK_EMAIL
ENV JIFUNZE_FEEDBACK_EMAIL=$JIFUNZE_FEEDBACK_EMAIL
RUN NODE_OPTIONS=--max-old-space-size=768 npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runner
COPY --chown=101:101 docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/jifunze-base.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --chmod=755 docker/railway-entrypoint.sh /docker-entrypoint.d/19-jifunze-railway.sh
COPY --from=build /app/out /usr/share/nginx/html
USER 101
EXPOSE 8080
