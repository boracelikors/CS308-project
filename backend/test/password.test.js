const test = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword } = require("../auth/password");

test("hash is not the plain password", async () => {
  const hash = await hashPassword("secret123");
  assert.notEqual(hash, "secret123");
  assert.ok(!hash.includes("secret123"));
  assert.match(hash, /^\$2[aby]\$12\$/); // bcrypt format, cost 12
});

test("same password gives different hashes (random salt)", async () => {
  const first = await hashPassword("secret123");
  const second = await hashPassword("secret123");
  assert.notEqual(first, second);
});

test("verify accepts the right password and rejects a wrong one", async () => {
  const hash = await hashPassword("secret123");
  assert.equal(await verifyPassword("secret123", hash), true);
  assert.equal(await verifyPassword("secret124", hash), false);
});
