# Three account roles implementation plan

1. **Lock the role contract:** rewrite permission, routing, user creation, settings, workflow, and story tests around `employee | back_office | business_owner`; remove Tasks from shell/navigation tests.
2. **Migrate storage:** change `users.role` to the three-value model, remove `users.profile`, add a data-preserving SQLite migration that maps old profiles and revokes sessions, and update migration journal/snapshot.
3. **Update auth and authorization:** carry only the three roles in credentials/JWT/session, route employee to `/private`, business owner/back-office to the permitted workspace, and enforce each capability against the new role.
4. **Update product flows:** remove profile selectors and profile-policy controls; use role selectors in admin user management and settings. Remove Tasks UI code while retaining the shared ideas governance API.
5. **Update dependent workflows and docs:** remap idea workflow actors, control reviews, test fixtures, seed admin, AI routing enums, story acceptance rows, and role labels.
6. **Verify safely:** run migrations and relevant tests only against a temporary SQLite DB; type-check and production-build; smoke-test role routing, admin user create, owner assignment restriction, and absence of Tasks. Do not run tests against the shared `.env` database.
