// Login credential checks with a fake user store (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createAuthenticator } = require("../auth/authenticate");
const { createLoginLimiter } = require("../auth/loginLimiter");

const STORED = {
  id: 7,
  name: "Onur Tekin",
  email: "onur@example.com",
  role: "customer",
  passwordHash: "HASH-OF-secret123",
};

// Fake bcrypt: "HASH-OF-x" matches password x
const fakeVerify = async (plain, hash) => hash === `HASH-OF-${plain}`;

function setup({ maxAttempts = 5 } = {}) {
  const lookups = [];
  const verifiedWith = [];
  const authenticate = createAuthenticator({
    findUserByEmail: async (email) => {
      lookups.push(email);
      return email === STORED.email ? STORED : null;
    },
    verifyPassword: async (plain, hash) => {
      verifiedWith.push(hash);
      return fakeVerify(plain, hash);
    },
    limiter: createLoginLimiter({ maxAttempts }),
    dummyHash: "DUMMY-HASH",
  });
  return { authenticate, lookups, verifiedWith };
}

test("right email and password returns the user without the hash", async () => {
  const { authenticate } = setup();
  const result = await authenticate({ email: "onur@example.com", password: "secret123" });
  assert.deepEqual(result, {
    ok: true,
    user: { id: 7, name: "Onur Tekin", email: "onur@example.com", role: "customer" },
  });
});

test("email is matched case- and space-insensitively", async () => {
  const { authenticate, lookups } = setup();
  const result = await authenticate({ email: "  Onur@Example.COM ", password: "secret123" });
  assert.equal(result.ok, true);
  assert.equal(lookups[0], "onur@example.com");
});

test("wrong password and unknown email give the same error", async () => {
  const { authenticate } = setup();
  const wrong = await authenticate({ email: "onur@example.com", password: "wrong999" });
  const unknown = await authenticate({ email: "nobody@example.com", password: "secret123" });
  assert.deepEqual(wrong, { ok: false, code: "INVALID_CREDENTIALS" });
  assert.deepEqual(unknown, wrong);
});

test("unknown email still runs a password check (no timing hint)", async () => {
  const { authenticate, verifiedWith } = setup();
  await authenticate({ email: "nobody@example.com", password: "secret123" });
  assert.deepEqual(verifiedWith, ["DUMMY-HASH"]);
});

test("missing fields return VALIDATION_ERROR and do not count as a failure", async () => {
  const { authenticate } = setup({ maxAttempts: 1 });
  const result = await authenticate({ email: "", password: "" });
  assert.equal(result.code, "VALIDATION_ERROR");
  assert.ok(result.fields.email && result.fields.password);
  const next = await authenticate({ email: "onur@example.com", password: "secret123" });
  assert.equal(next.ok, true);
});

test("blocked after too many failures, even with the right password", async () => {
  const { authenticate, lookups } = setup({ maxAttempts: 3 });
  for (let i = 0; i < 3; i++) {
    await authenticate({ email: "onur@example.com", password: "wrong999" });
  }
  const before = lookups.length;
  const result = await authenticate({ email: "onur@example.com", password: "secret123" });
  assert.deepEqual(result, { ok: false, code: "TOO_MANY_ATTEMPTS" });
  assert.equal(lookups.length, before, "a blocked email is not looked up");
});

test("a successful login resets the failure count", async () => {
  const { authenticate } = setup({ maxAttempts: 3 });
  await authenticate({ email: "onur@example.com", password: "wrong999" });
  await authenticate({ email: "onur@example.com", password: "wrong999" });
  assert.equal((await authenticate({ email: "onur@example.com", password: "secret123" })).ok, true);
  await authenticate({ email: "onur@example.com", password: "wrong999" });
  await authenticate({ email: "onur@example.com", password: "wrong999" });
  assert.equal((await authenticate({ email: "onur@example.com", password: "secret123" })).ok, true);
});

test("null body does not crash", async () => {
  const { authenticate } = setup();
  assert.equal((await authenticate(null)).code, "VALIDATION_ERROR");
});

test("real dummy hash works when none is injected", async () => {
  const authenticate = createAuthenticator({
    findUserByEmail: async () => null,
    verifyPassword: require("../auth/password").verifyPassword,
    limiter: createLoginLimiter(),
  });
  const result = await authenticate({ email: "nobody@example.com", password: "secret123" });
  assert.equal(result.code, "INVALID_CREDENTIALS");
});
