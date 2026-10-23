# AB Ignite Full Platform Wiring Design

**Date:** 2026-10-23  
**Status:** Approved for implementation by the user in conversation  
**Scope:** Connect the existing visual prototype to the validated backend and complete the missing employee and admin workflows.

## Intent

AB Ignite is an internal bank innovation platform. Employees submit ideas or problems, receive bounded AI decision support, answer reviewer questions, quantify impact, and follow an auditable lifecycle. Administrators manage users, permissions, sessions, AI runs, quizzes, rewards, and audit history.

The live reference experience has these employee flows:

- Community dashboard and idea discovery.
- A five-stage idea wizard followed by a submission result screen.
- Duplicate detection and “builds on” attribution.
- AI/manual idea development, reviewer questions, validation, and priority scoring.
- Idea detail, history, returned-idea editing, support, and discussion.
- Learning journey, timed quizzes, server grading, explanations, ranking, and challenges.
- Library articles, completion tracking, recommendations, and points.
- Rewards, badges, point history, and redemptions.
- Account, notifications, and feedback history.

The admin experience includes dashboard, idea queues, evaluation, tasks, projects/POCs, learning content, challenges, announcements, rewards, users, settings, and audit.

## Goals

1. Wire the existing UI to real APIs without exposing provider secrets or duplicating server state in Redux.
2. Use TanStack Query for all server state and mutations, Redux Toolkit for global client-only state, and narrowly scoped React providers for stable dependencies.
3. Add secure live AI progress updates through an authenticated Socket.IO server with query refetch fallback.
4. Preserve the existing two application roles: `admin` and `user`. Fine-grained permissions are stored separately and enforced on the server.
5. Add append-only audit coverage for authentication, administration, AI, ideas, quizzes, rewards, and permissions.
6. Make quiz attempts, points, rewards, and redemptions idempotent and transaction-safe.
7. Make employee and admin surfaces URL-addressable and refresh-safe while preserving the reference visual system and reusable components.
8. Verify every task with focused tests, then run the complete suite and production build before claiming completion.

## Non-goals

- No external SSO/SCIM, email delivery, push delivery, attachments, document extraction, embeddings, or autonomous AI actions.
- No automatic AI approval, rejection, implementation, or regulatory decision.
- No production claim that SQLite is a multi-instance queue. The local worker/realtime setup is documented as development infrastructure; PostgreSQL plus durable queue/pub-sub remains the production migration boundary.

## Architecture

### Client state

- `QueryClientProvider` owns TanStack Query cache, invalidation, retries, and mutations.
- Redux Toolkit owns only global client state: shell navigation, mobile drawers, transient toasts, wizard drafts, and live activity presentation state.
- Context providers own stable dependencies: Query client, Redux store, Auth.js session access, and authenticated realtime client.
- Ideas, users, quiz data, rewards, notifications, and AI runs never become duplicated Redux entities.

### API

All API responses use the existing envelope:

```ts
{
  data: T | null,
  error: { code: string, message: string } | null,
  requestId: string
}
```

Routes authenticate with Auth.js, authorize with server-side permissions, validate with Zod, write audit events, and return safe error codes only. Ownership checks return generic not-found responses for foreign resources.

### Realtime

The Socket.IO server runs as a separate Node process. Clients obtain a short-lived socket token from an authenticated Next.js route. The realtime server verifies the token, applies role/ownership room rules, and publishes only bounded event metadata.

Rooms:

- `user:{userId}` for personal notifications and idea updates.
- `idea:{ideaId}` for an authorized idea’s AI/workflow updates.
- `admin:ai-runs` for admin AI monitoring.

AI workers append ordered events to `ai_run_events`. The realtime process polls the event table locally and publishes new events. Production migration replaces the poller with durable pub/sub. The browser invalidates or updates TanStack Query after events; disconnected sockets fall back to bounded status polling.

### Authorization

The public roles remain exactly `admin` and `user`. Permissions are explicit records, for example:

- `ideas.read.any`
- `ideas.review`
- `ai.runs.read`
- `ai.runs.retry`
- `users.read`
- `users.manage`
- `sessions.read`
- `sessions.revoke`
- `quiz.manage`
- `rewards.manage`
- `audit.read`

All sensitive routes revalidate the current user and permission from the database, preventing stale JWT role claims from granting continued access after demotion or revocation.

## Data model additions

### Security and audit

- `roles`, `permissions`, `role_permissions` for explicit RBAC.
- `audit_events` with actor, action, resource, correlation ID, redacted metadata, IP hash, user-agent hash, and timestamps.
- `auth_sessions` or equivalent refresh-token metadata with session ID, last seen, device metadata, IP hash, and revocation reason.
- `ai_run_events` with `(runId, sequence)` uniqueness and bounded payloads.

### Learning and rewards

- `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`, and `user_learning_progress`.
- `points_ledger` with idempotency key and source metadata.
- `reward_redemptions` with requested/approved/fulfilled/cancelled states.
- Badge definitions and user badge awards where needed.

Correct answers are server-owned and never sent to the browser before grading. A user may not earn points twice for the same quiz version, even though retakes can remain available for improvement history.

## Idea submission behavior

The UI must match the live post-submission experience:

- reference number, category, status, priority band, and score breakdown;
- points and badges awarded;
- ownership and credit notice;
- lifecycle beginning at Submitted;
- Open my idea, View in My account, and Share another idea actions.

The flow must also handle duplicate detection, builds-on attribution, missing impact numbers, below-threshold scores, validation failure, AI failure/manual fallback, returned ideas, resubmission, and loading/error/empty states.

## Admin behavior

The admin page becomes a reusable workspace with tabs for:

- Overview and AI runs.
- Users and permissions.
- Active/last sessions.
- Ideas and review queues.
- Quiz/question management.
- Rewards, badges, and point ledger.
- Audit log with filters and bounded export.

Every mutation is permission-checked and audited. Destructive actions require confirmation and produce an audit record.

## Testing and verification

Each task has focused tests. The final gate includes:

- existing Node and AI suites;
- API authorization, envelope, transaction, and idempotency tests;
- React Query/component tests for loading, error, empty, retry, optimistic rollback, and realtime disconnect states;
- Socket authentication, room authorization, ordering, duplication, and fallback tests;
- quiz scoring, one-time reward, retake, expiry, and replay tests;
- RBAC, session revocation, audit redaction, and ownership isolation tests;
- production build and migration checks.

