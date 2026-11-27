// Invoice endpoints (SCRUM-36), mounted under /orders next to the order routes:
//   GET  /orders/:id/invoice        invoice data as JSON (includes the email delivery state)
//   GET  /orders/:id/invoice/pdf    the invoice as a PDF download
//   POST /orders/:id/invoice/email  send the email again after a failure
// Access: the customer who owns the order, and sales managers. Everyone else gets
// 401/403, and a missing order looks the same as someone else's order (404).
const express = require("express");
const { requireRole } = require("../auth/guards");
const { parseOrderId } = require("../orders/orderRoutes");
const invoiceStore = require("./invoiceStore");
const { renderInvoicePdf } = require("./invoicePdf");
const { sendInvoiceEmail } = require("./invoiceEmail");

const notFound = (res) => res.status(404).json({ error: { code: "ORDER_NOT_FOUND", message: "Order not found." } });

// store is injectable so the HTTP tests can run without a database
function createInvoiceRouter({ db, mailer, store = bindStore(db, mailer) }) {
  const router = express.Router();
  const allowed = requireRole("customer", "sales_manager");

  // Finds the invoice the logged-in user may see, or answers 404
  const withInvoice = (run) => async (req, res, next) => {
    try {
      const orderId = parseOrderId(req.params.id);
      const invoice = orderId === null ? null : await store.findInvoice(req.session.user, orderId);
      if (!invoice) return notFound(res);
      return await run(invoice, req, res);
    } catch (err) {
      return next(err);
    }
  };

  router.get(
    "/:id/invoice",
    allowed,
    withInvoice(async (invoice, req, res) => res.json({ invoice }))
  );

  router.get(
    "/:id/invoice/pdf",
    allowed,
    withInvoice(async (invoice, req, res) => {
      const pdf = await store.renderPdf(invoice);
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
        "Cache-Control": "private, no-store", // personal data: no shared caches
      });
      return res.send(pdf);
    })
  );

  // Safe to call repeatedly: an invoice that was already sent is not sent again
  router.post(
    "/:id/invoice/email",
    allowed,
    withInvoice(async (invoice, req, res) => res.json({ email: await store.sendEmail(invoice.orderId) }))
  );

  return router;
}

function bindStore(db, mailer) {
  return {
    findInvoice: (user, orderId) => invoiceStore.findInvoiceFor(db, user, orderId),
    renderPdf: (invoice) => renderInvoicePdf(invoice),
    sendEmail: (orderId) => sendInvoiceEmail(db, mailer, orderId),
  };
}

module.exports = { createInvoiceRouter };