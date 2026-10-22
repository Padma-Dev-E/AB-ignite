# Idea AI Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-only, auditable Gemini workflow foundation that can process ideas through validation, enrichment, risk review, routing, human decision, and later impact measurement without connecting the existing frontend yet.

**Architecture:** Keep `ideas` as the current product aggregate, add immutable idea versions and append-only workflow/audit records, and execute named AI jobs through one typed provider-independent runner. Use Gemini only through a server-only `@google/genai` adapter, persist every run with idempotency and bounded retries, and expose authenticated backend contracts only after the core service is tested.

**Tech Stack:** Next.js 15 App Router, TypeScript, Auth.js/NextAuth v5, Drizzle ORM, SQLite for local development, `@google/genai`, Zod, Node test runner, `tsx`, Tailwind UI unchanged.

**Spec:** `docs/superpowers/specs/2026-10-22-idea-ai-platform-design.md`

## Global Constraints

- Gemini is the only model provider, accessed from server-only code through `@google/genai`.
- No frontend page or browser bundle may receive Gemini credentials or call Gemini directly.
- AI output is decision support; authorized humans remain the final authority for high-impact workflow decisions.
- User content is untrusted data and must never be interpreted as executable instructions, SQL, URLs, tools, or workflow transitions.
- Structured output must pass JSON parsing and server-side Zod validation; malformed output fails closed.
- Existing roles remain exactly `admin` and `user`; existing public idea statuses remain the display vocabulary.
- SQLite is the local development database; queue/database interfaces must leave a clear production migration path.
- Raw passwords, API keys, refresh tokens, full prompts, and raw idea content must not appear in ordinary logs.
- All provider/runtime limits and token lifetimes are configured through environment variables and validated at startup.
- The frontend remains disconnected from these backend contracts until the backend foundation and tests are complete.

## Review Focus

- Malformed or schema-invalid Gemini output must create a failed run and human fallback, never a guessed result — pinned by provider/runner contract tests in Tasks 2, 3, and 6.
- Repeated submission or retry with the same idempotency key must not create duplicate work or duplicate side effects — pinned by repository tests in Task 5.
- Prompt injection, secrets, and restricted data in idea content must be blocked or redacted before provider submission — pinned by safety-policy tests in Task 4.
- Provider timeout, rate limit, and transient failure must retry only within configured bounds and then become an auditable failure — pinned by fake-provider/runner tests in Tasks 3 and 6.
- A user must not read another user’s idea/run or perform reviewer/admin actions without authorization — pinned by route tests in Task 9.

## File Map

### Configuration and dependencies

- Modify `package.json` and `package-lock.json`: add `@google/genai` and `zod`; add explicit AI test/worker scripts.
- Modify `.env.example`: document Gemini, AI safety, timeout, retry, retention, and concurrency settings.

### AI platform core

- Create `src/lib/ai/types.ts`: provider, job, actor, run status, usage, error, and JSON-schema types.
- Create `src/lib/ai/config.ts`: validated server-only environment configuration.
- Create `src/lib/ai/errors.ts`: typed provider, validation, policy, timeout, and idempotency errors.
- Create `src/lib/ai/provider.ts`: injectable `AiProvider` interface.
- Create `src/lib/ai/gemini-provider.ts`: server-only Gemini adapter and structured-output request.
- Create `src/lib/ai/policy.ts`: input limits, data-classification policy, redaction/blocking, and prompt-injection boundaries.
- Create `src/lib/ai/runner.ts`: generic idempotent job execution coordinator.
- Create `src/lib/ai/registry.ts`: allowlisted job registry and job lookup.
- Create `src/lib/ai/schemas/common.ts`: shared bounded schemas.

### Idea domain and jobs

