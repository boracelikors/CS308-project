// Invoices end to end over HTTP with real sessions and MySQL (SCRUM-36).
// A fake mailbox replaces SMTP, so no email ever leaves the machine and every
// recipient is a synthetic *.test address. Run with: npm run test:db

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { PDFParse } = require("pdf-parse");
const { db, resetTestDatabase, startTestApp } = require("./support");
const { hashPassword } = require("../auth/password");
const { createApp } = require("../app");
const { createMailer } = require("../invoices/mailer");
const { KnexSessionStore } = require("../auth/sessionStore");
const config = require("../config");

const CARD = { cardholderName: "Şule Çağlar", cardNumber: "4242424242424242", expiryMonth: 12, expiryYear: 2099, cvc: "123" };
const PASSWORD = "secret123";

// Fake mailbox: records messages, or fails like an SMTP server that is down
const mailbox = {
  configured: true,
  sent: [],
  mode: "ok", // "ok" | "fail"
  delayMs: 0,
  async send(message) {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.mode === "fail") {
      throw Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:1025"), { code: "ECONNREFUSED" });
    }
    this.sent.push(message);
  },
};

let api;
let counter = 0;

async function login(email, client = api) {
  const res = await client.request("POST", "/auth/login", { body: { email, password: PASSWORD } });
  assert.equal(res.status, 200);
  return { id: res.body.user.id, email, cookie: res.cookie };
}

async function newCustomer(name = "Şule Çağlar Işık", client = api) {
  counter += 1;
  const email = `invoice${counter}@example.test`;
  const res = await client.request("POST", "/auth/register", {
    body: { name, taxId: "12345678901", email, homeAddress: "Orta Mah. Üniversite Cad. No:27, Tuzla", password: PASSWORD },
  });
  assert.equal(res.status, 201);
  return login(email, client);
}

async function newStaff(role) {
  counter += 1;
  const email = `${role}${counter}@example.test`;
  await db("users").insert({ name: `Demo ${role}`, email, password_hash: await hashPassword(PASSWORD), role });
  return login(email);
}

// Puts products in the cart and pays; returns { order, key, total }
async function buy(customer, lines = [[1, 1]], client = api) {
  for (const [productId, quantity] of lines) {
    const res = await client.request("POST", "/cart/items", { cookie: customer.cookie, body: { productId, quantity } });
    assert.equal(res.status, 200);
  }
  const cart = await client.request("GET", "/cart", { cookie: customer.cookie });
  const key = crypto.randomUUID();
  const body = { requestKey: key, expectedTotal: cart.body.cart.subtotal, payment: CARD };
  const res = await client.request("POST", "/checkout", { cookie: customer.cookie, body });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { order: res.body.order, body };
}

