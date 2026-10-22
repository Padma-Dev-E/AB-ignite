# Idea AI Platform Design

**Date:** 2026-10-22  
**Status:** Draft — awaiting approval before implementation  
**Scope:** Backend foundation and future workflow wiring for the existing Idea platform UI

## 1. Intent

The application should turn an employee idea into a traceable, reviewable, measurable workflow. Gemini should assist with analysis, enrichment, risk discovery, routing, and reviewer preparation. It must not silently make a final banking, regulatory, security, or investment decision.

The existing UI already exposes the main product surfaces:

- Community: browse, filter, search, support, and discover ideas.
- New Idea: describe, develop, answer questions, validate, and quantify an idea.
- Idea Detail: lifecycle, supporting information, comments, and progress.
- Learn: journey, quizzes, ranking, and challenges.
- Library and Article: reusable knowledge and guidance.
- Rewards: recognition and contribution incentives.
- Account and notifications: identity, preferences, and workflow updates.
- Private and admin layouts: authenticated user experience and administrative controls.

This design makes those surfaces work from one consistent domain model instead of adding one-off AI calls or duplicated workflow logic.

## 2. Goals

1. Provide a generic, typed, server-only Gemini service that supports many jobs and structured JSON results.
2. Define a complete idea lifecycle from draft through measurable impact.
3. Make every AI result versioned, auditable, retryable, and attributable to a specific input and prompt version.
4. Keep user content untrusted and prevent prompt injection from changing application behavior.
5. Keep final decisions with authorized humans, especially for high-risk ideas.
6. Support asynchronous processing, idempotent retries, rate limits, and eventual migration from SQLite to a production database and worker queue.
7. Prepare backend contracts without connecting the existing frontend to the backend in this phase.
8. Reuse the same job runner for idea validation, routing, risk review, learning content, article drafting, and future workflows.

## 3. Non-goals for this phase

- Do not wire the current UI to API routes yet.
- Do not send real idea data to Gemini during local development or tests.
- Do not add autonomous tools, web search, code execution, database writes, or external actions to model calls.
- Do not allow AI to approve, reject, publish, implement, or close an idea without a human authorization step.
- Do not build attachment upload or document extraction yet.
- Do not treat SQLite as the final multi-instance production architecture.

## 4. Product lifecycle

The canonical lifecycle is:

```text
Draft
  -> Submitted
  -> AI preflight
  -> AI analysis
  -> Human review
  -> Control/risk review when required
  -> Decision: approved, returned, deferred, or rejected
  -> Proof of concept
  -> Implementation
  -> Impact measurement
  -> Implemented / Closed
```

The existing status values remain the public display vocabulary where possible:

- `screening`: submitted and awaiting automated preflight/triage.
- `returned`: missing information or clarification required.
- `business_review`: human business review.
- `control_review`: security, privacy, regulatory, legal, operational, or risk review.
- `decision`: authorized decision point.
- `poc`: proof of concept.
- `implementation`: delivery in progress.
- `implemented`: launched and measuring impact.
- `deferred`: valid idea postponed with a recorded reason.
- `rejected`: declined by an authorized human with an auditable reason.

AI may recommend a next stage, but only a permitted server-side workflow transition or authorized human action changes the status.

## 5. Reusable AI job framework

The backend will expose one generic service rather than separate Gemini implementations in each feature.

Conceptual API:

```ts
type AiJobDefinition<TInput, TOutput> = {
  key: string;
  version: string;
  model: string;
  systemPrompt: string;
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  buildInput: (input: TInput) => unknown;
  safety: AiSafetyPolicy;
};

type RunStructuredAiArgs<TInput, TOutput> = {
  job: AiJobDefinition<TInput, TOutput>;
  input: TInput;
  actor: AiActor;
  correlationId: string;
  idempotencyKey: string;
};

type AiRunResult<TOutput> = {
  data: TOutput;
  runId: string;
  model: string;
  jobKey: string;
  jobVersion: string;
  promptVersion: string;
  attempts: number;
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  finishReason?: string;
};
```

The implementation will have four separable layers:

1. **Job registry:** named jobs, versioned prompts, schemas, limits, and safety policy.
2. **Provider adapter:** Gemini-only adapter using the official `@google/genai` SDK.
3. **Run coordinator:** idempotency, timeout, retry/backoff, concurrency, persistence, and status handling.
4. **Domain jobs:** idea preflight, validation, risk, routing, questions, estimation, impact planning, and future learning-content jobs.

The provider adapter must be injectable. Tests use a deterministic fake provider; production can use Gemini without changing domain code.

### Structured output contract

Every job uses a canonical Zod schema and a restricted JSON Schema representation for Gemini. The result is accepted only if:

1. Gemini returns the expected MIME type and structured payload.
2. The JSON parses successfully.
3. The payload passes server-side schema validation.
4. Enumerations, bounds, array lengths, and string limits are valid.
5. Safety policy permits the result.

There will be no “repair arbitrary malformed JSON and continue” path for a decision-support job. Invalid output becomes a failed run that can be retried or sent to human review.

User-provided text is serialized as untrusted data inside explicit delimiters. It is never concatenated into system instructions, and its instructions are not treated as application commands.

## 6. Initial AI job catalog

All jobs share the same runner and audit model.

### `idea.preflight`

Checks completeness, language, accidental secrets, personally identifiable information, prompt-injection indicators, prohibited content, and duplicate candidates. It returns a safe-to-process decision and specific missing information.

### `idea.validate`

Produces structured decision support:

```ts
{
  decision: "accept" | "needs_clarification" | "needs_human_review" | "reject",
  recommendedStatus: IdeaStatus,
  confidence: number, // 0..1
  overallScore: number, // 0..100
  scores: {
    novelty: { score: number, rationale: string },
    problemClarity: { score: number, rationale: string },
    customerImpact: { score: number, rationale: string },
    employeeImpact: { score: number, rationale: string },
    strategicAlignment: { score: number, rationale: string },
    feasibility: { score: number, rationale: string },
    value: { score: number, rationale: string },
    risk: { score: number, rationale: string },
    urgency: { score: number, rationale: string },
    scalability: { score: number, rationale: string }
  },
  strengths: string[],
  gaps: string[],
  assumptions: string[],
  questions: ClarifyingQuestion[],
  risks: RiskFinding[],
  duplicates: DuplicateCandidate[],
  recommendedRoute: RecommendedRoute,
  estimatedImpact: EstimatedImpact,
  nextActions: NextAction[],
  auditSummary: string
}
```

High-risk findings must force `needs_human_review`; the AI must not produce an automatic final approval or rejection.

### `idea.enrich`

Generates a concise summary, suggested title, taxonomy, tags, affected teams, customer/employee value, assumptions, and a reviewer-ready problem statement. The original user content is preserved and never overwritten.

### `idea.questions`

Creates targeted questions for missing evidence, baseline measurements, users affected, dependencies, controls, cost, and implementation constraints. Each question includes why it matters, whether it is required, and an expected answer type.

### `idea.risk`

Classifies potential privacy, security, regulatory, operational, financial, reputational, data, model, and third-party risks. It suggests mitigations and identifies which control teams must review the idea.

### `idea.route`

Recommends category, department, reviewer groups, control reviews, priority band, and next workflow stage. Routing is advisory until authorized server-side policy validates it.

### `idea.similar`

Returns candidate related ideas and an explanation. The first version can use bounded database search and AI comparison. Embeddings/vector search are a later optimization and are not required for the initial implementation.

### `idea.estimate`

Produces benefit, effort, cost, time-to-value, affected-user, and confidence bands with explicit assumptions. It must not invent precise financial figures where no evidence exists.

### `idea.decision_pack`

Combines prior normalized results into a reviewer packet: summary, evidence, unresolved questions, risks, controls, options, recommendation, and human decision checklist.

### `idea.impact_plan`

Suggests baseline metrics, target metrics, measurement window, owner, instrumentation needs, and success/failure criteria for POC and implementation stages.

### Future shared jobs

The same framework can later support article drafts, quiz generation, challenge recommendations, feedback summarization, notification wording, and internal knowledge search. Those jobs must use separate prompts, schemas, permissions, and retention policies even though they share the runner.

## 7. Data model additions

The current `ideas` table remains the aggregate used by the UI. New tables should preserve history instead of putting mutable AI output directly on that row.

### `idea_versions`

Immutable snapshots of user-submitted content. Each submission and user edit gets a version with author, content hash, normalized fields, data classification, and timestamps.