- Create `src/lib/ideas/schemas.ts`: idea input, version, risk, question, route, estimate, and review schemas.
- Create `src/lib/ideas/repository.ts`: idea/version/run/event/review persistence operations.
- Create `src/lib/ideas/workflow.ts`: authorized status-transition rules and event creation.
- Create `src/lib/ai/jobs/idea-preflight.ts`: preflight job definition.
- Create `src/lib/ai/jobs/idea-validate.ts`: validation job definition.
- Create `src/lib/ai/jobs/idea-enrich.ts`: enrichment job definition.
- Create `src/lib/ai/jobs/idea-questions.ts`: clarification-question job definition.
- Create `src/lib/ai/jobs/idea-risk.ts`: risk/control job definition.
- Create `src/lib/ai/jobs/idea-route.ts`: routing/priority job definition.
- Create `src/lib/ai/jobs/idea-similar.ts`: related-idea job definition.
- Create `src/lib/ai/jobs/idea-estimate.ts`: benefit/effort estimate job definition.
- Create `src/lib/ai/jobs/idea-decision-pack.ts`: reviewer packet job definition.
- Create `src/lib/ai/jobs/idea-impact-plan.ts`: impact-plan job definition.

### Database and worker

- Modify `src/db/schema.ts`: add immutable idea versions, AI runs, normalized AI results, audit events, and human reviews.
- Modify `src/db/index.ts`: export the new server-side repositories/types if needed.
- Create generated migration `drizzle/0002_*.sql` and matching metadata files through Drizzle Kit.
- Create `src/lib/ai/worker.ts`: claim, execute, complete, retry, and dead-letter queued runs.
- Create `scripts/run-ai-worker.ts`: local worker entry point.

### Server contracts

- Create `app/api/ideas/route.ts`: authenticated create/read boundary for ideas.
- Create `app/api/ideas/[id]/submit/route.ts`: idempotent submission boundary.
- Create `app/api/ideas/[id]/ai-status/route.ts`: authorized run status boundary.
- Create `app/api/ideas/[id]/decision-pack/route.ts`: authorized latest reviewer packet boundary.
- Create `app/api/ideas/[id]/review/route.ts`: human review boundary.
- Create `app/api/ideas/[id]/ai-retry/route.ts`: authorized retry boundary.
- Create `app/api/admin/ai/runs/route.ts`: admin operational view.

### Tests and documentation

- Create `test/ai-foundation.test.mjs`: source-level safety/config/registration assertions.
- Create `test/ai-runtime.test.ts`: fake-provider, schema, runner, policy, and idempotency tests.
- Create `test/idea-workflow.test.ts`: domain transition/repository tests.
- Create `test/ai-api.test.ts`: route authorization and error-envelope tests.
- Modify `README.md` if present or create `docs/ai-backend.md`: local setup, worker use, env configuration, and production boundaries.

## Task 1: Add dependencies and validated AI configuration

**Files:**
- Modify: `package.json`, `package-lock.json`, `.env.example`
- Create: `src/lib/ai/config.ts`
- Create: `test/ai-foundation.test.mjs`

**Interfaces:**
- Produces `getAiConfig(): AiConfig`, where `AiConfig` contains provider key, model, base URL, timeout, retry, token/output limits, allowed classification, rate/concurrency, and retention values.
- Produces package scripts `test:ai` (all TypeScript AI tests under `test/`) and `ai:worker`.

- [ ] **Step 1: Write failing configuration/source tests**

