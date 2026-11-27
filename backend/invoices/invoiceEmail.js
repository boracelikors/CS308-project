// Sends the invoice PDF by email and records the outcome (SCRUM-36).
//
// Runs after the checkout transaction has committed, so a mail problem can never undo
// a purchase: the order and the invoice already exist, only email_status changes.
//
// No duplicate sends: before sending, one UPDATE moves the invoice to "sending". Only
// one request can win that UPDATE; every other request (a double click, a second tab,
// a retry while the first is still running) just reads the current state.
const { loadInvoice, loadEmailState } = require("./invoiceStore");
const { renderInvoicePdf } = require("./invoicePdf");
const { mailErrorCode } = require("./invoiceFormat");

// A send that started this long ago and never finished (the server stopped mid-send)
// may be tried again. Shorter than this, it is assumed to still be running.
const STALE_SENDING_MINUTES = 10;

async function claimSend(db, orderId) {
  const changed = await db("invoices")
    .where({ order_id: orderId })
    .andWhere((q) =>
      q.whereIn("email_status", ["pending", "failed"]).orWhere((stale) =>
        stale
          .where("email_status", "sending")
          .andWhereRaw("email_last_attempt_at < NOW() - INTERVAL ? MINUTE", [STALE_SENDING_MINUTES])
      )
    )
    .update({
      email_status: "sending",
      email_attempts: db.raw("email_attempts + 1"),
      email_last_attempt_at: db.fn.now(),
      email_last_error: null,
    });
  return changed === 1;
}

function messageFor(invoice, pdf) {
  return {
    to: invoice.customer.email,
    subject: `Your DOBBY Audophile House invoice ${invoice.number}`,
    text:
      `Hello ${invoice.customer.name},\n\n` +
      `Thank you for your order #${invoice.orderId}. Your invoice ${invoice.number} is attached as a PDF.\n` +
      `Total: ${invoice.total} ${invoice.currency}\n\n` +
      "You can also download it any time from your order page.\n\nDOBBY Audophile House",
    attachments: [{ filename: `${invoice.number}.pdf`, content: pdf, contentType: "application/pdf" }],
  };
}

// Returns the email state ({ status, attempts, ... }) after this call. Never throws for
// mail problems; those are stored as "failed" with a short error code.
async function sendInvoiceEmail(db, mailer, orderId) {
  if (!(await claimSend(db, orderId))) return loadEmailState(db, orderId); // sent, or in progress

  try {
    const invoice = await loadInvoice(db, orderId);
    await mailer.send(messageFor(invoice, await renderInvoicePdf(invoice)));
    await db("invoices")
      .where({ order_id: orderId, email_status: "sending" })
      .update({ email_status: "sent", email_sent_at: db.fn.now() });
  } catch (err) {
    await db("invoices")
      .where({ order_id: orderId, email_status: "sending" })
      .update({ email_status: "failed", email_last_error: mailErrorCode(err) });
  }
  return loadEmailState(db, orderId);
}

module.exports = { sendInvoiceEmail, STALE_SENDING_MINUTES };