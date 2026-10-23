# AB Ignite Full Platform Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static AB Ignite prototype into a secure, query-backed employee and admin application with auditable ideas, AI progress, quizzes, rewards, and RBAC.

**Architecture:** Next.js App Router remains the web/API host. TanStack Query owns server state, Redux Toolkit owns global client-only state, and stable dependencies are supplied by providers. A separate authenticated Socket.IO process publishes ordered AI/workflow events from the database, with query polling fallback.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Auth.js, Drizzle ORM, SQLite for local development, Gemini, TanStack Query, Redux Toolkit, Socket.IO, Zod, Node test runner, tsx.

**Spec:** `docs/superpowers/specs/2026-10-23-full-platform-wiring-design.md`

## Global Constraints

- Preserve the existing visual system and reuse shared components; do not create duplicate cards, tabs, pills, fields, or shell primitives.
- Keep `admin` and `user` as the application roles; use explicit permissions for RBAC.
- Never expose Gemini credentials, correct quiz answers, raw refresh tokens, prompts, or sensitive idea text through browser events or logs.
- All mutations validate input, authorize on the server, are idempotent where replay is possible, and write audit records.
- TanStack Query owns server data; Redux must not become a second API cache.
- Every task must add focused tests and pass its focused verification before being marked complete.
- Do not rewrite applied Drizzle migrations; add a new migration.

## Review Focus

- Stale role claims after demotion/revocation → sensitive API tests must re-read permissions from the database.
- Duplicate/replayed submissions, quiz finishes, and redemptions → unique idempotency and transaction tests.
- Unauthorized Socket.IO room joins or foreign idea access → handshake and room authorization tests.
- Realtime disconnect, duplicate, and out-of-order events → event sequence and polling fallback tests.
- Loading/error/empty/optimistic rollback states → component/query tests for every newly wired feature.

### Task 1: Client foundation and providers

**Files:** Create `src/providers/app-providers.tsx`, `src/lib/query/query-client.ts`, `src/lib/api/client.ts`, `src/lib/api/contracts.ts`, `src/store/index.ts`, `src/store/ui-slice.ts`; modify `app/layout.tsx`, `package.json`, lockfile.

**Deliverable:** Install TanStack Query, Redux Toolkit, React Redux, and Socket.IO client dependencies. Add typed envelope-aware API client, QueryClient provider, Redux provider, and stable app providers. Add tests for API error parsing and provider-safe configuration.

**Verification:** `npm run test:client` focused tests, `npx tsc --noEmit`.

### Task 2: Idea/domain API completion

**Files:** Create `app/api/ideas/[id]/route.ts`, comment/support/notification/profile routes, `src/features/ideas/api.ts`, `src/features/ideas/hooks.ts`, `src/features/ideas/types.ts`; modify idea schemas/repository and existing idea routes.

**Deliverable:** Add authorized list/detail/update, comments, support, notifications, profile, pagination/filtering, and query hooks. Preserve response envelopes and ownership isolation. Add tests for authorization, validation, pagination, idempotent support, comments, and returned-idea resubmission.

**Verification:** `npm run test:ai`, focused API tests, migration-free typecheck.

### Task 3: Employee idea UI wiring and submission result

**Files:** Create `src/features/ideas/components/*`; modify `app/page.tsx` by extracting feature components while preserving design tokens and shared UI primitives.

**Deliverable:** Replace hardcoded idea data with TanStack Query hooks. Implement the live five-stage wizard, duplicate/builds-on states, validation/score gate, loading/error/empty states, post-submission result screen, idea detail/history/comments/support, and returned edit/resubmit. Use Redux only for wizard/UI state.

**Verification:** Component tests plus browser flow: login → create idea → submit → see result → open detail → comment/support.

### Task 4: AI events and authenticated Socket.IO

**Files:** Create `app/api/realtime/token/route.ts`, `src/lib/realtime/*`, `scripts/realtime-server.ts`, `test/realtime.test.ts`; modify AI runner/worker/repository and package scripts.

**Deliverable:** Add ordered `ai_run_events`, secure short-lived socket token, authenticated Socket.IO rooms, worker event emission, client hook, reconnect/refetch fallback, and safe event payloads. Admin rooms require `ai.runs.read`; idea rooms require ownership/admin access.

**Verification:** Event ordering, token expiry, room authorization, duplicate-event handling, reconnect, fallback polling, and worker event tests.

### Task 5: Security, RBAC, sessions, and audit backend

**Files:** Modify `src/db/schema.ts`, add migration, `src/lib/auth/permissions.ts`, `src/lib/auth/authorization.ts`, `src/lib/audit/*`; modify `auth.ts`, refresh route/core, and sensitive APIs.

**Deliverable:** Add permissions, role mappings, audit events, session metadata/last-seen/revocation, database-backed permission checks, audit redaction, and admin/user session APIs. Add server tests for demotion, revocation, ownership, audit integrity, and rate/validation boundaries.

**Verification:** `npm run db:migrate`, focused security tests, `npm run db:seed`, `npx tsc --noEmit`.

### Task 6: Admin workspace and administration UI

**Files:** Create `src/features/admin/*`; modify `app/private/admin/page.tsx`, admin API routes, shared UI components as needed.

**Deliverable:** Replace placeholder admin page with tabs for overview, AI runs, users, permissions, sessions, ideas/review queues, and audit. Add loading/error/empty states, permission-aware controls, session revocation, bounded audit filters/export, and confirmation dialogs.

**Verification:** Admin/user route tests and browser checks for forbidden controls, users, sessions, AI retries, and audit filtering.

### Task 7: Quiz backend and grading

**Files:** Modify schema and add migration; create `src/lib/learning/*`, quiz APIs, attempt/grading services, and tests.

**Deliverable:** Add question/option management, quiz versions, attempts, server grading, timers/expiry, explanations, topic performance, retakes, one-time point award idempotency, and admin CRUD authorization. Never return correct answers before grading.

**Verification:** Scoring, expiry, all-required answers, replay, retake, version, authorization, and answer-redaction tests.

### Task 8: Learning and quiz frontend

**Files:** Create `src/features/learning/*`; modify learning portions of `app/page.tsx` and shared navigation.

**Deliverable:** Wire journey, quiz catalog, intro, timed question flow, results/explanations, ranking, challenges, and article completion to TanStack Query. Add Redux only for active quiz UI state and resilient timer behavior. Use shared cards/tabs/status components.

**Verification:** Component/browser tests for start, answer, timer expiry, result, retake, loading, failure, and empty states.

### Task 9: Rewards, points, badges, and notifications

**Files:** Modify schema and add migration; create rewards/notification services, APIs, hooks, and feature components.

**Deliverable:** Add immutable points ledger, badges, reward redemptions, balance calculation, idempotent redemption, cancellation/fulfillment, notification read state, unread count, and live notification updates. Replace hardcoded Rewards/Account/Notifications UI.

**Verification:** Ledger balance, concurrent redemption, insufficient balance, replay, badge awards, notification read/unread, and authorization tests.

### Task 10: Integration hardening and full verification

**Files:** Create end-to-end/integration test harness and update docs/env/scripts; modify any integration seams found by tests.

**Deliverable:** Verify all ten tasks together, document local worker/realtime startup, add smoke flow tests, inspect security boundaries, and reconcile the UI against the live demo’s page inventory. No unresolved Important findings may remain.

**Verification:** `npm test`, `npm run test:ai`, `npm run test:client`, `npm run db:migrate`, `npm run db:seed`, `npx tsc --noEmit`, `npm run build`, `git diff --check`.