// The email is sent after the checkout answer; wait until it has finished
async function settledEmail(customer, orderId) {
  for (let i = 0; i < 50; i += 1) {
    const res = await api.request("GET", `/orders/${orderId}/invoice`, { cookie: customer.cookie });
    if (!["pending", "sending"].includes(res.body.invoice.email.status)) return res.body.invoice.email;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error("The invoice email did not finish in time.");
}

async function pdfOf(customer, orderId) {
  const res = await fetch(`${api.base}/orders/${orderId}/invoice/pdf`, { headers: { Cookie: customer.cookie } });
  return { status: res.status, headers: res.headers, buffer: Buffer.from(await res.arrayBuffer()) };
}

async function pdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

const invoiceCount = async (orderId) => (await db("invoices").where({ order_id: orderId }).count({ n: "*" }))[0].n;

before(async () => {
  await resetTestDatabase();
  // The demo catalogue has only a few units of each product; these tests buy many
  await db("products").where({ is_active: true }).update({ quantity_in_stock: 1000 });
  api = await startTestApp({ mailer: mailbox });
});

beforeEach(() => {
  mailbox.sent = [];
  mailbox.mode = "ok";
  mailbox.delayMs = 0;
});

after(() => api.close());

test("a paid order gets exactly one invoice built from the order snapshot", async () => {
  const customer = await newCustomer();
  const { order, body } = await buy(customer, [[1, 2], [3, 1]]);
  await settledEmail(customer, order.id);

  const row = await db("invoices").where({ order_id: order.id }).first();
  assert.match(row.invoice_number, new RegExp(`^INV-\\d{4}-${String(order.id).padStart(6, "0")}$`));
  assert.equal(row.total_price, order.total);
  assert.equal(row.customer_name, "Şule Çağlar Işık");
  assert.equal(row.customer_email, customer.email);
  assert.equal(row.delivery_address, order.deliveryAddress);

  // Repeating the same checkout replays the first answer: no second order, invoice or email
  const replay = await api.request("POST", "/checkout", { cookie: customer.cookie, body });
  assert.equal(replay.status, 201);
  assert.equal(replay.body.order.id, order.id);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(await invoiceCount(order.id), 1);
  assert.equal(mailbox.sent.length, 1);
});

test("the database rejects a second invoice for the same order", async () => {
  const customer = await newCustomer();
  const { order } = await buy(customer);
  const first = await db("invoices").where({ order_id: order.id }).first();
  const { id, ...copy } = first;
  await assert.rejects(
    db("invoices").insert({ ...copy, invoice_number: "INV-COPY" }),
    (err) => err.code === "ER_DUP_ENTRY"
  );
});

test("invoice data uses purchase-time prices and buyer details, not today's", async () => {
  const customer = await newCustomer();
  const { order } = await buy(customer, [[2, 1]]);
  await settledEmail(customer, order.id);
  const paidPrice = order.items[0].unitPrice;

  await db("products").where({ id: 2 }).update({ price: "1.00" });
  await db("users").where({ id: customer.id }).update({ name: "Changed Name", home_address: "Somewhere else" });

  const res = await api.request("GET", `/orders/${order.id}/invoice`, { cookie: customer.cookie });
  assert.equal(res.status, 200);
  const { invoice } = res.body;
  assert.equal(invoice.items[0].unitPrice, paidPrice);
  assert.equal(invoice.total, order.total);
  assert.equal(invoice.customer.name, "Şule Çağlar Işık");
  assert.equal(invoice.deliveryAddress, order.deliveryAddress);
  assert.equal(invoice.customer.taxId, "12345678901");
});

test("the owner downloads a readable PDF with the charged total and Turkish names", async () => {
  const customer = await newCustomer();
  const { order } = await buy(customer, [[1, 3]]);
  const pdf = await pdfOf(customer, order.id);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.match(pdf.headers.get("content-disposition"), /^attachment; filename="INV-\d{4}-\d{6}\.pdf"$/);

  const text = await pdfText(pdf.buffer);
  const [whole, fraction] = order.total.split(".");
  const printedTotal = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
  assert.match(text, new RegExp(`Total\\s+${printedTotal.replace(/[.,]/g, "\\$&")} TRY`));
  assert.match(text, /Şule Çağlar Işık/);
  assert.match(text, /Üniversite Cad/);
});

test("other customers, guests and the wrong staff role cannot read an invoice", async () => {
  const owner = await newCustomer();
  const other = await newCustomer("Other Customer");
  const productManager = await newStaff("product_manager");
  const { order } = await buy(owner);

  for (const path of [`/orders/${order.id}/invoice`, `/orders/${order.id}/invoice/pdf`]) {
    const asOther = await fetch(api.base + path, { headers: { Cookie: other.cookie } });
    assert.equal(asOther.status, 404);
    assert.equal((await asOther.json()).error.code, "ORDER_NOT_FOUND");
    assert.equal((await fetch(api.base + path)).status, 401);
    assert.equal((await fetch(api.base + path, { headers: { Cookie: productManager.cookie } })).status, 403);
  }
  const retry = await api.request("POST", `/orders/${order.id}/invoice/email`, { cookie: other.cookie });
  assert.equal(retry.status, 404);
});

test("sales managers can read any customer's invoice", async () => {
  const customer = await newCustomer();
  const salesManager = await newStaff("sales_manager");
  const { order } = await buy(customer);
  const res = await api.request("GET", `/orders/${order.id}/invoice`, { cookie: salesManager.cookie });
  assert.equal(res.status, 200);
  assert.equal(res.body.invoice.orderId, order.id);
  assert.equal((await pdfOf(salesManager, order.id)).status, 200);
});

test("after checkout the customer's mailbox receives the invoice PDF once", async () => {
  const customer = await newCustomer();
  const { order } = await buy(customer, [[4, 1]]);
  const email = await settledEmail(customer, order.id);

  assert.equal(email.status, "sent");
  assert.equal(email.attempts, 1);
  assert.ok(email.sentAt);
  assert.equal(mailbox.sent.length, 1);
  const [message] = mailbox.sent;
  assert.equal(message.to, customer.email);
  assert.equal(message.attachments.length, 1);
  assert.match(message.attachments[0].filename, /^INV-\d{4}-\d{6}\.pdf$/);
  assert.equal(message.attachments[0].contentType, "application/pdf");
  assert.match(await pdfText(message.attachments[0].content), /Şule Çağlar Işık/);

  // Asking again does not send a second copy
  const again = await api.request("POST", `/orders/${order.id}/invoice/email`, { cookie: customer.cookie });
  assert.equal(again.status, 200);
  assert.equal(again.body.email.status, "sent");
  assert.equal(mailbox.sent.length, 1);
});

test("a mail failure keeps the purchase and can be retried without a second order", async () => {
  const customer = await newCustomer();
  const stockBefore = (await db("products").where({ id: 5 }).first("quantity_in_stock")).quantity_in_stock;
  mailbox.mode = "fail";
  const { order } = await buy(customer, [[5, 1]]);

  const failed = await settledEmail(customer, order.id);
  assert.equal(failed.status, "failed");
  assert.equal(failed.lastError, "ECONNREFUSED"); // a code only, no server message
  assert.equal(failed.attempts, 1);
  // The purchase stands: order saved, stock taken, cart emptied
  assert.ok(await db("orders").where({ id: order.id }).first("id"));
  const stockAfter = (await db("products").where({ id: 5 }).first("quantity_in_stock")).quantity_in_stock;
  assert.equal(stockAfter, stockBefore - 1);

  mailbox.mode = "ok";
  const retry = await api.request("POST", `/orders/${order.id}/invoice/email`, { cookie: customer.cookie });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.email.status, "sent");
  assert.equal(retry.body.email.attempts, 2);
  assert.equal(retry.body.email.lastError, null);
  assert.equal(mailbox.sent.length, 1);
  assert.equal(await invoiceCount(order.id), 1);
  const orders = await db("orders").where({ customer_id: customer.id }).count({ n: "*" });
  assert.equal(orders[0].n, 1);
});

