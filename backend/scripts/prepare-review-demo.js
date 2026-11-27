// Optional local rehearsal data. Uses the normal registration, payment and delivery APIs.
"use strict";

const { randomUUID } = require("node:crypto");
const { DEV_PRODUCT_MANAGER } = require("../db/seeds/02_dev_accounts");

const buyers = [
  { email: "reviews-buyer@dobby.test", name: "Demo Review Buyer", productId: 10, status: "processing" },
  { email: "reviews-observer@dobby.test", name: "Demo Review Observer", productId: 11, status: "delivered" },
];
const password = "DemoReview2026";

async function prepare() {
  const target = new URL(process.env.DEMO_API_URL || "http://localhost:3001");
  if (process.env.NODE_ENV === "production" || target.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || target.username || target.password) {
    throw new Error("Use a local development API for demo fixtures.");
  }
  const round = process.env.DEMO_ROUND || "";
  if (round && !/^[a-z0-9-]{1,18}$/.test(round)) throw new Error("Use a short lowercase demo round label.");
  const origin = target.origin;
  async function request(method, path, { body, cookie } = {}) {
    const response = await fetch(origin + path, {
      method,
      headers: { ...(body && { "Content-Type": "application/json" }), ...(cookie && { Cookie: cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  function requireStatus(response, status, action) {
    if (response.status !== status) throw new Error(`${action}: ${response.data?.error?.message || response.status}`);
    return response.data;
  }
  const signIn = (email, password) => request("POST", "/auth/login", { body: { email, password } });
  const manager = await signIn(DEV_PRODUCT_MANAGER.email, DEV_PRODUCT_MANAGER.password);
  requireStatus(manager, 200, "Manager sign in. Run the development seeds first");
  if (manager.data.user.role !== "product_manager") throw new Error("Expected the demo product manager.");

  for (const fixture of buyers) {
    const buyer = { ...fixture };
    if (round) buyer.email = buyer.email.replace("@", `-${round}@`);
    let session = await signIn(buyer.email, password);
    if (session.status === 401) {
      requireStatus(await request("POST", "/auth/register", {
        body: { name: buyer.name, taxId: "12345678901", homeAddress: "Fictional Demo Road 12", email: buyer.email, password },
      }), 201, "Register demo buyer");
      session = await signIn(buyer.email, password);
    }
    requireStatus(session, 200, "Buyer sign in");
    if (session.data.user.role !== "customer") throw new Error("Expected a demo customer.");
    const auth = { cookie: session.cookie };
    const previous = requireStatus(await request("GET", "/orders", auth), 200, "Read orders");
    let orderId;
    for (const order of previous.orders) {
      const detail = requireStatus(await request("GET", `/orders/${order.id}`, auth), 200, "Read order");
      if (detail.order.items.some(({ productId }) => productId === buyer.productId)) {
        if (order.status === buyer.status) {
          orderId = order.id;
          break;
        }
        if (buyer.status === "processing" && order.status === "delivered") {
          throw new Error("This buyer can already review the product. Set a new DEMO_ROUND for a fresh rehearsal.");
        }
      }
    }

    if (!orderId) {
      let { cart } = requireStatus(await request("GET", "/cart", auth), 200, "Read cart");
      if (cart.items.length && (cart.items.length !== 1 ||
          cart.items[0].productId !== buyer.productId || cart.items[0].quantity !== 1)) {
        throw new Error(`The demo basket for ${buyer.email} contains other items. Review it before preparing orders.`);
      }
      if (cart.items.length === 0) {
        ({ cart } = requireStatus(await request("POST", "/cart/items", {
          ...auth, body: { productId: buyer.productId, quantity: 1 },
        }), 200, "Add the demo product"));
      }
      const order = requireStatus(await request("POST", "/checkout", {
        ...auth,
        body: {
          requestKey: randomUUID(),
          expectedTotal: cart.subtotal,
          payment: {
            cardholderName: buyer.name,
            cardNumber: "4242424242424242",
            expiryMonth: 12,
            expiryYear: 2099,
            cvc: "123",
          },
        },
      }), 201, "Place test order");
      orderId = order.order.id;
      if (buyer.status === "delivered") {
        for (const status of ["in_transit", "delivered"]) {
          requireStatus(await request("PATCH", `/orders/${orderId}/status`, {
            cookie: manager.cookie, body: { status },
          }), 200, "Advance delivery");
        }
      }
    }
    console.log(`${buyer.email}: order #${orderId}, product #${buyer.productId}, ${buyer.status}`);
  }
}

prepare().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