Add assertions that the package uses `@google/genai` and `zod`, `.env.example` contains every required AI variable, no `NEXT_PUBLIC_GEMINI` variable exists, and configuration is imported from a server-only module.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --test-name-pattern="AI"`  
Expected: FAIL because the AI dependency/configuration does not exist yet.

- [ ] **Step 3: Add dependencies and scripts**

Install the official `@google/genai` SDK and `zod`. Add `test:ai` using `tsx --test test/*.test.ts`, so it runs the tests that exist at each task boundary, and add `ai:worker` using `tsx scripts/run-ai-worker.ts`.

- [ ] **Step 4: Implement `getAiConfig()`**

Read `GEMINI_API_KEY` with `GOOGLE_API_KEY` as a documented fallback, require a key only when the real provider is constructed, parse positive integers/floats, enforce maximum input/output bounds, and fail closed on invalid production values. Keep the module server-only.

- [ ] **Step 5: Document environment values**

Add the exact variables from the spec to `.env.example`, including `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`, `GEMINI_MAX_ATTEMPTS`, `GEMINI_RETRY_INITIAL_DELAY_MS`, `GEMINI_RETRY_MAX_DELAY_MS`, `GEMINI_MAX_OUTPUT_TOKENS`, `GEMINI_TEMPERATURE`, `AI_MAX_INPUT_CHARS`, `AI_MAX_OUTPUT_BYTES`, `AI_ALLOWED_DATA_CLASSIFICATION`, `AI_LOG_SENSITIVE`, `AI_RATE_LIMIT_PER_USER`, `AI_GLOBAL_CONCURRENCY`, and `AI_RETENTION_DAYS`.

- [ ] **Step 6: Run verification**

Run: `npm test` and `npm run build`  
Expected: existing tests and the new source/configuration tests pass; the build remains successful.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/ai/config.ts test/ai-foundation.test.mjs
git commit -m "feat: add validated AI configuration"
```

## Task 2: Define provider, job, result, and schema contracts

**Files:**
- Create: `src/lib/ai/types.ts`, `src/lib/ai/errors.ts`, `src/lib/ai/provider.ts`
- Create: `src/lib/ai/schemas/common.ts`, `src/lib/ideas/schemas.ts`
- Modify: `test/ai-foundation.test.mjs`
- Create: `test/ai-runtime.test.ts`

**Interfaces:**
- `AiProvider.generateStructured<T>(request: StructuredGenerationRequest): Promise<StructuredGenerationResponse>`.
- `AiJobDefinition<TInput, TOutput>` with `key`, `version`, `model`, `systemPrompt`, `inputSchema`, `outputSchema`, `responseJsonSchema`, `buildInput`, and `safety`.
- `AiRunResult<TOutput>` with `runId`, `jobKey`, `jobVersion`, `promptVersion`, `model`, `data`, `attempts`, `latencyMs`, optional usage, and finish reason.
- Shared schemas: `RiskFinding`, `ClarifyingQuestion`, `DuplicateCandidate`, `RecommendedRoute`, `EstimatedImpact`, and `NextAction`.

- [ ] **Step 1: Write failing type/runtime tests**

Test that a valid structured response parses, an unknown enum is rejected, scores are bounded, arrays cannot exceed configured limits, and provider errors map to typed error classes.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:ai -- test/ai-runtime.test.ts`  
Expected: FAIL because the contracts and schemas are missing.

- [ ] **Step 3: Implement shared types and errors**

Define exact discriminated unions for run status (`queued`, `running`, `succeeded`, `failed`, `timed_out`, `cancelled`), provider error categories, actor kinds (`user`, `admin`, `system`, `ai`), and safe usage metadata. Do not include raw prompts or raw provider payloads in public result types.

- [ ] **Step 4: Implement bounded Zod schemas**

Use strict objects, bounded strings, bounded arrays, numeric ranges, and explicit enums. Define idea input separately from AI output so model output cannot silently overwrite user-owned fields.

- [ ] **Step 5: Implement the provider interface**

Keep the interface provider-neutral, pass `responseMimeType: "application/json"` and a restricted response schema through the request abstraction, and let the runner perform the final Zod parse.

- [ ] **Step 6: Run verification**

Run: `npm run test:ai -- test/ai-runtime.test.ts`  
Expected: PASS for valid/invalid schema and error-mapping tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/types.ts src/lib/ai/errors.ts src/lib/ai/provider.ts src/lib/ai/schemas/common.ts src/lib/ideas/schemas.ts test/ai-runtime.test.ts test/ai-foundation.test.mjs
git commit -m "feat: define structured AI contracts"
```

## Task 3: Implement the server-only Gemini adapter

**Files:**
- Create: `src/lib/ai/gemini-provider.ts`
- Modify: `test/ai-runtime.test.ts`, `test/ai-foundation.test.mjs`

**Interfaces:**
- `createGeminiProvider(config?: AiConfig): AiProvider`.
- The adapter owns `GoogleGenAI`, model invocation, response MIME/schema configuration, bounded retries, timeout handling, and provider error normalization.

- [ ] **Step 1: Write failing adapter tests with a mocked SDK**

Test successful JSON response, invalid JSON response, provider 429/5xx mapping, timeout, maximum-attempt enforcement, and absence of API key in error messages. Test that the request contains the configured model and JSON response schema.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ai -- test/ai-runtime.test.ts`  
Expected: FAIL because the Gemini adapter is missing.

- [ ] **Step 3: Implement `createGeminiProvider()`**

Construct `GoogleGenAI` only in the server module. Call `models.generateContent` with the job’s system prompt, bounded user payload, `responseMimeType: "application/json"`, and restricted response schema. Use explicit timeout and retry configuration; normalize errors without logging secrets or raw prompt content.

- [ ] **Step 4: Enforce response-size and usage limits**

Reject output larger than `AI_MAX_OUTPUT_BYTES`, preserve only bounded usage fields, and return a typed `ProviderOutputError` for malformed or missing text.

- [ ] **Step 5: Run verification**

Run: `npm run test:ai -- test/ai-runtime.test.ts` and `npm run build`  
Expected: all adapter tests pass and the server-only import builds successfully.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/gemini-provider.ts test/ai-runtime.test.ts test/ai-foundation.test.mjs
git commit -m "feat: add server-only Gemini provider"
```

## Task 4: Add input safety policy and redacted observability

**Files:**
- Create: `src/lib/ai/policy.ts`
- Create: `src/lib/ai/observability.ts`
- Modify: `src/lib/ai/types.ts`, `test/ai-runtime.test.ts`

**Interfaces:**
- `evaluateAiInput(input: unknown, policy: AiSafetyPolicy): SafeAiInput | PolicyBlock`.
- `redactAiError(error: unknown): SafeErrorMetadata`.
- `SafeAiInput` contains bounded serialized content, classification, content hash, and redaction summary; it never contains credentials.

- [ ] **Step 1: Write failing policy tests**

Test oversized input, restricted classification, obvious credential patterns, PII/secrets policy behavior, prompt-injection-like instructions, safe bounded content, and redacted error metadata. Assert the provider is not called when policy blocks input.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ai -- test/ai-runtime.test.ts`  
Expected: FAIL because safety policy is missing.

- [ ] **Step 3: Implement policy evaluation**

Treat all idea fields as data inside delimiters. Apply configured max lengths, block restricted data by default, redact only configured high-confidence secret patterns, and return a human-review policy block when automatic processing is unsafe. Do not claim that a regex-based detector is a complete DLP system.

- [ ] **Step 4: Implement redacted observability**

Log only run/job/correlation IDs, status, duration, attempt count, bounded error code, and content hash. Explicitly strip API keys, tokens, passwords, prompts, model text, and idea body fields.

- [ ] **Step 5: Run verification**

Run: `npm run test:ai -- test/ai-runtime.test.ts`  
Expected: PASS, including the assertion that blocked input never reaches the provider.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/policy.ts src/lib/ai/observability.ts src/lib/ai/types.ts test/ai-runtime.test.ts
git commit -m "feat: enforce AI input safety and redacted logs"
```

## Task 5: Add database tables and repositories for immutable workflow history

**Files:**
- Modify: `src/db/schema.ts`, `src/db/index.ts`
- Create: generated `drizzle/0002_*.sql` and matching `drizzle/meta/*`
- Create: `src/lib/ideas/repository.ts`
- Create: `test/idea-workflow.test.ts`

**Interfaces:**
- `createIdeaVersion(input): Promise<IdeaVersion>`.
- `createAiRun(input): Promise<AiRun>` with unique `idempotencyKey`.
- `claimNextAiRun(workerId, now): Promise<AiRun | null>`.
- `completeAiRun(runId, result): Promise<void>`.
- `failAiRun(runId, failure): Promise<void>`.
- `appendIdeaEvent(input): Promise<IdeaEvent>`.
- `recordHumanReview(input): Promise<IdeaReview>`.
- `getAuthorizedIdeaSnapshot(actor, ideaId): Promise<AuthorizedIdeaSnapshot | null>`.

- [ ] **Step 1: Write failing database tests**

Test immutable idea version creation, unique idempotency, run status persistence, append-only event insertion, human/AI result separation, ownership filtering, and foreign-key cleanup behavior.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ai -- test/idea-workflow.test.ts`  
Expected: FAIL because the new tables/repository do not exist.

- [ ] **Step 3: Add Drizzle schema definitions**

Add `idea_versions`, `ai_runs`, `idea_ai_results`, `idea_events`, and `idea_reviews` with indexes on idea, status, idempotency key, correlation ID, and timestamps. Store normalized result JSON only after schema validation. Make audit events append-only at the repository boundary.

- [ ] **Step 4: Generate and apply the migration**

Run: `npm run db:generate` and `npm run db:migrate` against a clean local database. Inspect the SQL before applying it; do not overwrite existing migrations.

- [ ] **Step 5: Implement repository methods**

Use transactions for submission/version/event/run creation. Treat an existing idempotency key as the original run, never as permission to create a second run. Use SQLite-safe claim/update behavior and preserve all timestamps in UTC.

- [ ] **Step 6: Run verification**

Run: `npm run test:ai -- test/idea-workflow.test.ts`, `npm test`, and `npm run db:migrate`  
Expected: all tests pass and migration is idempotent on the existing development database.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts src/db/index.ts src/lib/ideas/repository.ts drizzle test/idea-workflow.test.ts
git commit -m "feat: persist idea AI workflow history"
```

## Task 6: Implement the generic idempotent AI runner

**Files:**
- Create: `src/lib/ai/runner.ts`
- Create: `src/lib/ai/registry.ts`
- Modify: `src/lib/ai/types.ts`, `src/lib/ideas/repository.ts`
- Modify: `test/ai-runtime.test.ts`

**Interfaces:**
- `registerAiJob<TInput, TOutput>(job: AiJobDefinition<TInput, TOutput>): void`.
- `getAiJob(key, version?): AiJobDefinition<unknown, unknown>`.
- `runStructuredAi<TInput, TOutput>(args: RunStructuredAiArgs<TInput, TOutput>): Promise<AiRunResult<TOutput>>`.

- [ ] **Step 1: Write failing runner tests**

Test success persistence, input schema rejection, policy block, duplicate idempotency, schema-invalid output, bounded retry, timeout, failure persistence, and result metadata.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ai -- test/ai-runtime.test.ts`  
Expected: FAIL because the registry and runner are missing.

- [ ] **Step 3: Implement the allowlisted registry**

Register only code-defined jobs. Reject unknown keys, duplicate versions, arbitrary caller prompts, and output schemas that are not part of the registered job.

- [ ] **Step 4: Implement `runStructuredAi()`**

Validate input, evaluate policy, create or reuse an idempotent run, invoke the injected provider, parse/validate output, persist normalized result, append an event, and return bounded metadata. Retry only provider-classified transient failures; never retry policy blocks or schema-invalid output without a new explicit attempt policy.

- [ ] **Step 5: Add concurrency and timeout boundaries**

Use a process-local semaphore for local development, a per-run timeout, and a clear interface for a distributed limiter later. Do not hold a database transaction open while waiting for Gemini.

- [ ] **Step 6: Run verification**

Run: `npm run test:ai -- test/ai-runtime.test.ts`  
Expected: PASS for success, failure, retry, idempotency, and schema tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/runner.ts src/lib/ai/registry.ts src/lib/ai/types.ts src/lib/ideas/repository.ts test/ai-runtime.test.ts
git commit -m "feat: add idempotent structured AI runner"
```

## Task 7: Implement the complete idea job catalog

**Files:**
- Create: `src/lib/ai/jobs/idea-preflight.ts`, `idea-validate.ts`, `idea-enrich.ts`, `idea-questions.ts`, `idea-risk.ts`
- Create: `src/lib/ai/jobs/idea-route.ts`, `idea-similar.ts`, `idea-estimate.ts`, `idea-decision-pack.ts`, `idea-impact-plan.ts`
- Modify: `src/lib/ai/registry.ts`, `src/lib/ideas/schemas.ts`
- Modify: `test/ai-runtime.test.ts`, `test/ai-foundation.test.mjs`

**Interfaces:**
- Each module exports one `AiJobDefinition<Input, Output>` with a stable key and version.
- Each job uses the shared runner and returns a strict schema-approved object.

- [ ] **Step 1: Write failing job-contract tests**

Assert all ten keys are registered, every job has a non-empty version/system prompt, an explicit response schema, bounded input/output schemas, and no job exposes a tool/function-calling capability.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ai -- test/ai-runtime.test.ts`  
Expected: FAIL because the jobs are not registered.

- [ ] **Step 3: Implement preflight and validation jobs**

Implement `idea.preflight` and `idea.validate` using the exact output fields from the approved spec. Force high-risk or low-confidence results to `needs_human_review`; keep the original user text outside model-owned fields.

- [ ] **Step 4: Implement enrichment and question jobs**

Implement `idea.enrich` and `idea.questions` with bounded summaries, tags, assumptions, evidence gaps, and answer types.

- [ ] **Step 5: Implement risk, route, similar, and estimate jobs**

Implement risk categories, control-review recommendations, routing suggestions, duplicate candidates, and estimate bands. Make every recommendation advisory and include assumptions/confidence.

- [ ] **Step 6: Implement decision-pack and impact-plan jobs**

Build these jobs from previously normalized results and explicit evidence fields. Do not let them invent missing figures or change workflow state.

- [ ] **Step 7: Register all jobs and run verification**

Run: `npm run test:ai -- test/ai-runtime.test.ts` and `npm run build`  
Expected: all job contract tests pass and the Next.js build succeeds without client-bundle imports.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/jobs src/lib/ai/registry.ts src/lib/ideas/schemas.ts test/ai-runtime.test.ts test/ai-foundation.test.mjs
git commit -m "feat: add idea analysis job catalog"
```

## Task 8: Implement workflow transitions and local worker execution

**Files:**
- Create: `src/lib/ideas/workflow.ts`
- Create: `src/lib/ai/worker.ts`, `scripts/run-ai-worker.ts`
- Modify: `package.json`, `src/lib/ideas/repository.ts`
- Create: `test/idea-workflow.test.ts`

**Interfaces:**
- `canTransitionIdeaStatus(actor, from, to): boolean`.
- `transitionIdeaStatus(actor, ideaId, to, reason): Promise<Idea>`.
- `processNextAiRun(workerId): Promise<WorkerOutcome>`.
- `runIdeaScreeningWorkflow(ideaId, versionId, actor): Promise<void>`.

- [ ] **Step 1: Write failing transition/worker tests**

Test allowed `screening → returned/business_review/control_review`, human-only decision transitions, reviewer/admin restrictions, retry/dead-letter behavior, and worker idempotency.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ai -- test/idea-workflow.test.ts`  
Expected: FAIL because workflow/worker code is missing.

- [ ] **Step 3: Implement transition policy**

Encode legal transitions, actor requirements, risk/control gates, and event creation. Reject model-requested direct transitions and preserve a reason for every human decision.

- [ ] **Step 4: Implement the local worker**

Claim one queued run, resolve its registered job, execute through the generic runner/provider boundary, update status, enqueue the next stage only after success, and stop after configured retry/dead-letter limits.

- [ ] **Step 5: Add local worker command**

Implement a bounded polling process for local development. It must not start automatically from a Next.js request and must exit cleanly on SIGINT/SIGTERM.

- [ ] **Step 6: Run verification**

Run: `npm run test:ai -- test/idea-workflow.test.ts`, `npm run ai:worker -- --once`, and `npm run build`  
Expected: workflow tests pass; `--once` exits safely when no job exists; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ideas/workflow.ts src/lib/ai/worker.ts scripts/run-ai-worker.ts package.json src/lib/ideas/repository.ts test/idea-workflow.test.ts
git commit -m "feat: add auditable idea workflow worker"
```

## Task 9: Add authenticated backend contracts without frontend wiring

**Files:**
- Create: `app/api/ideas/route.ts`
- Create: `app/api/ideas/[id]/submit/route.ts`
- Create: `app/api/ideas/[id]/ai-status/route.ts`
- Create: `app/api/ideas/[id]/decision-pack/route.ts`
- Create: `app/api/ideas/[id]/review/route.ts`
- Create: `app/api/ideas/[id]/ai-retry/route.ts`
- Create: `app/api/admin/ai/runs/route.ts`
- Create: `src/lib/http/errors.ts`
- Create: `test/ai-api.test.ts`

**Interfaces:**
- All routes return `{ data, error, requestId }` with status-specific HTTP codes.
- Authenticated user endpoints use `auth()` and owner/admin authorization.
- Human review and retry endpoints require reviewer/admin capability; initial implementation may map admin to reviewer until reviewer groups are modeled.

- [ ] **Step 1: Write failing route tests**

Test unauthenticated 401, foreign idea 404/403 without information leakage, normal-user owner access, admin access, invalid payload 400, duplicate submit idempotency, and safe error envelopes without provider details.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:ai -- test/ai-api.test.ts`  
Expected: FAIL because route contracts are missing.

- [ ] **Step 3: Implement shared HTTP error envelope**

Generate a request ID, map validation/auth/not-found/conflict/provider errors to stable responses, and never include raw Gemini error text or sensitive input.

- [ ] **Step 4: Implement idea create/submit/status routes**

Validate with Zod, create immutable versions/events, enqueue idempotent screening, and return durable IDs. Do not call Gemini inside the request.

- [ ] **Step 5: Implement reviewer/admin routes**

Return only authorized status/results, record human reviews through workflow policy, allow explicit retry of failed runs, and expose bounded admin operational metadata.

- [ ] **Step 6: Run verification**

Run: `npm run test:ai -- test/ai-api.test.ts`, `npm test`, and `npm run build`  
Expected: all authorization/error tests pass and the frontend remains unchanged.

- [ ] **Step 7: Commit**

```bash
git add app/api/ideas app/api/admin/ai src/lib/http/errors.ts test/ai-api.test.ts
git commit -m "feat: add authenticated idea AI API contracts"
```

## Task 10: Add operational documentation and production readiness checks

**Files:**
- Create or modify: `docs/ai-backend.md`
- Modify: `test/ai-foundation.test.mjs`, `README.md` if present

**Interfaces:**
- Documentation defines local setup, fake-provider tests, worker invocation, environment values, retention behavior, and production migration boundaries.

- [ ] **Step 1: Write documentation/source tests**

Assert docs explain server-only credentials, no frontend Gemini calls, worker startup, fake-provider testing, and SQLite’s local-only scaling boundary.

- [ ] **Step 2: Implement the operational guide**

Document `npm run db:migrate`, `npm run db:seed`, `npm run test:ai`, `npm run build`, `npm run ai:worker -- --once`, secret-manager expectations, redacted logging, and failure recovery.

- [ ] **Step 3: Run the full verification matrix**

Run:

```bash
npm test
npm run test:ai
npm run db:migrate
npm run db:seed
npm run build
npm audit --omit=dev --json
```

Expected: all tests, migration, seed, and build pass. Report any remaining audit advisory separately; do not silently upgrade unrelated major framework dependencies.

- [ ] **Step 4: Commit**

```bash
git add docs/ai-backend.md README.md test/ai-foundation.test.mjs
git commit -m "docs: document AI backend operations"
```

## Self-review checklist

- Spec coverage: Tasks 1–4 cover provider/configuration/safety; Tasks 5–8 cover persistence, jobs, workflow, and worker; Task 9 covers backend contracts; Task 10 covers operations and verification.
- Type consistency: `AiProvider`, `AiJobDefinition`, `runStructuredAi`, repository methods, and worker methods are named once and consumed consistently.
- Security: the plan tests server-only credentials, policy blocking, redacted errors, owner/admin authorization, and human-only transitions.
- Scaling: the local SQLite worker is explicitly bounded, and repository/worker interfaces preserve a PostgreSQL/durable-queue migration path.
- Frontend scope: no page or UI component is modified until a later approved integration phase.

## Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-22-idea-ai-platform.md`. Implementation should begin only after this plan is reviewed and an execution method is selected.
