// Renders an invoice (the object from invoiceStore) as a PDF Buffer (SCRUM-36).
// The PDF is built in memory on every request and never written to disk, so no invoice
// file can end up in a public folder. DejaVu Sans is embedded because the built-in PDF
// fonts cannot print Turkish letters such as ş, ğ, ı and İ.
const PDFDocument = require("pdfkit");
const { formatAmount, formatDate } = require("./invoiceFormat");

const FONT = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const FONT_BOLD = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

const STORE_NAME = "DOBBY Audiophile House";
const LEFT = 50;
const RIGHT = 545; // A4 width (595) minus the margin
// Table columns: product, quantity, unit price, line total
const COLUMNS = [
  { x: LEFT, width: 255, align: "left" },
  { x: 310, width: 45, align: "right" },
  { x: 360, width: 85, align: "right" },
  { x: 450, width: 95, align: "right" },
];

function row(doc, cells, y, font) {
  doc.font(font);
  const heights = cells.map((text, i) =>
    doc.heightOfString(text, { width: COLUMNS[i].width })
  );
  cells.forEach((text, i) => {
    doc.text(text, COLUMNS[i].x, y, { width: COLUMNS[i].width, align: COLUMNS[i].align });
  });
  return y + Math.max(...heights) + 6;
}

function renderInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: LEFT,
      info: { Title: `Invoice ${invoice.number}`, Author: STORE_NAME },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("regular", FONT);
    doc.registerFont("bold", FONT_BOLD);
    const money = (value) => `${formatAmount(value)} ${invoice.currency}`;

    // Header
    doc.font("bold").fontSize(20).text(STORE_NAME, LEFT, 50);
    doc.font("regular").fontSize(9).fillColor("#555555").text("Online audio equipment store");
    doc.fillColor("#000000").font("bold").fontSize(16).text("INVOICE", LEFT, 50, { align: "right" });
    doc.font("regular").fontSize(10);
    doc.text(`Invoice no: ${invoice.number}`, { align: "right" });
    doc.text(`Invoice date: ${formatDate(invoice.issuedAt)}`, { align: "right" });
    doc.text(`Order no: ${invoice.orderId}`, { align: "right" });
    doc.text(`Order date: ${formatDate(invoice.orderedAt)}`, { align: "right" });

    // Buyer and delivery address (snapshots taken at purchase time)
    let y = 150;
    doc.font("bold").fontSize(11).text("Bill to", LEFT, y);
    doc.font("regular").fontSize(10);
    doc.text(invoice.customer.name);
    doc.text(invoice.customer.email);
    if (invoice.customer.taxId) doc.text(`Tax ID: ${invoice.customer.taxId}`);
    doc.font("bold").fontSize(11).text("Deliver to", 310, y);
    doc.font("regular").fontSize(10).text(invoice.deliveryAddress, 310, doc.y, { width: RIGHT - 310 });

    // Items
    y = Math.max(doc.y, 230) + 20;
    doc.fontSize(10);
    y = row(doc, ["Product", "Qty", "Unit price", "Amount"], y, "bold");
    doc.moveTo(LEFT, y - 3).lineTo(RIGHT, y - 3).stroke();
    for (const item of invoice.items) {
      if (y > 740) {
        doc.addPage();
        y = 50;
      }
      const name = item.productModel ? `${item.productName}\n${item.productModel}` : item.productName;
      y = row(doc, [name, String(item.quantity), money(item.unitPrice), money(item.lineTotal)], y, "regular");
    }
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).stroke();

    // Total: the amount that was charged, stored on the order, never recalculated from today's prices
    y += 10;
    doc.font("bold").fontSize(12);
    doc.text("Total", 250, y, { width: 135, align: "right" });
    doc.text(money(invoice.total), 395, y, { width: RIGHT - 395, align: "right" });

    doc.font("regular").fontSize(8).fillColor("#555555");
    doc.text(
      "Paid with the test payment provider of a course project. No real money was charged.",
      LEFT,
      y + 40,
      { width: RIGHT - LEFT }
    );
    doc.end();
  });
}

module.exports = { renderInvoicePdf };