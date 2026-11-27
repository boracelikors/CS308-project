const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { resetTestDatabase, startTestApp, registerCustomer } = require("./support");
const { DEV_PRODUCT_MANAGER } = require("../db/seeds/02_dev_accounts");

const PAYMENT = {
  cardholderName: "Demo Buyer",
  cardNumber: "4242424242424242",
  expiryMonth: 12,
  expiryYear: 2099,
  cvc: "123",
};
let api, alice, bob, manager;

before(async () => {
  await resetTestDatabase();
  api = await startTestApp();
  alice = (await registerCustomer(api, "review-buyer@example.test")).cookie;
  bob = (await registerCustomer(api, "review-observer@example.test")).cookie;
  const response = await api.request("POST", "/auth/login", { body: DEV_PRODUCT_MANAGER });
  assert.equal(response.status, 200);
  manager = response.cookie;
});
after(async () => { await api?.close(); });

const pathFor = (id, suffix = "") => `/products/${id}/reviews${suffix}`;
const read = (id, cookie) => api.request("GET", pathFor(id), { cookie });
const own = (id, cookie) => api.request("GET", pathFor(id, "/me"), { cookie });
const rating = (id, cookie, score) => api.request("PUT", pathFor(id, "/rating"), { cookie, body: { score } });
const comment = (id, cookie, body) => api.request("PUT", pathFor(id, "/comment"), { cookie, body: { body } });
const queue = (cookie = manager) => api.request("GET", "/manager/comments", { cookie });
const decide = ({ id, revision }, status, cookie = manager) =>
  api.request("PATCH", `/manager/comments/${id}`, { cookie, body: { status, revision } });

async function buy(productId, cookie) {
  const add = await api.request("POST", "/cart/items", { cookie, body: { productId, quantity: 1 } });
  assert.equal(add.status, 200);
  const order = await api.request("POST", "/checkout", {
    cookie, body: { requestKey: randomUUID(), expectedTotal: add.body.cart.subtotal, payment: PAYMENT },
  });
  assert.equal(order.status, 201);
  return order.body.order.id;
}

function move(id, status) {
  return api.request("PATCH", `/orders/${id}/status`, { cookie: manager, body: { status } });
}

async function deliver(id) {
  assert.equal((await move(id, "in_transit")).status, 200);
  assert.equal((await move(id, "delivered")).status, 200);
}

test("public summary is empty on an active product and absent for missing IDs", async () => {
  assert.deepEqual((await read(1)).body, { rating: { count: 0, average: null }, comments: [] });
  assert.equal((await read(4294967296)).status, 404);
  assert.equal((await read(4000000000)).status, 404);
});

test("guest, wrong-role, processing, in-transit and other-buyer reviews are rejected", async () => {
  const orderId = await buy(1, alice);
  assert.equal((await own(1, alice)).body.eligible, false);
  assert.equal((await rating(1, undefined, 4)).status, 401);
  assert.equal((await rating(1, manager, 4)).status, 403);
  assert.equal((await rating(1, alice, 4)).body.error.code, "REVIEW_NOT_ELIGIBLE");
  assert.equal((await comment(1, alice, "Too early")).status, 403);
  assert.equal((await move(orderId, "in_transit")).status, 200);
  assert.equal((await rating(1, alice, 4)).status, 403);
  assert.equal((await move(orderId, "delivered")).status, 200);
  assert.equal((await own(1, alice)).body.eligible, true);
  assert.equal((await own(1, bob)).body.eligible, false);
  assert.equal((await comment(1, bob, "Someone else's order")).status, 403);
});

test("ratings publish independently and a buyer's retry does not inflate the count", async () => {
  await deliver(await buy(10, alice));
  assert.equal((await rating(10, alice, "5")).status, 400);
  assert.equal((await rating(10, alice, 4)).status, 200);
  assert.equal((await rating(10, alice, 4)).status, 200);
  assert.equal((await rating(10, alice, 5)).status, 200);
  assert.deepEqual((await read(10)).body, { rating: { count: 1, average: 5 }, comments: [] });
  assert.equal((await own(10, alice)).body.rating, 5);
});

test("a pending comment stays private until approved and exposes no account information", async () => {
  await deliver(await buy(11, alice));
  assert.equal((await comment(11, alice, "   ")).status, 400);
  assert.equal((await comment(11, alice, " Clear vocals. ")).status, 200);
  assert.equal((await own(11, alice)).body.comment.status, "pending");
  assert.equal((await own(11, bob)).body.comment, null);
  assert.deepEqual((await read(11, bob)).body.comments, []);
  assert.equal((await queue(bob)).status, 403);
  const entry = (await queue()).body.comments.find((row) => row.productId === 11);
  assert.equal((await decide(entry, "approved", bob)).status, 403);
  assert.equal((await decide(entry, "approved")).status, 200);
  assert.equal((await comment(11, alice, "Clear vocals.")).body.status, "approved");
  const [published] = (await read(11)).body.comments;
  assert.equal(published.body, "Clear vocals.");
  assert.deepEqual(Object.keys(published).sort(), ["body", "id", "submittedAt"]);
  assert.equal((await decide(entry, "rejected")).status, 409);
});

test("an edited comment requires new moderation and a stale reviewer cannot approve it", async () => {
  await deliver(await buy(2, alice));
  await comment(2, alice, "First draft.");
  const first = (await queue()).body.comments.find((row) => row.productId === 2);
  await decide(first, "approved");
  await comment(2, alice, "Edited copy.");
  assert.deepEqual((await read(2)).body.comments, []);
  assert.equal((await decide(first, "approved")).body.error.code, "COMMENT_CHANGED");
  const updated = (await queue()).body.comments.find((row) => row.productId === 2);
  assert.equal(updated.revision, first.revision + 1);
  const [a, b] = await Promise.all([decide(updated, "rejected"), decide(updated, "rejected")]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal((await own(2, alice)).body.comment.status, "rejected");
  assert.deepEqual((await read(2)).body.comments, []);
});
