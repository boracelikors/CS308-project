// HTTP tests for POST /auth/register with a fake user store (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createRegisterHandler } = require("../auth/registerRoute");
const { errorHandler } = require("../http/errorHandler");

const VALID = {
  name: "Onur Tekin",
  taxId: "12345678901",
  email: "  Onur@Example.com ",
  homeAddress: "Orta Mah. Universite Cad. No:27, Tuzla, Istanbul",
  password: "secret123",
};

// Starts a small app on a free port; createUser can be replaced per test
async function startApp(createUser) {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.post(
    "/auth/register",
    createRegisterHandler({
      hashPassword: async (plain) => `hashed(${plain})`,
      createUser: async (fields) => {
        calls.push(fields);
        return createUser(fields);
      },
    })
  );
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const url = `http://localhost:${server.address().port}/auth/register`;
  const post = (body, raw) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ?? JSON.stringify(body),
    });
  return { post, calls, close: () => new Promise((r) => server.close(r)) };
}

const okStore = async (f) => ({ id: 1, name: f.name, email: f.email, role: f.role });

test("valid registration returns 201 with safe fields only", async (t) => {
  const app = await startApp(okStore);
  t.after(app.close);
  const res = await app.post(VALID);
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), {
    user: { id: 1, name: "Onur Tekin", email: "onur@example.com", role: "customer" },
  });
});

test("store receives a hash, never the plain password", async (t) => {
  const app = await startApp(okStore);
  t.after(app.close);
  await app.post(VALID);
  const saved = app.calls[0];
  assert.equal(saved.passwordHash, "hashed(secret123)");
  assert.equal("password" in saved, false);
  assert.equal(saved.email, "onur@example.com");
  assert.equal(saved.taxId, "12345678901");
});

test("a submitted role is ignored; account is always customer", async (t) => {
  const app = await startApp(okStore);
  t.after(app.close);
  const res = await app.post({ ...VALID, role: "sales_manager" });
  assert.equal(res.status, 201);
  assert.equal(app.calls[0].role, "customer");
});

test("invalid fields return 400 with field messages and nothing is saved", async (t) => {
  const app = await startApp(okStore);
  t.after(app.close);
  const res = await app.post({ ...VALID, email: "not-an-email", password: "short" });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.ok(body.error.fields.email);
  assert.ok(body.error.fields.password);
  assert.equal(app.calls.length, 0);
});

test("duplicate email returns 409 EMAIL_TAKEN", async (t) => {
  const app = await startApp(async () => {
    const err = new Error("taken");
    err.code = "EMAIL_TAKEN";
    throw err;
  });
  t.after(app.close);
  const res = await app.post(VALID);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error.code, "EMAIL_TAKEN");
});

test("malformed JSON returns 400, not 500", async (t) => {
  const app = await startApp(okStore);
  t.after(app.close);
  const res = await app.post(null, "{ not json");
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "VALIDATION_ERROR");
});

test("unexpected database error returns 500 without details", async (t) => {
  const app = await startApp(async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:3306 secret-details");
  });
  t.after(app.close);
  const original = console.error;
  console.error = () => {}; // keep the test output clean
  t.after(() => (console.error = original));
  const res = await app.post(VALID);
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.match(text, /INTERNAL_ERROR/);
  assert.doesNotMatch(text, /ECONNREFUSED|secret-details/);
});
