# AI Backend Operations

This document describes the current server-only idea AI backend. The frontend is intentionally disconnected until the API contracts and worker deployment are approved for integration.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `AUTH_SECRET` to a long random value for local sessions.
3. Add `GEMINI_API_KEY` only when intentionally testing against Gemini. Never use a `NEXT_PUBLIC_*` variable for provider credentials.
4. Apply the database and seed the default administrator:

```bash
npm run db:migrate
npm run db:seed
```

The default local admin is configured by `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD`; the password is stored as an Argon2id hash.

## AI configuration

The provider is accessed from server-only modules through `@google/genai`. `src/lib/ai/gemini-provider.ts` is the guarded Next.js entrypoint; `*-core.ts` modules are used by the local Node worker and still execute only in server processes.

Configure the model, timeout, retry, output, input, classification, rate, concurrency, and retention settings in `.env.local`. `GEMINI_API_KEY` falls back to `GOOGLE_API_KEY` for compatibility, but production should standardize on one secret name.

The model response must be JSON and is validated twice: Gemini receives a restricted response schema, then the server validates the parsed response with the registered Zod schema. Invalid output is recorded as a failed run and never repaired into a business decision.

## Tests and local worker

Use the deterministic fake provider tests when developing job schemas or workflow logic:

```bash
npm run test:ai
npm test
npm run build
```

The local worker is not started by a web request. Run one bounded poll with:

```bash
npm run ai:worker -- --once
```

Run the long-lived local worker with `npm run ai:worker`. It exits on SIGINT/SIGTERM. With no Gemini key and no queued work, `--once` safely reports `idle`; a queued run without a provider is recorded as a controlled failure.

## Workflow behavior

Idea submission stores an immutable version, an append-only event, and an idempotent queued AI run. The worker performs preflight and subsequent registered jobs. AI results are schema-validated and stored separately from user content. Human review is required for final decisions, high-risk findings, and low-confidence analysis.

Transient provider failures are retried with bounded backoff. Repeated failures become a failed/dead-letter state that an administrator can inspect and explicitly retry. Repeating an idempotency key returns the original run instead of creating duplicate work.

## Security and data handling

- Keep credentials in a secret manager in production; environment files are for local development only.
- Never put Gemini credentials in browser code, client components, logs, API responses, or `NEXT_PUBLIC_*` variables.
- Treat idea text and comments as untrusted data. Prompt-injection-like content, restricted classifications, and high-confidence credentials are blocked before provider submission.
- Normal logs contain IDs, hashes, status, duration, attempt count, and bounded error codes—not prompts, model output, passwords, tokens, or full idea bodies.
- The current regex-based sensitive-data detector is a safety boundary, not a complete DLP system. Bank compliance must approve the production DLP/redaction policy.
- AI run/result retention is controlled by `AI_RETENTION_DAYS`; add a scheduled deletion/archival job before production use.
- Human review and admin run access are protected by Auth.js roles. Foreign ideas return a generic not-found response rather than leaking ownership.

## Production boundary

SQLite is the local development database and is not the final multi-instance queue. Production should migrate the repository interfaces to PostgreSQL (or the selected managed database) and run the worker through a durable queue with distributed concurrency and rate limiting. Volume encryption, backups, secret rotation, provider policy, audit retention, alerting, and incident response must be configured by the bank deployment.

Before enabling frontend integration, verify:

1. Production secret-manager injection and key rotation.
2. Approved Gemini data-processing and classification policy.
3. Durable queue and worker scaling.
4. Retention/deletion jobs and audit access controls.
5. Load, authorization, prompt-injection, and provider-outage tests.
