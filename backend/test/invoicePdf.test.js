// Unit tests for the invoice PDF and the mail adapter (SCRUM-36). No database needed.
// The PDF is read back with pdf-parse, so the tests check the text a reader would see.
const test = require("node:test");
const assert = require("node:assert/strict");
const { PDFParse } = require("pdf-parse");
const { renderInvoicePdf } = require("../invoices/invoicePdf");
const { createMailer } = require("../invoices/mailer");

// Fictional data with Turkish letters and amounts that go wrong with floats
const INVOICE = {
  number: "INV-2026-000042",
  orderId: 42,
  orderedAt: new Date("2026-11-13T09:00:00Z"),
  issuedAt: new Date("2026-11-13T09:00:00Z"),
  customer: { name: "Şule Çağlar Işık", email: "sule@example.test", taxId: "12345678901" },
  deliveryAddress: "Orta Mah. Üniversite Cad. No:27, Tuzla, İstanbul",
  items: [
    { productName: "Kulaklık Ğ-Serisi", productModel: "HP-660", unitPrice: "18749.90", quantity: 2, lineTotal: "37499.80" },
    { productName: "Kablo", productModel: "C-1", unitPrice: "0.10", quantity: 3, lineTotal: "0.30" },
  ],
  total: "37500.10",
  currency: "TRY",
};

async function pdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

test("the invoice renders as a PDF document", async () => {
  const pdf = await renderInvoicePdf(INVOICE);
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});

test("the PDF shows Turkish names and addresses correctly", async () => {
  const text = await pdfText(await renderInvoicePdf(INVOICE));
  assert.match(text, /Şule Çağlar Işık/);
  assert.match(text, /Üniversite Cad/);
  assert.match(text, /İstanbul/);
  assert.match(text, /Kulaklık Ğ-Serisi/);
});

test("the PDF shows exact line amounts and the stored total", async () => {
  const text = await pdfText(await renderInvoicePdf(INVOICE));
  assert.match(text, /INV-2026-000042/);
  assert.match(text, /18,749\.90 TRY/);
  assert.match(text, /37,499\.80 TRY/);
  assert.match(text, /0\.30 TRY/);
  assert.match(text, /Total\s+37,500\.10 TRY/);
  assert.match(text, /Tax ID: 12345678901/);
});

test("the total printed is the invoice total, not a sum of today's prices", async () => {
  // If the renderer added up lines itself, a stored total of 99.99 could never appear
  const text = await pdfText(await renderInvoicePdf({ ...INVOICE, total: "99.99" }));
  assert.match(text, /Total\s+99\.99 TRY/);
});

test("without SMTP settings the mailer fails with MAIL_NOT_CONFIGURED", async () => {
  const mailer = createMailer(null);
  assert.equal(mailer.configured, false);
  await assert.rejects(mailer.send({ to: "a@example.test" }), { code: "MAIL_NOT_CONFIGURED" });
});