test("five retries at the same time send the email only once", async () => {
  const customer = await newCustomer();
  mailbox.mode = "fail";
  const { order } = await buy(customer);
  await settledEmail(customer, order.id);

  mailbox.mode = "ok";
  mailbox.delayMs = 150; // a slow SMTP server keeps the first send busy
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      api.request("POST", `/orders/${order.id}/invoice/email`, { cookie: customer.cookie })
    )
  );
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(mailbox.sent.length, 1);
  const row = await db("invoices").where({ order_id: order.id }).first();
  assert.equal(row.email_status, "sent");
  assert.equal(row.email_attempts, 2);
});

test("a send still in progress is not repeated, but one stuck for 10 minutes is", async () => {
  const customer = await newCustomer();
  const { order } = await buy(customer);
  await settledEmail(customer, order.id);
  mailbox.sent = [];

  // Pretend a send started just now and has not finished
  await db("invoices")
    .where({ order_id: order.id })
    .update({ email_status: "sending", email_sent_at: null, email_last_attempt_at: db.fn.now() });
  let res = await api.request("POST", `/orders/${order.id}/invoice/email`, { cookie: customer.cookie });
  assert.equal(res.body.email.status, "sending");
  assert.equal(mailbox.sent.length, 0);

  // The server stopped in the middle of a send 11 minutes ago
  await db("invoices")
    .where({ order_id: order.id })
    .update({ email_last_attempt_at: db.raw("NOW() - INTERVAL 11 MINUTE") });
  res = await api.request("POST", `/orders/${order.id}/invoice/email`, { cookie: customer.cookie });
  assert.equal(res.body.email.status, "sent");
  assert.equal(mailbox.sent.length, 1);
});

test("an order paid before invoices existed gets one invoice on first request", async () => {
  const customer = await newCustomer();
  const { order } = await buy(customer);
  await settledEmail(customer, order.id);
  await db("invoices").where({ order_id: order.id }).del(); // as if paid before this migration

  const [a, b] = await Promise.all([
    api.request("GET", `/orders/${order.id}/invoice`, { cookie: customer.cookie }),
    api.request("GET", `/orders/${order.id}/invoice`, { cookie: customer.cookie }),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.invoice.number, b.body.invoice.number);
  assert.equal(a.body.invoice.total, order.total);
  assert.equal(await invoiceCount(order.id), 1);
});

test("without a mail server nothing is sent: the email stays pending and a retry says why", async () => {
  // A second app on the same database, with no SMTP settings (the default for teammates)
  const app = createApp({
    db,
    config,
    sessionStore: new KnexSessionStore({ db, cleanupIntervalMs: 0 }),
    mailer: createMailer(null),
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  const noMail = {
    async request(method, path, { body, cookie } = {}) {
      const res = await fetch(base + path, {
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      return {
        status: res.status,
        body: text ? JSON.parse(text) : null,
        cookie: res.headers.get("set-cookie")?.split(";")[0] ?? null,
      };
    },
  };
  try {
    const customer = await newCustomer("Şule Çağlar Işık", noMail);
    const { order } = await buy(customer, [[1, 1]], noMail);
    await new Promise((r) => setTimeout(r, 100));

    const invoice = await noMail.request("GET", `/orders/${order.id}/invoice`, { cookie: customer.cookie });
    assert.equal(invoice.body.invoice.email.status, "pending");
    assert.equal(invoice.body.invoice.email.attempts, 0);

    const retry = await noMail.request("POST", `/orders/${order.id}/invoice/email`, { cookie: customer.cookie });
    assert.equal(retry.body.email.status, "failed");
    assert.equal(retry.body.email.lastError, "MAIL_NOT_CONFIGURED");
    assert.equal(await invoiceCount(order.id), 1);
    assert.equal(mailbox.sent.length, 0);
  } finally {
    await new Promise((r) => server.close(r));
  }
});