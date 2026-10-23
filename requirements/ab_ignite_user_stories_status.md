# AB Ignite User Story Traceability

Status audit for [`ab_ignite_user_stories.md`](./ab_ignite_user_stories.md).

Audited against the local branch at commit `a5de524` on 2026-10-23. A story is marked **Complete** only when its acceptance criteria are implemented end-to-end. **Partial** means code or UI exists, but one or more acceptance criteria are still missing. **Not started** means there is no functional implementation for the acceptance criteria; a static mock does not count as complete.

## Summary

| Status | Count |
| :--- | ---: |
| Complete | 0 |
| Partial | 23 |
| Not started | 23 |
| Total | 46 |

## 1. Ideation journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| ID-01 | No | Partial | Five-stage UI has idea/problem selection and free-text input in [`employee-idea-flow.tsx`](../src/features/ideas/components/employee-idea-flow.tsx). | The first step is not yet backed by the complete AI development flow described by the story. |
| ID-02 | No | Partial | UI exposes originality-check and builds-on states. | No server-side similarity search, duplicate stop, 20-character explanation, author credit, or notification workflow. |
| ID-03 | No | Partial | Editable title, summary, problem, solution, benefits, and risks fields exist. | Gemini does not yet pre-fill and persist the structure from the first step; manual fallback is only client-side. |
| ID-04 | No | Partial | Five reviewer-question prompts are rendered in the submission flow. | Answers are not persisted with the idea or exposed to reviewers. |
| ID-05 | No | Partial | Client validation state and submit gating exist; AI validation jobs/schemas exist under [`src/lib/ai`](../src/lib/ai). | The employee flow does not call the AI validation result and does not provide server-enforced pass/fail re-validation. |
| ID-06 | No | Partial | Three impact inputs are shown in the UI. | No optional explanation per number, live weighted 30/30/40 score, or Watch/Qualify/Priority calculation. |
| ID-07 | No | Not started | Submit is gated by a local field-count check. | No configurable minimum score, server rejection, score breakdown response, or admin setting. |
| ID-08 | No | Partial | Idea creation and submit APIs exist in [`app/api/ideas`](../app/api/ideas), and the result screen displays the returned reference. | Reference/priority criteria, final scoring breakdown, and 50-point milestone credit are not implemented end-to-end. |
| ID-09 | No | Partial | Idea status, versions, events, detail, comments, and support APIs exist. | Complete lifecycle transitions and notifications at every step are not implemented. |
| ID-10 | No | Not started | No complete acceptance-to-POC notification flow exists. | Business-owner approval, transformation confirmation, accepted status, and notification are missing. |
| ID-11 | No | Partial | Comment and support APIs/hooks and detail UI exist. | Own-idea support enforcement and the 5-point commenter / 2-point author reward rules are missing. |

## 2. Quizzes journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| QZ-01 | No | Partial | Wave 3 backend seeds a versioned 3×4 catalogue and exposes category, level, objective, pass mark, time-limit, and redacted-detail APIs. | Frontend catalogue integration and admin content management remain. |
| QZ-02 | No | Partial | Wave 3 backend persists timed attempts, serves one-at-a-time-compatible question payloads, validates answers, and grades from server time. | Frontend timer/question navigation remains. |
| QZ-03 | No | Partial | Wave 3 result contracts return score, pass/fail, pass mark, previous score, and replay-safe immutable results. | Frontend result screen remains. |
| QZ-04 | No | Partial | First-attempt correct answers use the seeded `quiz_correct` rule with per-question idempotent ledger awards; retakes pay nothing. | Frontend points display and full reward UI integration remain. |
| QZ-05 | No | Partial | Journey service returns topic scores, category aggregates, attempt trends, open recommendations, and next step. | Frontend journey visualization remains. |
| QZ-06 | No | Partial | Configurable threshold rules create/update open recommendations with reasons and in-app notifications for low topic scores. | Article linking/reading completion and frontend recommendation UI remain. |
| QZ-07 | No | Partial | Ranking API supports active whole-bank and department views ordered by Ignite Points. | Frontend ranking view remains. |
| QZ-08 | No | Partial | Challenge API lists open challenge questions, deadlines, participant counts, join state, and gives one idempotent `challenge_join` award. | Admin challenge management and frontend challenge UI remain. |

## 3. Articles journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| AR-01 | No | Partial | Library navigation and static article content are present in the prototype. | No published-article catalogue, category filtering, or article API integration. |
| AR-02 | No | Partial | The prototype has a library/recommendation presentation surface. | No persisted recommendation records, reason display, or correct empty state. |
| AR-03 | No | Partial | Article-style screens exist in the prototype. | No functional internal rendering and external-source link contract. |
| AR-04 | No | Not started | No article completion service exists. | Read completion, recommendation closure, one-time points, and badge unlocking are missing. |
| AR-05 | No | Not started | Generic Gemini job infrastructure exists under [`src/lib/ai`](../src/lib/ai). | No article recommendation insight endpoint or fallback rule-message implementation. |

