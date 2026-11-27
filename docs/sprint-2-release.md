# Sprint 2 release handoff — 27 November 2026

## Current functionality

Accounts/session isolation, catalogue search/filter/sort, product details, guest cart persistence, authenticated cart merge, simulated checkout, order history and delivery tracking are integrated. PR #28 supplies invoice persistence/PDF/email. The final integration adds invoice download, email delivery status and retry controls to checkout confirmation and order detail, including recovered checkout confirmation.

## Run locally from a fresh checkout

Use Node.js 24 and MySQL 8.4 (the versions used in CI).

1. In `backend`, run `npm ci`. Follow [DATABASE.md](../backend/DATABASE.md) to create a development database, a separate disposable test database and the application user.
2. Copy `backend/.env.example` to `backend/.env`, set database credentials and a generated `SESSION_SECRET`. Never commit local secrets. Wait for MySQL to accept connections before migrations/startup; `docker start` alone does not mean MySQL is ready.
3. Run `npm run migrate` and, for a new demo database only, `npm run seed`. Do not reset an existing database to fix a connection failure.
4. Optionally start a local Mailpit test inbox: `docker run -d --name cs308-sprint2-mailpit -p 127.0.0.1:11025:1025 -p 127.0.0.1:18025:8025 axllent/mailpit`. If it already exists, use `docker start cs308-sprint2-mailpit`. Set `SMTP_HOST=127.0.0.1` and `SMTP_PORT=11025` in the backend environment. Inbox: http://localhost:18025. Without SMTP, checkout/PDF work and the UI reports email pending or failed.
5. Start backend with `npm start`; verify `/health/db` returns database up, not merely that the server prints its listening address.
6. In another terminal, `cd frontend`, `npm ci`, `npm run dev`. The default backend is http://localhost:3001 and frontend http://localhost:5173. For another backend, set `VITE_API_BASE_URL` in `frontend/.env.local`; add the exact frontend origin to backend `FRONTEND_ORIGIN` and restart both.
7. If a port is occupied, reuse the existing application or choose a free port; do not kill an unknown process. For example: `VITE_API_BASE_URL=http://localhost:33026 npm run dev -- --port 5174 --strictPort`, with `http://localhost:5174` allowed by the backend.

### Existing Yunus demo environment

The prepared checkout is `sprint2-yunus`. Start Docker Desktop, then `docker start cs308-pr26-mysql cs308-sprint2-mailpit`. Wait until MySQL is ready (check `docker logs --tail 20 cs308-pr26-mysql`). In `backend`, `npm run migrate`, then `SMTP_HOST=127.0.0.1 SMTP_PORT=11025 npm start`. In `frontend`, run the alternate-port command above. Local URLs: storefront http://localhost:5174; backend http://localhost:33026; test inbox http://localhost:18025. The ignored backend environment already points at port 33326 and the existing development database. No deployment is required.

## Verification on 27 November

Candidate: main `477b345` plus PR #28 head `29e36d9` and final integration changes.

- Backend unit tests: 173 passed.
- Real MySQL database/API tests: 132 passed, zero skipped, on the isolated test database. Covers stock/payment/order concurrency, owner/role authorization and invoice behaviour.
- Frontend unit tests: 111 passed; React component tests: 21 passed. Lint and production build passed.
- Browser against Express/MySQL: an actual test checkout produced order #3 for 18,749.90 TRY; checkout confirmation and direct order detail displayed its invoice; downloaded PDF inspected visually, including brand, amounts and address.
- Mailpit received INV-2026-000003 with the PDF attachment and matching amount. The storefront displayed sent status. This is local test delivery, not proof of delivery to an external email account.
- Earlier browser evidence below records catalogue/guest cart/login merge, declined payment, delivery transitions, account isolation and narrow-screen checks. The viewport override on this run did not change the observed 1280px viewport; a new full multi-page 375/768/1440 matrix is not claimed.

Orders created before invoice issuance was added keep their order history. The app shows that an invoice is unavailable for those orders because the original buyer snapshot was not stored.

## Remaining human acceptance

Implementation/test evidence is separate from teammate acceptance. Backend owners must acknowledge the SCRUM-18 contract; reviewers must acknowledge their assigned review. Each member must rehearse and explain their own code. Check the course's per-member meaningful commit counts, genuine bug reports, new unit tests and backlog thresholds against the official demo requirements; do not manufacture activity to meet a count. R5 delivered-purchase ratings/comments and moderation remain planned Sprint 3 work.

## Historical evidence

The dated notes below describe earlier snapshots. Statements about missing checkout, invoice, CI or other dependencies in those snapshots are superseded by the current section above.

# Sprint 2 release handoff — SCRUM-41

This branch implements SCRUM-18/26/27 and prepares release documentation. PR #26 has completed local integration verification and is ready for team review; reviewer approval and merge remain required. It does not mark Sprint 2 complete.

## Run a fresh checkout
1. In backend: npm ci. Follow DATABASE.md to configure the MySQL application user, dobby_dev and isolated dobby_test databases. Copy .env.example to .env and set credentials plus a generated SESSION_SECRET. Never commit .env.
2. Run npm run migrate, npm run seed, npm run dev in backend.
3. In frontend: npm ci, then npm run dev. Set VITE_API_BASE_URL in .env.local only if backend is not localhost:3001. Add any alternate frontend origin to backend FRONTEND_ORIGIN.
4. Open http://localhost:5173. If that port is in use, reuse/stop the known server or choose another port and update allowed origins.
5. Frontend checks: npm test, npm run lint, npm run build. Backend: npm test. Only with a dedicated disposable test database: npm run migrate:test, npm run test:db (rebuilds test data).

