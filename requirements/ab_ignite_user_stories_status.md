# AB Ignite User Story Traceability

Status audit for [`ab_ignite_user_stories.md`](./ab_ignite_user_stories.md).

Audited against the local branch and current working tree on 2026-10-23. The audit includes the prior RBAC, demo-session, SMTP, authoring, admin evaluation, feedback, people, reward, learning, profile/settings, engagement, quiz, idea, governance, analytics, and reward-control commits plus the current idea-wizard, notification-pagination, refresh-deduplication, and browser-verification changes. A story is marked **Complete** only when its acceptance criteria are implemented end-to-end. **Partial** means code or UI exists, but one or more acceptance criteria are still missing. **Not started** means there is no functional implementation for the acceptance criteria; a static mock does not count as complete.

## Summary

| Status | Count |
| :--- | ---: |
| Complete | 9 |
| Partial | 37 |
| Not started | 0 |
| Total | 46 |

## 1. Ideation journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| ID-01 | No | Partial | Five-stage UI has idea/problem selection and free-text input in [`employee-idea-flow.tsx`](../src/features/ideas/components/employee-idea-flow.tsx). | The first step is not yet backed by the complete AI development flow described by the story. |
| ID-02 | No | Partial | Secured server similarity checks block near-duplicates unless an original is selected or differentiation is supplied; the employee flow now presents bounded candidates and captures both choices. | Final candidate matching still depends on the server create request, and reviewer-facing original-credit evidence is not complete. |
| ID-03 | No | Partial | Employee flow has editable structure fields and server persistence; the generic AI workflow can queue structured jobs. | The current client does not yet pre-fill the fields from a completed Gemini structure run. |
| ID-04 | No | Partial | Five prompts are rendered, saved in `idea_submissions`, and the protected routed-evaluation UI renders all five answers with loading/error states; the fresh Chromium targeted flow reached the question stage and filled the prompts. | Browser smoke coverage for the persisted employee-to-reviewer handoff remains. |
| ID-05 | No | Partial | Submission starts the server preflight, polls redacted AI run status, and only completes after an allow/safe result; rejection is rendered. | A full Gemini-backed pass/fail UI with persisted reasons and re-validation remains. |
| ID-06 | No | Partial | Three required numbers, optional explanations, live 30/30/40 weighted score, server-calculated score, and the submission confirmation's per-KPI weighted breakdown are shown. | The live client still needs the exact Watch/Qualify/Priority band presentation in every journey state. |
| ID-07 | No | Partial | Persisted minimum-score settings, server rejection, weighted score calculation, and employee minimum/score messaging are connected. | Editable settings UI and complete server breakdown/error presentation remain. |
| ID-08 | No | Partial | Successful submission waits for server confirmation, returns the generated reference, awards 50 points idempotently, and the confirmation renders category, priority band, score/minimum, and each KPI weight/score/contribution. | Browser smoke coverage and final user-facing AI validation reasons remain. |
| ID-09 | No | Partial | Idea status, versions, events, detail, comments, and support APIs exist. | Complete lifecycle transitions and notifications at every step are not implemented. |
| ID-10 | No | Partial | Workflow transitions now create accepted/status-change notifications, including the proof-of-concept acceptance message. | Business-owner and transformation-team decision workspaces and their server-enforced role paths remain. |
| ID-11 | Yes | Complete | Community detail UI and secured support/comment services enforce authors cannot support their own idea, count both interactions idempotently, notify the author, and award 2 points to the idea author per support plus 5 points to a commenting colleague; focused domain tests pass. | — |

## 2. Quizzes journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| QZ-01 | No | Partial | Versioned 3×4 catalogue APIs are connected to the live employee catalogue with category, level, objective, pass mark, question count, and time limit; protected admin authoring now creates quizzes, draft versions, questions/options, and publishes versions. | Browser smoke coverage and complete editing/publishing journey verification remain. |
| QZ-02 | No | Partial | Timed attempts now show one question at a time, use server expiry, refresh the attempt, and submit answers to the server. | Resume/reconnect edge cases and broader end-to-end browser coverage remain. |
| QZ-03 | No | Partial | Live result screen shows score, pass/fail, pass mark, expiry, and compares the current result with the previous attempt when present. | Broader end-to-end browser coverage remains. |
| QZ-04 | No | Partial | First-attempt idempotent ledger awards are displayed in the live quiz result, retakes show no award, and the client refreshes the rewards cache after completion. | Every employee balance surface still needs browser verification. |
| QZ-05 | Yes | Complete | Journey service and live `JourneyCard` expose topic scores, category performance, attempt trends, open recommendations, and the next recommended step with loading/error/empty states; focused component/API tests pass. | — |
| QZ-06 | Yes | Complete | Configurable threshold rules create open recommendations and notifications; the live Library Recommended view renders the rule reason and the article completion mutation closes the recommendation idempotently. | — |
| QZ-07 | Yes | Complete | Ranking API and live Learning Ranking view support whole-bank and department scopes, ordered by Ignite Points with loading/error/empty states. | — |
| QZ-08 | Yes | Complete | Challenge API and live Challenges view show question/deadline/participants, allow joining, and invalidate state after the idempotent 20-point award. | — |

