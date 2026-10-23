# Three account roles and Tasks removal

## Intent

Simplify AB Ignite account roles to employee, back-office, and business owner. Remove the redundant Tasks navigation item and its view without interrupting idea governance.

## Decisions

- `users.role` becomes the single role field with values `employee`, `back_office`, and `business_owner`; the separate `profile` field is removed.
- Existing `business_owner` accounts remain business owners. Existing `employee` accounts remain employees. Existing `reviewer`, `control`, `management`, and `admin` accounts become back-office. Existing administrator accounts retain back-office administrative capabilities.
- Role migration preserves all user and idea records. Existing refresh sessions are revoked so old role claims cannot remain active.
- Remove the Tasks navigation item and its page branch. There is no tasks table or task API. The shared final-confirmation queue remains in the Ideas governance workflow.
- Back-office retains administration and governance access. Business owners retain access only to ideas assigned to them and their evaluation actions. Employees retain the employee workspace.
- Update role setup, JWT/session typing, routing, authorization, user management, settings validation, story docs, and migration metadata to the three-role model.

## Out of scope

- Do not delete user, idea, review, audit, control-approval, or refresh-token tables.
- Do not remove governance queue APIs or assigned-idea records needed by AD-01 through AD-03.
- Do not delete existing user or test data; map accounts and revoke sessions instead.

## Acceptance

- No user-facing account role or persisted role/profile schema contains reviewer, control, management, or admin as separate account types.
- Existing data migrates deterministically to the three roles, preserving records and invalidating old sessions.
- Only business owners can act on ideas assigned to them; back-office can administer and operate governance; employees cannot access back-office routes.
- Tasks is absent from desktop/mobile navigation and there is no Tasks-only render branch or endpoint.
- Ideas governance still provides screening and final confirmation.
- Build and isolated-database regression checks pass.
