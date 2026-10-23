# AB Ignite Completion Execution Plan

The acceptance source is [`ab_ignite_user_stories.md`](./ab_ignite_user_stories.md). The status source is [`ab_ignite_user_stories_status.md`](./ab_ignite_user_stories_status.md). This plan maps every story to implementation waves and verification gates.

## Bank-grade rules

- No story becomes complete on UI-only behavior; every mutation requires a server contract, authorization, validation, persistence, audit event, and idempotency boundary where applicable.
- SQLite writes must be transactional. Immutable ledgers and append-only audit records are the source of truth for points, rewards, workflow decisions, and security events.
- JWT claims are hints only. Sensitive routes revalidate the current user, role, session, and account state from the database.
- Correct quiz answers, secrets, password hashes, AI credentials, and internal risk details never cross an unauthorized API boundary.
- Every endpoint returns the shared envelope and request ID, with bounded pagination and safe error messages.
- Every frontend query/mutation has loading, error, empty, retry, and success handling. TanStack Query owns server state; Redux owns only transient UI state.
- Every implementation slice gets focused tests, a review, a migration check when applicable, and `git diff --check` before its IDs can be marked complete.

## Work waves

| Wave | Owner scope | Requirement IDs | Depends on | Completion gate |
| :--- | :--- | :--- | :--- | :--- |
| 0 | Shared security, role/permission model, sessions, audit, notification primitives, points/ledger foundation, shared settings | CC-01..CC-05, AD-06, AD-10 | Current auth/database | Auth boundary tests, revocation/demotion tests, audit integrity, migration/seed checks |
| 1 | Idea completion: originality, AI enrichment/questions/validation, impact scoring, submission result, lifecycle, comments/support points, notifications | ID-01..ID-11 | Wave 0 + current idea APIs | End-to-end idea flow, ownership tests, score gate, duplicate/idempotency, event/audit tests |
| 2 | AI progress transport and secure worker events | ID-02, ID-03, ID-05, ID-09 | Wave 1 contracts | Ordered events, auth room tests, reconnect/fallback, safe payload tests |
| 3 | Quiz catalogue, versioned questions, attempts, grading, timers, retakes, topic analytics, recommendations, rankings, challenges | QZ-01..QZ-08 | Wave 0 | Answer redaction, grading/expiry/replay tests, first-attempt points and challenge idempotency |
| 4 | Library, article completion, recommendations, AI insight fallback, challenge/feedback engagement | AR-01..AR-05, CC-06 | Wave 0 + Wave 3 recommendation contracts | Article access/completion tests, one-time points, feedback authorization/audit tests |
| 5 | Rewards, redemptions, catalogue, fulfilment/cancellation, badge rules, points balance projections | RW-01..RW-06, CC-04..CC-05 | Wave 0 | Concurrent redemption, refund, replay, ledger balance, badge idempotency tests |
| 6 | Admin queues, evaluation, dashboards, users/RBAC, settings, learning CMS, campaigns, audit/export UI | AD-01..AD-10 | Waves 0–5 | Admin/user forbidden-control tests, CSV bounds, route/browser smoke tests |
| 7 | Full integration hardening, demo parity, security review, status matrix reconciliation | All IDs | Waves 0–6 | Full test suite, migration/seed/build/typecheck, browser smoke flows, no unresolved important findings |

## Shared-file ownership

- `src/db/schema.ts` and Drizzle migrations: Wave 0 owns the base migration; later waves add migrations sequentially through the same schema owner.
- `auth.ts`, refresh/session logic, permission checks, and audit services: Wave 0 only.
- Idea APIs/components: Wave 1; AI event transport consumes their contracts in Wave 2.
- Quiz/learning APIs: Wave 3; learning frontend and admin CMS consume those contracts in Wave 6.
- Rewards/points APIs: Wave 5; account/rewards UI consumes those contracts in Wave 6.
- `app/private/admin/page.tsx` and `src/features/admin/*`: Wave 6 only.

## Status update rule

The status matrix is updated only after the relevant wave passes its review and verification gate. Partial or prototype behavior remains explicitly incomplete.
