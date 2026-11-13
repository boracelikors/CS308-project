// Checks the shared test helpers in support.js (SCRUM-37 test harness).
// Needs the dobby_test database. Run with: npm run test:db

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { db, config, resetTestDatabase, startTestApp, registerCustomer } = require("./support");

let api;

before(async () => {
  await resetTestDatabase();
  api = await startTestApp();
});

after(() => api.close());

test("tests use the separate *_test database, never the development one", () => {
  assert.match(config.db.database, /_test$/);
  assert.notEqual(config.db.database, process.env.DB_NAME);
});

test("the test app runs on a free port, not the development port 3001", async () => {
  assert.notEqual(api.port, 3001);
  const res = await api.request("GET", "/health/db");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "ok", database: "up" });
});

test("reset gives every test file the full demo catalogue", async () => {
  const { n } = await db("products").count({ n: "*" }).first();
  assert.equal(Number(n), 14);
});

test("reset still works after the database was migrated on another branch", async () => {
  // Simulate a migration that exists on another branch but not in this checkout
  await db("knex_migrations").insert({ name: "29991231000000_only_on_another_branch.js", batch: 99, migration_time: new Date() });
  await assert.rejects(db.migrate.rollback(undefined, true), /migration directory is corrupt/);

  await resetTestDatabase();
  const applied = await db("knex_migrations").pluck("name");
  assert.equal(applied.includes("29991231000000_only_on_another_branch.js"), false);
  const { n } = await db("products").count({ n: "*" }).first();
  assert.equal(Number(n), 14);
});

test("registerCustomer returns a logged-in customer with their own session", async () => {
  const alice = await registerCustomer(api, "harness.alice@example.com");
  const bob = await registerCustomer(api, "harness.bob@example.com");
  assert.notEqual(alice.cookie, bob.cookie);
  const me = await api.request("GET", "/auth/me", { cookie: alice.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, alice.id);
  assert.equal(me.body.user.role, "customer");
});