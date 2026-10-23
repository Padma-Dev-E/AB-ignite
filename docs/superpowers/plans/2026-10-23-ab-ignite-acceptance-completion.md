# AB Ignite Acceptance Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete every acceptance criterion in `requirements/ab_ignite_user_stories.md` with bank-grade authorization, auditability, idempotency, connected UI states, and fresh verification.

**Architecture:** Preserve the existing Next.js App Router, Drizzle/SQLite domain services, Auth.js session policy, TanStack Query frontend, Redux UI state, and shared API envelope. Add missing behavior at the existing server-service/API/UI boundaries, with append-only audit and idempotency records for every sensitive mutation.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Headless UI, TanStack Query, Redux Toolkit, Auth.js, Drizzle ORM, SQLite, Gemini structured generation, Node test runner, Playwright Chromium fallback.

**Spec:** `requirements/ab_ignite_user_stories.md`

## Global Constraints

- Do not store provider credentials in source, tests, screenshots, or committed environment files.
- Every privileged mutation requires server capability checks, a bounded reason, audit metadata, and an idempotency key where the operation can be replayed.
- Keep Auth.js role/profile claims and database authorization as separate enforcement layers.
- Keep all list/export endpoints bounded, no-store, and safe against CSV formula injection.
- Every connected frontend query/mutation must expose loading, error, empty, and success states.
- Preserve append-only ledgers, immutable historical snapshots, and transactional balance updates.
- Do not mark a story Complete until backend, authorization, connected UI, focused tests, and runtime smoke evidence exist.

## Review Focus

- Replayed workflow, reward, announcement, and campaign mutations must not duplicate points, notifications, or records.
- A user with a valid JWT but an unauthorized profile must be denied by the server, not merely hidden by the UI.
- Expired, revoked, idle, and absolute sessions must fail consistently across page and API requests.
- Empty queues, unavailable Gemini/SMTP providers, and zero-balance reward states must be usable rather than fatal.
- Export filters and user-controlled text must not leak secrets, raw provider errors, or executable spreadsheet formulas.

---

### Task 1: Complete ideation journey acceptance

**Files:**
- Modify: `src/features/ideas/components/employee-idea-flow.tsx`
- Modify: `src/features/ideas/*` and `src/lib/ideas/*` only where an acceptance gap is proven
- Modify: relevant idea/governance API routes and tests
- Test: `test/idea-domain-api.test.ts`, `test/idea-workflow.test.ts`, and focused component/API tests

**Interfaces:**
- Consumes the existing idea repository, AI job registry, preflight polling, priority calculation, and governance service.
- Produces a complete five-stage employee flow with visible AI structure/validation reasons, originality credit, exact score bands, minimum-score enforcement, and lifecycle notifications.

- [ ] Write failing tests for AI structure hydration, failed validation blocking, exact Watch/Qualify/Priority display, and every accepted lifecycle notification.
- [ ] Implement the smallest server/UI changes that make the tests pass without bypassing human workflow authorization.
- [ ] Run focused idea tests and the complete AI suite; commit the bounded slice.

### Task 2: Complete employee learning, articles, and rewards surfaces

**Files:**
- Modify: `src/features/learning/*`, `src/features/rewards/*`, `src/features/articles/*`
- Modify: employee-facing API hooks only where cache/state behavior is incomplete
- Test: quiz, article, rewards, and client-state tests

**Interfaces:**
- Consumes the existing ledger, badge, redemption, quiz-attempt, recommendation, and article services.
- Produces complete employee result comparison, redemption history, post-mutation balance refresh, badge presentation, and error/empty states.

- [ ] Write failing tests for redemption-history rendering, balance refresh after redemption/quiz/article events, and second-completion behavior.
- [ ] Implement connected UI and query invalidation with Headless UI confirmations and safe mutation messages.
- [ ] Run focused suites plus `npm run test:client`; commit the bounded slice.

### Task 3: Complete admin people, settings, analytics, audit, and learning controls

**Files:**
- Modify: `src/features/admin/components/*`, `src/features/admin/*`
- Modify: `app/api/admin/*` and `src/lib/admin/*` only for missing acceptance contracts
- Test: admin service, governance, learning authoring, analytics, audit, and security tests

**Interfaces:**
- Consumes the existing capability matrix and audit service.
- Produces complete settings coverage, management analytics/exports, user/session controls, audit detail/export, and authoring UX with bounded feedback.

- [ ] Write failing tests for missing settings fields, export column coverage, profile/session actions, and authoring lifecycle state.
- [ ] Implement server contracts first, then connect the protected admin tabs with explicit states and audited reasons.
- [ ] Run focused admin tests, typecheck, and runtime authorization checks; commit the bounded slice.

### Task 4: Complete campaigns, announcements, and challenge administration

**Files:**
- Create/modify: `src/lib/admin/engagement/*`, `src/db/schema.ts`, `drizzle/*`
- Create/modify: `app/api/admin/engagement/*`, `src/features/admin/components/*`
- Modify: employee notification/challenge components and API hooks
- Test: new engagement service/API tests and existing feedback/challenge tests

**Interfaces:**
- Consumes existing notifications, audit, points, challenge, and feedback campaign primitives.
- Produces idempotent announcement pinning, challenge open/close controls, campaign lifecycle, and audited administrator response/notification behavior.

- [ ] Write failing tests for announcement pin/unpin, challenge close, campaign open/close, replay protection, RBAC, and notification delivery records.
- [ ] Add migration-backed persistence and transactional services, then connect admin and employee views.
- [ ] Run migration tests, focused engagement tests, typecheck, and commit the bounded slice.

### Task 5: End-to-end verification and traceability closure

**Files:**
- Modify: `requirements/ab_ignite_user_stories_status.md`
- Modify: test harness/config only if required for repeatable browser smoke

**Interfaces:**
- Consumes all completed feature contracts.
- Produces fresh evidence for every ID and changes `Partial` to `Complete` only where every criterion is proven.

- [ ] Run migration, typecheck, all focused suites, client tests, unit tests, production build, and runtime HTTP checks sequentially where SQLite requires isolation.
- [ ] Run Chromium browser smoke at desktop and mobile viewports for employee, admin, and protected-route flows.
- [ ] Re-audit every story line-by-line; update counts and evidence, record any genuinely external blocker, and commit the traceability update.