## 4. Rewards journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| RW-01 | No | Partial | Prototype account/rewards surfaces display a points/rewards concept. | No live balance source, catalogue API, earned-only recognition separation, or ledger-backed balance. |
| RW-02 | No | Not started | No redemption API or transactional reward flow exists. | Confirmation, immediate deduction, idempotency, and requested redemption creation are missing. |
| RW-03 | No | Not started | No server redemption balance check exists. | Insufficient-balance rejection and non-negative balance guarantee are missing. |
| RW-04 | No | Not started | No redemption history API exists. | Employee redemption list and requested/fulfilled/cancelled statuses are missing. |
| RW-05 | No | Not started | No back-office redemption workflow exists. | Requested-only handling, cancellation refunds, and audit logging are missing. |
| RW-06 | No | Not started | No rewards catalogue management API or admin UI exists. | Create/edit name, description, cost, kind, and active state are missing. |

## 5. Admin portal journey

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| AD-01 | No | Not started | [`app/private/admin/page.tsx`](../app/private/admin/page.tsx) is still a placeholder. | Screening queue, due dates, assignment, return, reject, and defer actions are missing. |
| AD-02 | No | Not started | No second transformation queue exists. | Owner-approved queue, confirmation action, POC transition, and notification are missing. |
| AD-03 | No | Not started | No business-owner evaluation workspace exists. | Routed-only visibility, five answers, AI assessment, explanations, and decision actions are missing. |
| AD-04 | No | Partial | Idea scoring fields and AI schemas exist in the backend. | Reviewer UI does not show each KPI answer, score, weight, and author explanation. |
| AD-05 | No | Not started | No management dashboard or export implementation exists. | Pipeline analytics, department/points/learning metrics, and CSV exports are missing. |
| AD-06 | No | Not started | Auth currently supports the base admin/user roles only. | Employee/reviewer/business-owner/control/management roles, user management, reset, and deactivation are missing. |
| AD-07 | No | Not started | No workflow-settings UI or persisted rule configuration exists. | KPI definitions, weights, bands, minimum score, points, levels, SLAs, controls, departments, and demo profiles are missing. |
| AD-08 | No | Not started | No learning-content management UI/API exists. | Quiz/question management, recommendation rules, and external-link checks are missing. |
| AD-09 | No | Not started | No campaign, challenge, announcement, or feedback back office exists. | Create/pin announcements, challenge lifecycle, campaign management, and feedback responses are missing. |
| AD-10 | No | Partial | Idea events and AI run records provide limited traceability. | Complete login/transition/settings/redemption audit coverage, IP detail, filtering, and CSV export are missing. |

## 6. Cross-cutting stories

| ID | Completed? | Status | Current evidence | Remaining gap |
| :--- | :---: | :--- | :--- | :--- |
| CC-01 | No | Partial | Auth.js and the existing demo UI support a demo-style employee entry concept. | Name/department profile persistence and 30-day same-name demo-session behavior are not implemented end-to-end. |
| CC-02 | No | Partial | Auth.js, Argon2 password hashing, refresh-token hashing, role claims, and configurable token TTLs exist. | Five-attempt lockout, 15-minute lock duration, idle timeout enforcement, and complete session policy verification are missing. |
| CC-03 | No | Partial | Notification persistence and read APIs exist in [`app/api/notifications`](../app/api/notifications). | The employee UI still uses static notifications and SMTP email delivery is not implemented. |
| CC-04 | No | Partial | User points and prototype level displays exist. | Immutable points ledger, all event awards, level thresholds, idempotency, and audited balance calculation are missing. |
| CC-05 | No | Partial | Prototype badge surfaces and user-related schema foundations exist. | Automatic milestone evaluation and persisted badge-award rules are missing. |
| CC-06 | No | Not started | No functional feedback campaign/back-office response workflow exists. | Pinned campaign, categorized feedback, response, notification, and audit behavior are missing. |

## Completion rule

No story should be changed to **Complete** until its acceptance criteria have:

1. A working backend contract and persistence path.
2. Server-side authorization and validation where applicable.
3. A connected frontend state/query flow with loading, error, empty, and success states.
4. Focused automated verification plus an end-to-end smoke path where applicable.
5. Audit/idempotency behavior for points, rewards, workflow decisions, and other bank-sensitive mutations.

This document is the implementation checklist for the remaining work. The source requirements file remains unchanged.
