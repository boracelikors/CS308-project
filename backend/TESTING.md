# Backend tests and CI

How to run the tests, where a new test belongs, and what GitHub Actions checks on every pull request.

## Commands

Run from `backend/`. They work the same on Windows, macOS and Linux (`cross-env` sets `NODE_ENV=test`).

| Command | What it runs | Needs MySQL |
| --- | --- | --- |
| `npm test` | Unit tests: `test/*.test.js` | No |
| `npm run test:db` | Empties `dobby_test` (`db-tests/clean.js`), then runs the database and API tests `db-tests/*.spec.js`, one file at a time | Yes, `dobby_test` |
| `npm run migrate:test` | Apply migrations to `dobby_test` (the db tests also do this themselves) | Yes |
| `npm run test:count` | Number of test cases per kind and file, for the sprint report | No |

Database setup (databases, `dobby_app` user, `.env`) is in [DATABASE.md](DATABASE.md).

## Unit test or database test?

| | Unit test | Database / API test |
| --- | --- | --- |
| Folder and name | `test/<module>.test.js` | `db-tests/<feature>.spec.js` |
| Database | Never. Pass a fake store or call a pure function | The real `dobby_test` MySQL database |
| HTTP | Allowed with an in-process Express app on port `0` and a fake store/session | The real app from `startTestApp()` |
| Use for | Validation rules, money calculations, merge/stock rules, error mapping, status codes per error | SQL queries, constraints, transactions, isolation between users, duplicate requests, concurrency |
| Speed | Milliseconds | Seconds |

Rules:

- The feature owner writes both kinds of tests in the same pull request as the code.
- Keep business rules in pure functions (for example `cart/mergePlan.js`, `cart/cartMath.js`) so most cases are unit tests.
- Do not copy the same assertion into both kinds of tests just to raise the count. A database test checks what only the database can prove.
- Unit tests never read `.env`, never open MySQL and never use port 3001.

## Test database safety

Database tests drop and rebuild every table. Two guards make sure this only happens to the test database:

1. `config.js` refuses to start in test mode unless `DB_NAME_TEST` ends with `_test` and differs from `DB_NAME` (`db/testDatabaseGuard.js`, unit-tested).
2. `resetTestDatabase()` in `db-tests/support.js` checks the name again before resetting.

Your development data in `dobby_dev` is never touched by any test command.

Switching branches is safe: `npm run test:db` first drops every table in `dobby_test` (including Knex's migration log) and then applies the migrations of the current checkout. Without this, a database last migrated on a branch with an extra migration fails with *"The migration directory is corrupt"*.

## Shared helpers for database tests

`db-tests/support.js`:

```js
const { test, before, after } = require("node:test");
const { db, resetTestDatabase, startTestApp, registerCustomer } = require("./support");

let api;
let alice;

before(async () => {
  await resetTestDatabase();          // empty dobby_test, all migrations, demo catalogue
  api = await startTestApp();         // the real app on a free port (never 3001)
  alice = await registerCustomer(api, "alice@example.com"); // { id, email, cookie }
});

after(() => api.close());             // closes the server and the database pool

test("example", async () => {
  const res = await api.request("GET", "/cart", { cookie: alice.cookie });
  // res = { status, headers, body, cookie }; 4xx/5xx do not throw
});
```

Demo catalogue fixtures (out of stock, last unit, fractional price, equal prices) are listed in [DATABASE.md](DATABASE.md#fixture-ids-for-frontend-and-tests). Existing spec files keep their own setup; new spec files should use these helpers.

## GitHub Actions

`.github/workflows/ci.yml` runs on every pull request and every push to `main`. Three checks, each must be green before merging:

| Check | Steps |
| --- | --- |
| Backend unit tests | `npm ci`, `npm test` |
| Backend database and API tests | MySQL 8.4 service container with a throwaway `dobby_test`, `npm ci`, `npm run test:db` |
| Frontend lint, build and tests | `npm ci`, `npm run lint`, `npm run build`, `npm run test` (skipped until the frontend has a test script) |

Installs use the lockfiles (`npm ci`). The CI database password is a test-only value for a container that is deleted after the run; no real secrets are used.

When a check fails: open the pull request, **Checks** tab, click the red job and expand the failed step. The test name and the failing assertion are printed there. Run the same command locally to reproduce.

## Cross-feature integration cases

These run in CI as soon as each feature is merged. They live with the feature that owns them:

| Behaviour | Test |
| --- | --- |
| Users only see their own cart | `cartFlow.spec.js` "customers only see their own cart", `cartStore.spec.js` "two customers have separate carts" |
| Last unit: two adds at the same time, only one fits | `cartStore.spec.js` "two simultaneous adds of the last item" |
| Duplicate / concurrent guest-cart merge applied once | `cartMerge.spec.js` (SCRUM-32) |
| Duplicate / concurrent checkout creates one order | `checkoutFlow.spec.js` "two simultaneous submits with the same key" (SCRUM-34) |
| Last unit at checkout, stock never negative | `checkoutFlow.spec.js` "two customers competing for the last unit" (SCRUM-34) |
| Login rate limit, session isolation | `authFlow.spec.js` |

## Counting tests for the sprint report

```sh
npm run test:count                                 # current totals per kind and file
node ../scripts/count-tests.js --since <commit>    # new tests since a commit (e.g. end of last sprint)
```

Unit tests, database/API tests and frontend tests are reported separately. Only `backend unit` and `frontend unit` count as unit tests.