### `ai_runs`

One row per job execution:

- `id`, `ideaId`, `ideaVersionId`
- `jobKey`, `jobVersion`, `promptVersion`, `model`
- `status`: queued, running, succeeded, failed, timed_out, cancelled
- `idempotencyKey`, `correlationId`, `requestedBy`
- `inputHash`, bounded usage counters, latency, attempt count
- normalized result JSON or encrypted result reference
- provider request identifier and bounded error code
- created, started, completed, and retention timestamps

Unique idempotency keys make retries safe.

### `idea_ai_results`

Versioned normalized results for queries and screens. It references the originating `ai_runs` row and stores only the schema-approved result needed by the application.

### `idea_events`

Append-only audit events for submissions, AI completion, questions, comments, human review, status transitions, control reviews, and impact updates. Events include actor type, actor ID where applicable, correlation ID, previous/next status, and redacted metadata.

### `idea_reviews`

Human review records with reviewer, role/group, decision, reason, conflict-of-interest acknowledgement if required, and timestamps. A human decision is separate from the AI recommendation.

### `ai_job_configs` (optional later)

If administrators need model and limit configuration, store approved operational settings here. Prompt source and schema versions remain code-reviewed artifacts; end users must never submit arbitrary master prompts.

## 8. Asynchronous workflow

Submitting an idea should not wait for Gemini. The server transaction should:

1. Validate the authenticated actor and input.
2. Create the immutable idea version.
3. Create the idea event and a unique workflow/job record.
4. Set the idea to `screening`.
5. Return a durable run/workflow identifier.

A worker then executes preflight, analysis, and downstream jobs. Each stage is idempotent and can be retried independently. If Gemini is unavailable, the idea remains available to authorized humans with an `ai_failed` event and a fallback review path.

The first local implementation can use a database-backed job abstraction. Production deployment should use a durable queue/worker system and PostgreSQL or another supported multi-instance database. SQLite is appropriate for this development setup but should not coordinate many independent production workers.

Operational protections include per-user and global rate limits, bounded queue depth, concurrency limits, exponential backoff with jitter, timeout/circuit-breaker behavior, provider error classification, and a dead-letter state for repeated failures.

## 9. Backend contracts, not frontend wiring yet

These are the planned authenticated server contracts:

- `POST /api/ideas`: create a draft or immutable submission version.
- `POST /api/ideas/:id/submit`: submit an idea idempotently for preflight and analysis.
- `GET /api/ideas/:id/ai-status`: return authorized workflow/run status.
- `GET /api/ideas/:id/decision-pack`: return the latest authorized reviewer packet.
- `POST /api/ideas/:id/review`: record a human review decision.
- `POST /api/ideas/:id/ai/retry`: retry a failed or stale job for an authorized reviewer/admin.
- `GET /api/admin/ai/runs`: audited operational view for administrators.
- `POST /api/admin/ai/jobs/:jobKey/test`: development-only job test endpoint, disabled in production.

Every route will use server-side Auth.js session checks, role/group authorization, Zod request validation, request-size limits, rate limits, correlation IDs, and an explicit error envelope. No browser code receives Gemini credentials or calls Gemini directly.

## 10. Security and privacy model

### Provider access