## 3. Articles journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| AR-01 | No | Partial | Live employee library reads the secured catalogue, provides category filters, and has loading/error/empty states. | Seeded category coverage and full publisher/source presentation need broader content and browser verification. |
| AR-02 | No | Partial | Live Recommended view reads open recommendations with reasons and a clear empty state; each recommended card now exposes the secured insight action. | Full browser lifecycle coverage remains. |
| AR-03 | No | Partial | Live article detail renders internal body content and keeps external HTTPS links in a new tab. | Article source/read UX needs final browser smoke coverage. |
| AR-04 | No | Partial | Article completion is server-idempotent and the live detail action shows pending/success/error, including points awarded; a second completion is explicitly reported and badge progress is surfaced. | Full browser lifecycle coverage remains. |
| AR-05 | Yes | Complete | Secured article insight endpoint validates recommendation ownership, uses the generic Gemini adapter when configured, audits the source, and falls back to the persisted rule message; `ArticleCard` exposes the insight action with loading/error/Gemini-or-rule states and focused tests. | — |

## 4. Rewards journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| RW-01 | No | Partial | Secured rewards APIs and live Rewards page expose the current balance, level, catalogue, earned recognition, and redemption history; badge cards now present persisted rule metadata and progress. | Full browser smoke coverage remains. |
| RW-02 | No | Partial | Transactional redemption API snapshots cost and deducts once; the employee card now uses a Headless UI confirmation dialog before mutation. | Post-confirmation balance/request success needs a full browser smoke path. |
| RW-03 | No | Partial | Server rejects insufficient balances and enforces a non-negative projection inside the transaction. | End-to-end frontend error presentation and concurrency smoke coverage remain. |
| RW-04 | No | Partial | Employee redemption history API returns bounded requested/fulfilled/cancelled records with ownership enforcement; the employee query now accumulates pages and the history surface exposes a bounded `Load more redemptions` control with loading state. | Live browser verification with multiple persisted redemption pages remains. |
| RW-05 | No | Partial | Admin fulfil/cancel APIs enforce requested-only transitions, refund cancellation once, require privileged reasons, and write audit events. Redemption management now has a dedicated `rewards.manage` capability for management/admin profiles, and the admin dialog preserves one caller-owned idempotency key across retries. | Runtime browser authorization/action smoke and queue pagination/filter controls remain. |
| RW-06 | Yes | Complete | Admin catalogue APIs and the protected Admin Reward Catalogue manager create/edit versioned rewards, active state, kind, name, description, and cost with required audited reasons and success/error/empty states. | — |

## 5. Admin portal journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| AD-01 | No | Partial | Secured, bounded screening queue and reasoned decision APIs are implemented with audit/notifications; routing now persists an assigned owner and due date with idempotent decisions. | Full browser verification, richer assignment management, and a distinct transformation-team role remain. |
| AD-02 | No | Partial | Secured transformation queue and confirm-to-POC API are implemented with employee notification/audit; workflow transitions now persist and notify through implementation completion. | Full browser verification and a distinct transformation role remain. |
| AD-03 | No | Partial | Routed evaluation reads are owner-scoped through event metadata and durable assignment, include stored answers, KPI metrics, AI assessment, and reasoned decision actions. | Distinct business-owner RBAC and complete browser evaluation coverage remain. |
| AD-04 | Yes | Complete | Routed evaluation detail renders all five answers, each KPI metric, score, weight, weighted contribution, author explanation, minimum, validation state, and AI assessment; decisions require a reason. | — |
| AD-05 | No | Partial | Admin control room consumes live users, rewards, learning, governance, and audit data; the analytics endpoint and Operations evidence surface provide status, priority-band, department, points, learning, and audit aggregates. Dedicated, bounded, no-store ideas, benefits, and feedback CSV endpoints now share tested export contracts, formula-safe escaping, request IDs, pagination cursors, and server-side authorization; management profiles now have the required `audit.export` capability. | Full browser verification of management-profile exports and complete pipeline/learning dashboard coverage remain. |
| AD-06 | No | Partial | The database/JWT carry employee, reviewer, business owner, control, management, and admin profiles; the protected People & access manager exposes profile assignment, user creation, activation/deactivation, security reset, temporary-password reset, session inspection, session revocation, and audited reason-required mutations. | Full browser verification and approved-channel delivery of generated temporary passwords remain. |
| AD-07 | No | Partial | Admin settings editor loads and edits minimum score, priority rules, point rules, and recommendation rules with a privileged reason and audited PATCH mutation. | Full KPI hints/weights/bands, levels, SLA, controls, departments, demo access, and profiles settings UI remain. |
| AD-08 | No | Partial | Admin learning APIs and the protected Learning Content manager cover quiz creation, draft version creation, question/option creation with exactly one correct answer, publish locking, question editing, article create/edit/publish controls, recommendation rules, and strict HTTPS external-link validation with audited reasons and idempotency keys. | Browser smoke coverage for the complete authoring workflow remains. |
| AD-09 | No | Partial | Employee feedback campaign form, live notifications, secured administrator response APIs, and the protected admin Campaign feedback response UI persist, notify, and audit. | Campaign/announcement/challenge authoring and lifecycle management remain. |
| AD-10 | No | Partial | Idea events and AI run records provide traceability; audit views now support bounded date/action/actor/IP-hash filters and a secured CSV export. | Complete login/transition/settings/redemption audit coverage and inclusion of IP hashes in the export remain. |