## Account demo checklist
- Register a fictional account; verify field errors, duplicate email and password confirmation.
- Log in with incorrect then correct credentials. Refresh /profile: name/email/address persist.
- Open /checkout anonymously: redirect to login, then return to checkout after login. Checkout is currently a placeholder.
- Log out: profile and protected routes disappear. Switch accounts and verify no private data remains.
- Stop backend: show a connection error and retry, not a false anonymous session.
- Check 375px and laptop layout, keyboard focus, direct links and browser back/forward.

## Whole-sprint release gate — pending dependencies
Main still serves the static product feed. Guest cart/merge, product detail/search, checkout, invoice/email, order-history and manager delivery integration require their owners' PRs. Until then the full shopping demo, payment/stock concurrency checks and test-mailbox receipt cannot be verified. No fake success flows are provided.

Before release, follow SCRUM-41's full checklist against a recorded merged commit, with separate test evidence. Review R5 delivered-purchase ratings/comments and comment approval in Sprint 3. Each member must explain their code. Course evidence thresholds apply per demo; do not manufacture commits/bugs to satisfy counts.

## Verification recorded 13 November 2026 — PR #26

Base: `0a85902` (current main); implementation before this verification: `fe39573`.
PR: https://github.com/boracelikors/CS308-project/pull/26

- Frontend: `npm test` — 14/14 passed; `npm run lint` — no warnings; `npm run build` — passed.
- Backend: `npm test` — 77/77 passed.
- MySQL 8.4: `npm run test:db` — 58/58 passed against a dedicated disposable database. Includes migrations, seeds, constraints, cart persistence, real registration/login/session storage, restart persistence, logout, expiry, rate limiting and CORS.
- Added real-database assertions that login and /auth/me include homeAddress and expose only id/name/email/role/homeAddress, excluding tax ID and password hash.
- Live browser against Express + MySQL: registration and confirmation mismatch, duplicate email rejection, incorrect/correct login, profile refresh persistence, logout, account switching, anonymous /checkout redirect and return after login all passed.
- Stopped/restarted Express: /profile displayed the connection error without a false logout; Retry restored the existing persisted session.
- Visual checks: profile at 1280px and 375px; registration at 375px. No horizontal overflow at 375px. Keyboard Tab moves between form fields; browser back/forward and direct protected links work.
- Browser title is Audiophile House. Initial asynchronous session loading no longer produces the lint warning.
- Test environment used separate frontend/backend/MySQL ports (5174/33026/33326), fictional accounts and ignored local configuration. Existing databases and the original checkout were untouched.

## Review and merge boundary

These checks cover this PR's account/session foundation. They do not claim teammate approval or completion of the whole sprint. The implemented authentication contract was checked against the live backend; proposed commerce endpoints still need their owners' agreement. Guest-cart merge and end-to-end purchase verification remain dependent follow-up work, not functionality delivered by this PR. Checkout, product-detail and order-history placeholders are intentional.

Before merging, a teammate should review the diff and API handoff. Re-run integration if main changes. No merge has been performed as part of this verification.

## Open-PR integration review — 13 November 2026

Main at review: 2da7da0 (#26 and #25 merged). No open PR was merged during this review.

Recommended merge order: **#18 -> #22 -> #23 -> #17 -> #24 -> #19 -> #20 -> #21**. Use normal merge commits to preserve the branch ancestry. Each later frontend PR includes its prerequisite changes; its diff against main shrinks after predecessors merge. Recheck main if teammates publish further changes.

- Updated all eight PR branches without rewriting history. Resolved README, routing, header, CSS, API-client and test-runner conflicts while preserving both authors' features.
- Individual branches: backend tests passed for #18/#22/#23; frontend tests/lint/build passed for #17/#24/#19/#20/#21.
- Combined candidate (#21): 147 backend tests, 115 real MySQL integration tests, 109 Node frontend tests and 16 React component tests passed. Frontend lint/build passed. Counts include existing tests and are not a claim of all-new unit cases.
- Fixed guest cart returnUrl/returnTo mismatch. Mounted all pages on React Router, connected CartProvider to the session, and unified the final candidate's API client, including expiry handling.
- Fixed checkout reload uncertainty by persisting only an account-scoped request key and resolving/cancelling the previous attempt on the server; regression tests cover recovered success, blocked duplicate submission, missing storage, delayed original requests and account isolation.
- Live browser with Express/MySQL: description search, product detail, guest cart surviving refresh, login/merge retaining the item, declined test payment, successful order and empty cart, order history/detail all passed. Manager API changed the order through in_transit to delivered, visible after refresh. A second customer could not open the first customer's order.
- 375px order-detail visual check passed without horizontal overflow. Full multi-page 768px/1440px regression remains a whole-release checklist item.
- SCRUM-26/27 implementation is integrated; their original #26 was merged. Final teammate review and verification after all dependency merges remain required. SCRUM-18 still requires backend-owner contract acceptance and the invoice interface from SCRUM-36.
- SCRUM-36 PDF/test email and SCRUM-37 GitHub Actions remain outside these open PRs. The full Sprint 2 release is not Done.
