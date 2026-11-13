# Sprint 2 release handoff — SCRUM-41

This branch implements SCRUM-18/26/27 and prepares release documentation. Review/merge and live database verification remain required. It does not mark Sprint 2 complete.

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
