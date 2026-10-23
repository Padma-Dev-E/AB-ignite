# Wave 5 Points and Rewards Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auditable, transactional points and rewards backend for employee balances, reward redemption, fulfilment/refund, levels, and badges without using `users.points` as the runtime source of truth.

**Architecture:** Add append-only points and reward event/ledger tables plus mutable balance and badge projections. Repository/service methods perform all related writes in one SQLite transaction, use unique idempotency keys for replay protection, snapshot reward costs/names on redemption, and append audit events using the existing audit builder. Route handlers revalidate the current Auth.js session/user/capability through the existing authorization helpers and return the shared API envelope.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, better-sqlite3/SQLite, Zod, Auth.js, Node test runner, tsx.

**Spec:** `requirements/ab_ignite_execution_plan.md`, `requirements/ab_ignite_user_stories.md`, and `docs/superpowers/specs/2026-10-23-full-platform-wiring-design.md` (Wave 5, RW-01..RW-06, CC-04..CC-05).

## Global Constraints

- SQLite writes must be transactional; immutable ledgers and append-only audit records are the source of truth.
- JWT claims are hints only; sensitive routes revalidate the current user, role, session, and account state from the database.
- Preserve legacy `rewards`, `user_rewards`, and `users.points` tables for migration compatibility; runtime balances must come from `points_ledger`/`points_balances`.
- Every reward mutation validates input, authorizes on the server, is idempotent where replay is possible, and writes an audit/domain event.
- Do not modify quiz, idea UI, admin UI, or auth foundation; only import existing auth/audit/permission helpers.
- Do not rewrite applied migrations; add one sequential Wave 5 migration.

## Review Focus

- Two concurrent redemptions cannot make a balance negative; test the transaction and projection invariant.
- Replayed redemption/fulfil/cancel requests return the original result without duplicate ledger, refund, event, or audit rows.
- A reward edit cannot change a historical redemption’s cost/name/version snapshot.
- Demoted or revoked sessions cannot use employee or admin reward APIs even when their JWT claims are stale.
- Badge/level projection reads are deterministic and badge awards are idempotent under repeated evaluation.

### Task 1: Schema and migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0005_wave_5_rewards.sql` and generated metadata
- Test: `test/rewards-foundation.test.ts`

- [ ] Write failing source/schema/migration tests for points ledger, balance projection, rules, levels, badges, reward versions, redemptions, events, append-only triggers, and legacy-table preservation.
- [ ] Add the Drizzle tables, indexes, relations, inferred types, active reward field, seed rows, and migration backfill/projection initialization.
- [ ] Generate/apply the migration and verify the focused schema tests pass.

### Task 2: Points ledger, projections, levels, and badges

**Files:**
- Create: `src/lib/rewards/errors.ts`, `src/lib/rewards/rules.ts`, `src/lib/rewards/repository.ts`, `src/lib/rewards/service.ts`
- Test: `test/rewards-domain.test.ts`

- [ ] Write failing tests for idempotent awards, projection updates, insufficient-balance rejection, ledger-derived balance, level lookup, badge evaluation, and repeated badge-award idempotency.
- [ ] Implement transactional point award/spend/refund operations, projection maintenance, seeded rule lookup, level reads, badge reads/evaluation, and bounded point history.
- [ ] Ensure no runtime rewards code reads or updates `users.points`.

### Task 3: Catalogue and redemption lifecycle

**Files:**
- Modify: `src/lib/rewards/repository.ts`, `src/lib/rewards/service.ts`
- Create: `test/rewards-redemption.test.ts`

- [ ] Write failing tests for catalogue create/edit, inactive/earned-only visibility, cost validation, historical snapshots, request idempotency, requested-only fulfilment/cancellation, refund ledger entries, and audit/domain events.
- [ ] Implement version creation on every catalogue mutation and transactional requested/fulfilled/cancelled transitions with fixed snapshots and refund idempotency.
- [ ] Verify concurrent redemption, replay, non-negative balance, and immutable event/ledger triggers.

### Task 4: Employee and admin APIs

**Files:**
- Create: `app/api/rewards/route.ts`, `app/api/rewards/redemptions/route.ts`, `app/api/rewards/badges/route.ts`
- Create: `app/api/admin/rewards/route.ts`, `app/api/admin/rewards/[id]/route.ts`, `app/api/admin/rewards/redemptions/route.ts`, `app/api/admin/rewards/redemptions/[id]/fulfill/route.ts`, `app/api/admin/rewards/redemptions/[id]/cancel/route.ts`
- Test: `test/rewards-api.test.ts`

- [ ] Write failing route/source tests for shared envelopes, bounded pagination, session revalidation, employee ownership, admin capability checks, idempotency headers/body, and safe error codes.
- [ ] Implement employee balance/catalogue/badge/history/read and redemption routes plus admin catalogue/list/fulfil/cancel routes using the existing auth, authorization, audit, request-id, and envelope helpers.
- [ ] Map domain conflicts/insufficient balance/authorization failures to safe HTTP responses without leaking internals.

### Task 5: Verification and handoff

- [ ] Run focused rewards tests, the migration, and `git diff --check`.
- [ ] Review the diff against the requirements and ownership boundaries; do not run full build/typecheck unless fast.
- [ ] Commit the scoped Wave 5 implementation.
