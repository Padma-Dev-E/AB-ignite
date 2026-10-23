# AB Ignite User Story Traceability

Status audit for [`ab_ignite_user_stories.md`](./ab_ignite_user_stories.md).

Audited against the local branch through employee profile/settings, engagement, quiz, idea, reward, and admin-control commits `bce7802`, `34de060`, `71e5f33`, `1e3b28e`, `70ff50a`, `790b536`, `03cfec8`, and `2020d41` on 2026-10-23. A story is marked **Complete** only when its acceptance criteria are implemented end-to-end. **Partial** means code or UI exists, but one or more acceptance criteria are still missing. **Not started** means there is no functional implementation for the acceptance criteria; a static mock does not count as complete.

## Summary

| Status | Count |
| :--- | ---: |
| Complete | 0 |
| Partial | 46 |
| Not started | 0 |
| Total | 46 |

## 1. Ideation journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| ID-01 | No | Partial | Five-stage UI has idea/problem selection and free-text input in [`employee-idea-flow.tsx`](../src/features/ideas/components/employee-idea-flow.tsx). | The first step is not yet backed by the complete AI development flow described by the story. |
| ID-02 | No | Partial | Secured server similarity checks block near-duplicates unless an original is selected or differentiation is supplied; the employee flow now presents bounded candidates and captures both choices. | Final candidate matching still depends on the server create request, and reviewer-facing original-credit evidence is not complete. |
| ID-03 | No | Partial | Employee flow has editable structure fields and server persistence; the generic AI workflow can queue structured jobs. | The current client does not yet pre-fill the fields from a completed Gemini structure run. |
| ID-04 | No | Partial | Five prompts are rendered, saved in `idea_submissions`, and included in the admin evaluation response. | Reviewer UI does not yet render the complete answer set. |
| ID-05 | No | Partial | Submission starts the server preflight, polls redacted AI run status, and only completes after an allow/safe result; rejection is rendered. | A full Gemini-backed pass/fail UI with persisted reasons and re-validation remains. |
| ID-06 | No | Partial | Three required numbers, optional explanations, live 30/30/40 weighted score, and server-calculated score are shown. | The live client still needs the exact Watch/Qualify/Priority band presentation and final breakdown confirmation. |
| ID-07 | No | Partial | Persisted minimum-score settings, server rejection, weighted score calculation, and employee minimum/score messaging are connected. | Editable settings UI and complete server breakdown/error presentation remain. |
| ID-08 | No | Partial | Successful submission now waits for server confirmation, returns the generated reference and awards 50 points idempotently. | Confirmation still needs the final category, priority band, and per-KPI breakdown displayed together. |
| ID-09 | No | Partial | Idea status, versions, events, detail, comments, and support APIs exist. | Complete lifecycle transitions and notifications at every step are not implemented. |
| ID-10 | No | Partial | Workflow transitions now create accepted/status-change notifications, including the proof-of-concept acceptance message. | Business-owner and transformation-team decision workspaces and their server-enforced role paths remain. |
| ID-11 | No | Partial | Comment and support APIs/hooks and detail UI exist. | Own-idea support enforcement and the 5-point commenter / 2-point author reward rules are missing. |

## 2. Quizzes journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| QZ-01 | No | Partial | Versioned 3×4 catalogue APIs are connected to the live employee catalogue with category, level, objective, pass mark, question count, and time limit. | Admin quiz/question authoring remains incomplete. |
| QZ-02 | No | Partial | Timed attempts now show one question at a time, use server expiry, refresh the attempt, and submit answers to the server. | Resume/reconnect edge cases and broader end-to-end browser coverage remain. |
| QZ-03 | No | Partial | Live result screen shows score, pass/fail, pass mark, expiry, and previous-attempt-compatible server result. | Comparison details and a complete visual result breakdown remain. |
| QZ-04 | No | Partial | First-attempt idempotent ledger awards are displayed in the live quiz result; retakes show no award. | Points are not yet reflected in every employee balance surface immediately. |
| QZ-05 | No | Partial | Journey service returns topic scores, category aggregates, attempt trends, open recommendations, and next step. | Frontend journey visualization remains. |
| QZ-06 | No | Partial | Configurable threshold rules create/update open recommendations with reasons and in-app notifications for low topic scores. | Article linking/reading completion and frontend recommendation UI remain. |
| QZ-07 | No | Partial | Ranking API supports active whole-bank and department views ordered by Ignite Points. | Frontend ranking view remains. |
| QZ-08 | No | Partial | Challenge API lists open challenge questions, deadlines, participant counts, join state, and gives one idempotent `challenge_join` award. | Admin challenge management and frontend challenge UI remain. |

## 3. Articles journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| AR-01 | No | Partial | Live employee library reads the secured catalogue, provides category filters, and has loading/error/empty states. | Seeded category coverage and full publisher/source presentation need broader content and browser verification. |
| AR-02 | No | Partial | Live Recommended view reads open recommendations with reasons and a clear empty state. | Recommendation insight action and full lifecycle presentation remain. |
| AR-03 | No | Partial | Live article detail renders internal body content and keeps external HTTPS links in a new tab. | Article source/read UX needs final browser smoke coverage. |
| AR-04 | No | Partial | Article completion is server-idempotent and the live detail action shows pending/success/error, including points awarded. | Second-completion UI and badge unlock presentation remain. |
| AR-05 | No | Partial | Secured article insight endpoint validates recommendation ownership, uses the generic Gemini adapter when configured, audits the source, and falls back to the persisted rule message. | Frontend insight action and live provider smoke coverage remain. |

