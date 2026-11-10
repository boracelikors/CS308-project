// HTTP tests for login, logout and me with an in-memory session store (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createSessionMiddleware, SESSION_COOKIE_NAME } = require("../auth/session");
const { createLoginHandler, createLogoutHandler, me } = require("../auth/loginRoutes");
const { requireAuth } = require("../auth/guards");
const { errorHandler } = require("../http/errorHandler");

const USER = { id: 7, name: "Onur Tekin", email: "onur@example.com", role: "customer" };

// Fake credential check: only onur@example.com / secret123 works
async function fakeAuthenticate(body) {
  if (!body?.email || !body?.password) {
    return { ok: false, code: "VALIDATION_ERROR", fields: { email: "Enter your email address." } };
  }
  if (body.email === "blocked@example.com") return { ok: false, code: "TOO_MANY_ATTEMPTS" };
  if (body.email === USER.email && body.password === "secret123") return { ok: true, user: USER };
  return { ok: false, code: "INVALID_CREDENTIALS" };
}

async function startApp(t) {
  const app = express();
  app.use(express.json());
  app.use(createSessionMiddleware({ secret: "unit-test-secret" })); // memory store
  app.post("/auth/login", createLoginHandler({ authenticate: fakeAuthenticate }));
  app.post("/auth/logout", createLogoutHandler());
  app.get("/auth/me", requireAuth, me);
  app.get("/public", (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://localhost:${server.address().port}`;

  const request = (method, path, { body, cookie } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  return { request };
}

// "dobby.sid=abc; Path=/; HttpOnly" -> "dobby.sid=abc"
function sessionCookie(res) {
  const header = res.headers.get("set-cookie");
  return header ? header.split(";")[0] : null;
}

const GOOD = { email: "onur@example.com", password: "secret123" };

test("login returns the user and sets an HttpOnly, SameSite=Lax session cookie", async (t) => {
  const { request } = await startApp(t);
  const res = await request("POST", "/auth/login", { body: GOOD });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { user: USER });
  const header = res.headers.get("set-cookie");
  assert.match(header, new RegExp(`^${SESSION_COOKIE_NAME}=`));
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Lax/i);
  assert.doesNotMatch(header, /Secure/i); // plain http on localhost in development
});

test("me returns the logged-in user with the cookie, 401 without it", async (t) => {
  const { request } = await startApp(t);
  const cookie = sessionCookie(await request("POST", "/auth/login", { body: GOOD }));
  const res = await request("GET", "/auth/me", { cookie });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { user: USER });

  const guest = await request("GET", "/auth/me");
  assert.equal(guest.status, 401);
  assert.equal((await guest.json()).error.code, "UNAUTHENTICATED");
});

test("wrong credentials: 401 with one generic message and no cookie", async (t) => {
  const { request } = await startApp(t);
  const res = await request("POST", "/auth/login", { body: { ...GOOD, password: "wrong999" } });
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), {
    error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." },
  });
  assert.equal(res.headers.get("set-cookie"), null);
});

test("too many attempts: 429", async (t) => {
  const { request } = await startApp(t);
  const res = await request("POST", "/auth/login", { body: { email: "blocked@example.com", password: "x" } });
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error.code, "TOO_MANY_ATTEMPTS");
});

test("missing fields: 400 VALIDATION_ERROR with fields", async (t) => {
  const { request } = await startApp(t);
  const res = await request("POST", "/auth/login", { body: { email: "" } });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.ok(body.error.fields.email);
});

test("logging in again gives a new session ID and the old one stops working", async (t) => {
  const { request } = await startApp(t);
  const first = sessionCookie(await request("POST", "/auth/login", { body: GOOD }));
  const second = sessionCookie(await request("POST", "/auth/login", { body: GOOD, cookie: first }));
  assert.notEqual(second, first);
  assert.equal((await request("GET", "/auth/me", { cookie: first })).status, 401);
  assert.equal((await request("GET", "/auth/me", { cookie: second })).status, 200);
});

test("logout: 204, clears the cookie and ends the session on the server", async (t) => {
  const { request } = await startApp(t);
  const cookie = sessionCookie(await request("POST", "/auth/login", { body: GOOD }));
  const res = await request("POST", "/auth/logout", { cookie });
  assert.equal(res.status, 204);
  assert.match(res.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
  // Even if the browser kept the old cookie, it no longer logs anyone in
  assert.equal((await request("GET", "/auth/me", { cookie })).status, 401);
});

test("logout when not logged in is still 204", async (t) => {
  const { request } = await startApp(t);
  assert.equal((await request("POST", "/auth/logout")).status, 204);
});

test("guests do not get a session cookie", async (t) => {
  const { request } = await startApp(t);
  const res = await request("GET", "/public");
  assert.equal(res.headers.get("set-cookie"), null);
});