Use the official `@google/genai` SDK from server-only modules. The Gemini key must be `GEMINI_API_KEY` or `GOOGLE_API_KEY`, never a `NEXT_PUBLIC_*` variable and never bundled into client code. Production secrets belong in a secret manager, with rotation and least-privilege restrictions. Google documents that API keys should remain server-side and recommends a backend proxy/secret management for production. See [Gemini API key guidance](https://ai.google.dev/gemini-api/docs/api-key?authuser=00).

### Data classification

Every idea version receives a data classification such as public, internal, confidential, or restricted. The default outbound policy is fail-closed for restricted data. Before provider submission, the server applies configured secret/PII checks and either blocks, redacts, or routes the item to human review. This policy requires bank compliance/legal approval before production use.

### Prompt injection and output safety

- Treat all user text, comments, and imported content as hostile data.
- Keep system instructions separate from user content.
- Do not give the model tools or write access in this phase.
- Validate output against an allowlisted schema and bounded enums.
- Never execute model-produced code, URLs, SQL, workflow transitions, or recipient lists.
- Require human authorization for external or high-impact actions.

### Storage and logging

- Do not log passwords, API keys, session tokens, refresh tokens, full prompts, or raw idea content in normal application logs.
- Store hashes and identifiers for correlation wherever raw content is unnecessary.
- Encrypt database/storage volumes and backups in the deployment environment.
- Keep normalized results separate from raw provider payloads; raw payload retention is disabled by default.
- Add retention and deletion jobs for AI runs, prompts, and derived results.
- Restrict admin operational views and record access in the audit stream.

## 11. Environment configuration

All runtime values are configurable and validated at startup. Local development may use a `.env.local` file; production should inject secrets from a secret manager.

```text
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_API_BASE_URL=
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_ATTEMPTS=3
GEMINI_RETRY_INITIAL_DELAY_MS=250
GEMINI_RETRY_MAX_DELAY_MS=4000
GEMINI_MAX_OUTPUT_TOKENS=4096
GEMINI_TEMPERATURE=0
AI_MAX_INPUT_CHARS=30000
AI_MAX_OUTPUT_BYTES=200000
AI_ALLOWED_DATA_CLASSIFICATION=internal
AI_LOG_SENSITIVE=false
AI_RATE_LIMIT_PER_USER=20
AI_GLOBAL_CONCURRENCY=4
AI_RETENTION_DAYS=90
```

The model name must be configurable because Gemini model availability changes. The current Google model catalog should be checked at deployment time; avoid hard-coding a model name into business logic. Structured JSON output is supported through Gemini response schemas and must still be validated server-side. See [Gemini structured output guidance](https://ai.google.dev/gemini-api/docs/structured-output?authuser=683989221) and [the model catalog](https://ai.google.dev/gemini-api/docs/models?hl=en).

## 12. Testing and verification

Before connecting the frontend, the backend foundation should have:

- Unit tests for every schema boundary and enum/bounds constraint.
- Fake-provider tests for success, malformed JSON, schema mismatch, safety block, timeout, retry, rate limit, duplicate idempotency, and provider outage.
- Tests proving user content cannot override the system prompt or invoke tools.
- Authorization tests for owner, reviewer, admin, and unauthorized users.
- Database tests for immutable versions, append-only events, human/AI separation, and retry safety.
- Migration and seed tests on a clean database.
- Static checks that provider credentials are imported only in server modules.
- A redacted operational audit test proving sensitive content is absent from logs.
- Load tests around submission and job scheduling, without using a live Gemini key.

## 13. Rollout sequence after approval

### Phase 1: generic foundation

Add the Gemini provider adapter, validated environment configuration, job registry, structured-output adapter, persistence tables, redacted logging, idempotency, and fake-provider tests.

### Phase 2: idea workflow

Add immutable idea versions, events, preflight, validation, enrichment, risk, routing, questions, and decision-pack jobs. Keep all frontend pages disconnected.

### Phase 3: worker boundary

Add the durable job abstraction, local worker command, retry/dead-letter handling, rate/concurrency limits, and operational status queries.

### Phase 4: controlled backend integration

Expose the authenticated API contracts, connect only the New Idea submit/status flow, and preserve manual review fallback.

### Phase 5: remaining product surfaces

Connect comments, notifications, Learn, Library, Rewards, Account, admin controls, impact measurement, and reporting one capability at a time.

### Phase 6: production hardening

Move from SQLite to the selected production database, deploy a durable queue, configure secret management, apply data-classification/compliance policy, add observability and alerting, and run security/load testing.

## 14. Decisions and assumptions requiring approval

1. The AI is decision support, never the final authority for a bank workflow.
2. High-risk or low-confidence outputs go to human review.
3. User content is untrusted and is never allowed to produce executable actions.
4. The frontend remains disconnected until the backend contracts and tests are stable.
5. SQLite remains the local development database; production scale requires a database/queue migration path.
6. Gemini is the only model provider, accessed from server-only code through `@google/genai`.
7. Raw prompts and raw model payloads are not retained by default.
8. Prompt and schema versions are code-reviewed and auditable.

## 15. Approval gate

Implementation should begin only after this design is approved. After approval, the next artifact should be an implementation plan with file-level changes, migration order, tests, and a safe verification sequence.
