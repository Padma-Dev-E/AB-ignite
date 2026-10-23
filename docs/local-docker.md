# Local production Docker stack

This stack runs the production Next.js build on **http://localhost:3100/login**. The published port binds only to the local host, leaving the development server on port 3001 alone. Docker stores SQLite in the named volume `ab-ignite-local_sqlite_data`. On its first setup, it uses SQLite's online backup to copy the development database from `./data` into that volume. The development database remains in place and is mounted read-only during setup. Later starts preserve the Docker copy.

## Before starting

- This local test uses the current working code and existing `.env`. Setup requires a nonempty `DEFAULT_ADMIN_PASSWORD`; the existing local test password is accepted. Do not commit or share `.env`.
- `AUTH_SECRET` must be at least 32 characters.
- The Compose `env_file` supplies `.env` to containers at runtime. `.dockerignore` excludes it from the image build. Compose explicitly sets `DATABASE_URL=/app/data/ab-ignite.db`, so the app uses the copied volume database even if the development `.env` uses a relative path.
- Only the public refresh interval enters the build as `NEXT_PUBLIC_AUTH_REFRESH_INTERVAL_SECONDS`. If you change it, rebuild the image. Runtime secrets are never build arguments.
- The current notification worker needs SMTP configuration and is therefore opt-in. The AI worker is also opt-in and requires a Gemini key.
- The Docker build omits the app's optional `instrumentation.ts`; the setup job seeds the quiz and article catalogues before serving traffic.

## Start, inspect, and stop

Build and start the web app and AI worker when a Gemini key is configured:

```bash
docker compose --profile ai up -d --build
docker compose --profile ai ps
docker compose --profile ai logs --tail=100 setup web ai-worker
curl -I http://localhost:3100/login
curl -I http://localhost:3100/admin
```

Add `--profile email` when `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM` (plus paired SMTP credentials if needed) are configured. The web service checks `/login`; worker processes are restarted if they exit. The setup job must finish successfully before the web or workers start. It imports the database only if the volume has no database, applies Drizzle migrations, and runs the idempotent seed, which also ensures the configured admin account exists. Existing admin passwords are not reset by the seed.

```bash
docker compose --profile ai --profile email up -d --build
```

To stop without deleting data, run `docker compose --profile ai --profile email down`. Do not add `-v`; that option removes the SQLite volume. Back up `ab-ignite-local_sqlite_data` before any destructive maintenance or migration rollback.

This is a single-host local deployment. SQLite and its queue are shared through one Docker volume and should not be scaled across hosts. The AI backend documentation describes the additional controls needed for a bank production deployment.