## 6. Cross-cutting stories

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| CC-01 | No | Partial | Demo entry normalizes the name and department, derives an opaque same-name identity, persists the demo profile, rotates a server-side session capped at 30 days, and exposes the join flow through `/api/demo/session`; focused tests and HTTP validation smoke pass. | A browser smoke path on an isolated deployment remains. |
| CC-02 | No | Partial | Auth.js, Argon2 password hashing, refresh-token hashing, role claims, configurable token TTLs, five-attempt/15-minute lockout, idle/absolute session checks, revocation, and security tests are implemented; fresh Chromium credential login reached the protected admin workspace with HTTP 302/200 responses. | A full browser smoke path for refresh/logout and deployment-secret validation remains. |
| CC-03 | No | Partial | Employee notification panel and top-bar unread badge use the live notification/read APIs; SMTP configuration validation, retryable delivery records, redacted audits, demo-recipient skip, and a worker command are implemented. Fresh Chromium verification with 34 persisted notifications confirmed a bounded mobile popover (`max-h-[min(72vh,40rem)] overflow-y-auto`) and a `Load more notifications` control. | A live SMTP relay send remains because no relay is configured locally; the full notification lifecycle still needs broader browser coverage. |
| CC-04 | No | Partial | Append-only points ledger, balance projection, configured point rules, level thresholds, idempotent awards, and audited balance changes are implemented; the top bar, community hero, account, rewards, quiz, article, challenge, and feedback surfaces use live point state where connected, with quiz/article cache refreshes. | Full event-by-event integration and browser verification of every live balance refresh remain. |
| CC-05 | No | Partial | Persisted badge rules, automatic milestone evaluation, user-badge awards, badge audit events, and employee badge-rule/progress presentation are implemented. | Admin rule management and full browser verification remain. |
| CC-06 | Yes | Complete | Pinned campaign selection, categorized/idempotent employee feedback submission, live employee feedback form, admin response UI, employee notification, and audit behavior are implemented and tested. | — |

## Completion rule

No story should be changed to **Complete** until its acceptance criteria have:

1. A working backend contract and persistence path.
2. Server-side authorization and validation where applicable.
3. A connected frontend state/query flow with loading, error, empty, and success states.
4. Focused automated verification plus an end-to-end smoke path where applicable.
5. Audit/idempotency behavior for points, rewards, workflow decisions, and other bank-sensitive mutations.

This document is the implementation checklist for the remaining work. The source requirements file remains unchanged.

## Latest verification evidence

- `npx tsc --noEmit --incremental false` passed.
- `npm run test:ai` passed 84/84 after applying the current migration chain.
- `npm run test:client` passed 11/11; `npm test` passed 18/18.
- `npm run build` completed successfully with 45 generated routes/pages.
- HTTP smoke passed for login, protected redirects, unauthenticated API boundaries, structured demo validation, a valid `padmadev` demo session reaching `/private` and `/api/ideas`, and admin credentials reaching `/private/admin`.
- Fresh Playwright Chromium smoke passed at desktop and 390×844 mobile sizes for the idea wizard and all six admin tabs; the notification panel was verified with persisted pagination data. No test data was deleted or reset.
- The supplied Gemini key was tested without persistence: model discovery returned HTTP 200, and the project adapter returned structured JSON using `gemini-3.1-flash-lite` and `gemini-3.8-flash`. No credential was written to the repository.
- AD-05 export verification: focused admin export-contract tests pass, covering ideas/benefits/feedback CSV headers, formula-safe escaping, request IDs, no-store headers, and pagination cursors; `npx tsc --noEmit --incremental false` and `npm run test:ai` pass (85/85).
- Rewards hardening verification: focused rewards UI/hooks tests pass 6/6, route contract tests pass 3/3, permissions pass 1/1, and admin export/management capability tests pass 3/3; typecheck passes after the null-safe paginated history integration.
