const test = require("node:test");
const assert = require("node:assert/strict");
const { requireAuth, requireRole, isOwner } = require("../auth/guards");

// Minimal fake of Express's res object: remembers the status and JSON body
function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

// Runs a middleware and reports whether it called next()
function run(middleware, session) {
  const req = { session };
  const res = fakeRes();
  let passed = false;
  middleware(req, res, () => { passed = true; });
  return { passed, res };
}

const customer = { id: 1, role: "customer" };
const productManager = { id: 2, role: "product_manager" };

test("requireAuth: anonymous request gets 401", () => {
  const { passed, res } = run(requireAuth, {});
  assert.equal(passed, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, "UNAUTHENTICATED");
});

test("requireAuth: request without any session gets 401", () => {
  const { passed, res } = run(requireAuth, undefined);
  assert.equal(passed, false);
  assert.equal(res.statusCode, 401);
});

test("requireAuth: logged-in user passes", () => {
  assert.equal(run(requireAuth, { user: customer }).passed, true);
});

test("requireRole: anonymous request gets 401, not 403", () => {
  const { passed, res } = run(requireRole("product_manager"), {});
  assert.equal(passed, false);
  assert.equal(res.statusCode, 401);
});

test("requireRole: customer at a manager route gets 403", () => {
  const { passed, res } = run(requireRole("product_manager"), { user: customer });
  assert.equal(passed, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "FORBIDDEN");
});

test("requireRole: allowed role passes", () => {
  assert.equal(run(requireRole("product_manager"), { user: productManager }).passed, true);
});

test("requireRole: any of several allowed roles passes", () => {
  const guard = requireRole("sales_manager", "product_manager");
  assert.equal(run(guard, { user: productManager }).passed, true);
});

test("requireRole: unknown role name fails at startup", () => {
  assert.throws(() => requireRole("admn"), /Unknown role/);
});

test("isOwner: only the owning user matches", () => {
  assert.equal(isOwner(customer, 1), true);
  assert.equal(isOwner(customer, "1"), true, "id from URL params is a string");
  assert.equal(isOwner(customer, 2), false);
  assert.equal(isOwner(undefined, 1), false);
});
