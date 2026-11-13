// Shared helpers for database/API tests (db-tests/*.spec.js). Not a test file itself:
// `npm run test:db` only runs files ending in .spec.js.
//
//   const { db, config, resetTestDatabase, startTestApp, registerCustomer } = require("./support");
//   before(async () => {
//     await resetTestDatabase();            // empty dobby_test + migrations + demo catalogue
//     api = await startTestApp();           // the real app on a free port, never 3001
//     alice = await registerCustomer(api, "alice@example.com");
//   });
//   after(() => api.close());               // closes the server and the database pool

process.env.NODE_ENV = "test"; // must be set before config is loaded
const config = require("../config");
const { db } = require("../db/knex");
const { createApp } = require("../app");
const { KnexSessionStore } = require("../auth/sessionStore");

// Second line of defence after config.js: never reset anything but a *_test database
function assertTestDatabase() {
  const name = config.db.database;
  if (!config.isTest || !/_test$/i.test(name)) {
    throw new Error(`Refusing to reset "${name}": database tests only run against a *_test database.`);
  }
}

// Drops every table in the test database, including Knex's own migration log.
// Unlike `migrate.rollback`, this works even when the database was last migrated on
// another branch whose migration files are not in this checkout ("migration directory
// is corrupt"), so switching branches never breaks the tests.
async function dropAllTables() {
  assertTestDatabase();
  // A transaction keeps every statement on one connection, so the session setting applies
  await db.transaction(async (trx) => {
    const [rows] = await trx.raw(
      "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    if (rows.length === 0) return;
    await trx.raw("SET FOREIGN_KEY_CHECKS = 0");
    await trx.raw(`DROP TABLE ${rows.map(() => "??").join(", ")}`, rows.map((r) => r.name));
    await trx.raw("SET FOREIGN_KEY_CHECKS = 1");
  });
}

// Empty test database, all migrations of this checkout and (by default) the demo catalogue
async function resetTestDatabase({ seed = true } = {}) {
  await dropAllTables();
  await db.migrate.latest();
  if (seed) await db.seed.run();
}

// Starts the real Express app with MySQL sessions on a free port chosen by the OS.
// request() returns { status, headers, body, cookie } and never throws on 4xx/5xx.
async function startTestApp() {
  const app = createApp({ db, config, sessionStore: new KnexSessionStore({ db, cleanupIntervalMs: 0 }) });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;

  async function request(method, path, { body, cookie, headers = {} } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return {
      status: res.status,
      headers: res.headers,
      body: text ? JSON.parse(text) : null,
      cookie: res.headers.get("set-cookie")?.split(";")[0] ?? null,
    };
  }

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    await db.destroy();
  }

  return { base, port: server.address().port, request, close };
}

// Registers and logs in a customer through the real API. Returns { id, email, cookie }.
async function registerCustomer(api, email, password = "secret123") {
  const registered = await api.request("POST", "/auth/register", {
    body: {
      name: "Test Customer",
      taxId: "12345678901",
      email,
      homeAddress: "Orta Mah. Universite Cad. No:27, Tuzla",
      password,
    },
  });
  if (registered.status !== 201) {
    throw new Error(`Could not register ${email}: ${registered.status} ${JSON.stringify(registered.body)}`);
  }
  const login = await api.request("POST", "/auth/login", { body: { email, password } });
  return { id: login.body.user.id, email, cookie: login.cookie };
}

module.exports = { db, config, assertTestDatabase, dropAllTables, resetTestDatabase, startTestApp, registerCustomer };