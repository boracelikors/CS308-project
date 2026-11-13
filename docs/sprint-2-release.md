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
- Browser title is Audophile House. Initial asynchronous session loading no longer produces the lint warning.
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
