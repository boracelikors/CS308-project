// users/userStore.js against real MySQL (SCRUM-22, SCRUM-23).
// Needs the dobby_test database. Run with: npm run test:db

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
const { db } = require("../db/knex");
const { createUser, findUserByEmail } = require("../users/userStore");

const ONUR = {
  name: "Onur Tekin",
  email: "onur@example.com",
  passwordHash: "$2b$12$" + "x".repeat(53), // 60 chars, like a real bcrypt hash
  role: "customer",
  taxId: "12345678901",
  homeAddress: "Orta Mah. Universite Cad. No:27, Tuzla",
};

before(async () => {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
});

after(async () => {
  await db.destroy();
});

test("createUser stores the account and returns only safe fields", async () => {
  const user = await createUser(db, ONUR);
  assert.deepEqual(Object.keys(user).sort(), ["email", "id", "name", "role"]);
  const row = await db("users").where({ id: user.id }).first();
  assert.equal(row.password_hash, ONUR.passwordHash);
  assert.equal(row.tax_id, "12345678901");
});

test("a second account with the same email is rejected as EMAIL_TAKEN", async () => {
  await assert.rejects(() => createUser(db, { ...ONUR, name: "Someone Else" }), { code: "EMAIL_TAKEN" });
  const [{ count }] = await db("users").where({ email: ONUR.email }).count({ count: "*" });
  assert.equal(Number(count), 1);
});

test("two registrations at the same moment: exactly one succeeds", async () => {
  const twin = { ...ONUR, email: "twin@example.com" };
  const results = await Promise.allSettled([createUser(db, twin), createUser(db, twin)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.find((r) => r.status === "rejected").reason.code, "EMAIL_TAKEN");
});

test("findUserByEmail returns the hash for login, null for unknown email", async () => {
  const found = await findUserByEmail(db, "onur@example.com");
  assert.equal(found.name, "Onur Tekin");
  assert.equal(found.passwordHash, ONUR.passwordHash);
  assert.equal(await findUserByEmail(db, "nobody@example.com"), null);
});
