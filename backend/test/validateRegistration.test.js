const test = require("node:test");
const assert = require("node:assert/strict");
const { validateRegistration } = require("../auth/validateRegistration");

const valid = {
  name: "Onur Tekin",
  taxId: "12345678901",
  email: "onur@example.com",
  homeAddress: "Orta Mah. Universite Cad. No:27, Tuzla",
  password: "secret123",
};

test("valid input passes and is normalized", () => {
  const result = validateRegistration({ ...valid, name: "  Onur Tekin  ", email: " Onur@Example.COM " });
  assert.equal(result.ok, true);
  assert.equal(result.value.name, "Onur Tekin");
  assert.equal(result.value.email, "onur@example.com");
});

test("role is always customer, even if a privileged role is submitted", () => {
  const result = validateRegistration({ ...valid, role: "product_manager" });
  assert.equal(result.ok, true);
  assert.equal(result.value.role, "customer");
});

test("empty body reports every required field", () => {
  const result = validateRegistration({});
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.fields).sort(), ["email", "homeAddress", "name", "password", "taxId"]);
});

test("null body does not crash", () => {
  assert.equal(validateRegistration(null).ok, false);
});

test("tax ID must be 10 or 11 digits", () => {
  for (const taxId of ["123", "123456789012", "12345abcde1"]) {
    assert.ok(validateRegistration({ ...valid, taxId }).fields?.taxId, `rejects ${taxId}`);
  }
  assert.equal(validateRegistration({ ...valid, taxId: "1234567890" }).ok, true);
});

test("invalid email is rejected", () => {
  for (const email of ["onur", "onur@", "onur@example", "on ur@example.com"]) {
    assert.ok(validateRegistration({ ...valid, email }).fields?.email, `rejects ${email}`);
  }
});

test("password rules", () => {
  assert.ok(validateRegistration({ ...valid, password: "abc12" }).fields?.password, "too short");
  assert.ok(validateRegistration({ ...valid, password: "abcdefgh" }).fields?.password, "no digit");
  assert.ok(validateRegistration({ ...valid, password: "12345678" }).fields?.password, "no letter");
  assert.ok(validateRegistration({ ...valid, password: "a1".repeat(37) }).fields?.password, "over 72 bytes");
  assert.equal(validateRegistration({ ...valid, password: "şifre2026" }).ok, true, "Turkish letters allowed");
});
