# Next.js frontend image. The API and AI worker use Dockerfile.backend.
FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS production-dependencies
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM dependencies AS build
WORKDIR /app
COPY app ./app
COPY src ./src
COPY types ./types
COPY public ./public
COPY auth.ts middleware.ts next-env.d.ts next.config.mjs postcss.config.js tailwind.config.ts tsconfig.json ./
ARG NEXT_PUBLIC_AUTH_REFRESH_INTERVAL_SECONDS=600
ARG API_INTERNAL_URL=http://api:4100
ENV NEXT_PUBLIC_AUTH_REFRESH_INTERVAL_SECONDS=${NEXT_PUBLIC_AUTH_REFRESH_INTERVAL_SECONDS} \
    API_INTERNAL_URL=${API_INTERNAL_URL} \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node package.json next.config.mjs ./
COPY --chown=node:node docker ./docker
RUN mkdir -p /app/data && chown node:node /app/data && chmod 755 /app/docker/entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["./docker/entrypoint.sh"]
