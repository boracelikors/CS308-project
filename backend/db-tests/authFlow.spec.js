// Full register -> login -> me -> logout flow against real MySQL, using the real
// app (app.js) and the MySQL session store (SCRUM-22, SCRUM-23).
// Needs the dobby_test database. Run with: npm run test:db

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
const config = require("../config");
const { db } = require("../db/knex");
const { createApp } = require("../app");
const { KnexSessionStore } = require("../auth/sessionStore");

const servers = [];

// Starts the real app on a free port; a new call is like restarting the server
async function startServer() {
  const sessionStore = new KnexSessionStore({ db, cleanupIntervalMs: 0 });
  const app = createApp({ db, config, sessionStore });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  const base = `http://localhost:${server.address().port}`;
  return (method, path, { body, cookie } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
}

const cookieOf = (res) => res.headers.get("set-cookie")?.split(";")[0] ?? null;
const sidOf = (cookie) => decodeURIComponent(cookie.split("=")[1]).slice(2).split(".")[0];

const ACCOUNT = {
  name: "Onur Tekin",
  taxId: "12345678901",
  email: "Onur@Example.com",
  homeAddress: "Orta Mah. Universite Cad. No:27, Tuzla",
  password: "secret123",
};

let request;

before(async () => {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  request = await startServer();
  const res = await request("POST", "/auth/register", { body: ACCOUNT });
  assert.equal(res.status, 201);
});

after(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  await db.destroy();
});

test("register does not log in", async () => {
  const res = await request("POST", "/auth/register", { body: { ...ACCOUNT, email: "second@example.com" } });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get("set-cookie"), null);
});

test("login with the registered password works (email in any case)", async () => {
  const res = await request("POST", "/auth/login", { body: { email: "ONUR@example.com", password: "secret123" } });
  assert.equal(res.status, 200);
  const { user } = await res.json();
  assert.equal(user.email, "onur@example.com");
  assert.equal(user.role, "customer");
  assert.equal(user.homeAddress, ACCOUNT.homeAddress);
  assert.deepEqual(Object.keys(user).sort(), ["email", "homeAddress", "id", "name", "role"]);
});

test("the session is stored in MySQL and found by /auth/me", async () => {
  const cookie = cookieOf(await request("POST", "/auth/login", { body: { email: "onur@example.com", password: "secret123" } }));
  const row = await db("sessions").where({ sid: sidOf(cookie) }).first();
  assert.ok(row, "session row exists");
  assert.equal(JSON.parse(row.data).user.email, "onur@example.com");
  assert.doesNotMatch(row.data, /secret123|password/i);

  const me = await request("GET", "/auth/me", { cookie });
  assert.equal(me.status, 200);
  const { user } = await me.json();
  assert.equal(user.email, "onur@example.com");
  assert.equal(user.homeAddress, ACCOUNT.homeAddress);
  assert.deepEqual(Object.keys(user).sort(), ["email", "homeAddress", "id", "name", "role"]);
});

test("still logged in after a server restart", async () => {
  const cookie = cookieOf(await request("POST", "/auth/login", { body: { email: "onur@example.com", password: "secret123" } }));
  const restarted = await startServer();
  assert.equal((await restarted("GET", "/auth/me", { cookie })).status, 200);
});

test("logout deletes the session row; the old cookie no longer works", async () => {
  const cookie = cookieOf(await request("POST", "/auth/login", { body: { email: "onur@example.com", password: "secret123" } }));
  assert.equal((await request("POST", "/auth/logout", { cookie })).status, 204);
  assert.equal(await db("sessions").where({ sid: sidOf(cookie) }).first(), undefined);
  assert.equal((await request("GET", "/auth/me", { cookie })).status, 401);
});

test("expired sessions are not accepted and are cleaned up", async () => {
  const cookie = cookieOf(await request("POST", "/auth/login", { body: { email: "onur@example.com", password: "secret123" } }));
  await db("sessions").where({ sid: sidOf(cookie) }).update({ expires_at: new Date(Date.now() - 1000) });
  assert.equal((await request("GET", "/auth/me", { cookie })).status, 401);
  await new KnexSessionStore({ db, cleanupIntervalMs: 0 }).clearExpired();
  assert.equal(await db("sessions").where({ sid: sidOf(cookie) }).first(), undefined);
});

test("wrong password is 401; after 5 failures even the right password is 429", async () => {
  const bad = { email: "second@example.com", password: "wrong999" };
  assert.equal((await request("POST", "/auth/login", { body: bad })).status, 401);
  for (let i = 0; i < 4; i++) await request("POST", "/auth/login", { body: bad });
  const res = await request("POST", "/auth/login", { body: { email: "second@example.com", password: "secret123" } });
  assert.equal(res.status, 429);
});

test("CORS allows the frontend origin to send cookies", async () => {
  const res = await request("GET", "/health");
  const preflight = await fetch(res.url.replace("/health", "/auth/login"), {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST" },
  });
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
});
