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
