FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
WORKDIR /app
COPY app ./app
COPY src ./src
COPY types ./types
COPY public ./public
COPY scripts ./scripts
COPY drizzle ./drizzle
COPY auth.ts middleware.ts next-env.d.ts next.config.mjs drizzle.config.ts postcss.config.js tailwind.config.ts tsconfig.json ./
ARG NEXT_PUBLIC_AUTH_REFRESH_INTERVAL_SECONDS=600
ENV NEXT_PUBLIC_AUTH_REFRESH_INTERVAL_SECONDS=${NEXT_PUBLIC_AUTH_REFRESH_INTERVAL_SECONDS}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/drizzle.config.ts /app/tsconfig.json ./
COPY --chown=node:node docker ./docker
RUN mkdir -p /app/data && chown node:node /app/data && chmod 755 /app/docker/entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["./docker/entrypoint.sh"]