## 4. Rewards journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| RW-01 | No | Partial | Secured rewards APIs and live Rewards page expose the current balance, level, catalogue, earned recognition, and redemption history; the live account card also shows points and level. | Full earned badge presentation and browser smoke coverage remain. |
| RW-02 | No | Partial | Transactional redemption API snapshots cost and deducts once; the employee card now uses a Headless UI confirmation dialog before mutation. | Post-confirmation balance/request success needs a full browser smoke path. |
| RW-03 | No | Partial | Server rejects insufficient balances and enforces a non-negative projection inside the transaction. | End-to-end frontend error presentation and concurrency smoke coverage remain. |
| RW-04 | No | Partial | Employee redemption history API returns bounded requested/fulfilled/cancelled records with ownership enforcement. | Frontend redemption history remains. |
| RW-05 | No | Partial | Admin fulfil/cancel APIs enforce requested-only transitions, refund cancellation once, require privileged reasons, and write audit events. | Admin workflow UI and runtime authorization smoke coverage remain. |
| RW-06 | No | Partial | Admin catalogue APIs create versioned rewards and edit active state, kind, name, description, and cost with audited reasons. | Admin catalogue UI and full settings integration remain. |

## 5. Admin portal journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| AD-01 | No | Partial | Secured, bounded screening queue and reasoned decision APIs are implemented with audit/notifications; the admin workspace reads the queue and exposes reason dialogs. | Send-to-owner assignment, due dates, durable assignment, and a distinct transformation-team role remain. |
| AD-02 | No | Partial | Secured transformation queue and confirm-to-POC API are implemented with employee notification/audit; the admin workspace now exposes confirmation controls. | Durable assignment/due-date fields and a distinct transformation role remain. |
| AD-03 | No | Partial | Routed evaluation reads are owner-scoped through event metadata and include stored answers, KPI metrics, AI assessment, and reasoned decision actions. | Distinct business-owner RBAC, durable assignments, and evaluation UI remain. |
| AD-04 | No | Partial | Idea scoring fields and AI schemas exist in the backend. | Reviewer UI does not show each KPI answer, score, weight, and author explanation. |
| AD-05 | No | Partial | Admin control room consumes live users, rewards, learning, governance, and audit data with bounded audit CSV export. | Pipeline/department/learning dashboards and ideas/benefits/feedback CSV exports remain. |
| AD-06 | No | Partial | Admin-only user directory, role changes, activation/deactivation, security reset, session revocation, and audit records are implemented; the UI lists users and lifecycle state. | The role model is still admin/user rather than the full profile set, and mutation forms/password reset UI remain. |
| AD-07 | No | Partial | Admin settings editor now loads and edits the minimum score, point rules, and recommendation rules with a privileged reason and audited PATCH mutation. | Full KPI hints/weights/bands, levels, SLA, controls, departments, demo access, and profiles settings UI remain. |
| AD-08 | No | Partial | Admin learning APIs cover bounded quiz/article catalogues, unpublished quiz question edits, recommendation rules, and strict HTTPS external-link validation. | Learning-content management UI and complete quiz authoring workflow remain. |
| AD-09 | No | Partial | Employee feedback campaign form and live notifications are connected to secured APIs; administrator response APIs persist, notify, and audit. | Campaign/announcement/challenge management and admin feedback response UI remain. |
| AD-10 | No | Partial | Idea events and AI run records provide limited traceability. | Complete login/transition/settings/redemption audit coverage, IP detail, filtering, and CSV export are missing. |

## 6. Cross-cutting stories

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| CC-01 | No | Partial | Demo entry UI exists, and registered profile data now loads/edits through `/api/profile`; authenticated account page uses the live profile card. | Name-only demo identity persistence and 30-day same-name demo-session behavior remain separate from registered login. |
| CC-02 | No | Partial | Auth.js, Argon2 password hashing, refresh-token hashing, role claims, and configurable token TTLs exist. | Five-attempt lockout, 15-minute lock duration, idle timeout enforcement, and complete session policy verification are missing. |
| CC-03 | No | Partial | Employee notification panel and top-bar unread badge now use the live notification/read APIs with polling and retry/empty states. | SMTP relay delivery and full browser smoke coverage remain. |
| CC-04 | No | Partial | Append-only points ledger, balance projection, configured point rules, level thresholds, idempotent awards, and audited balance changes are implemented. | All idea/quiz/article event integrations and live frontend display remain. |
| CC-05 | No | Partial | Persisted badge rules, automatic milestone evaluation, user-badge awards, and badge audit events are implemented. | Full badge UI and admin rule management remain. |
| CC-06 | No | Partial | Pinned campaign selection, categorized/idempotent feedback submission, admin response, employee notification, and audit behavior are implemented in the secured API layer. | Employee/admin UI integration and full campaign management remain. |

## Completion rule

No story should be changed to **Complete** until its acceptance criteria have:

1. A working backend contract and persistence path.
2. Server-side authorization and validation where applicable.
3. A connected frontend state/query flow with loading, error, empty, and success states.
4. Focused automated verification plus an end-to-end smoke path where applicable.
5. Audit/idempotency behavior for points, rewards, workflow decisions, and other bank-sensitive mutations.

This document is the implementation checklist for the remaining work. The source requirements file remains unchanged.
