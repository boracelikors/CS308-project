// Unit test for the row -> JSON mapping (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const { toProduct } = require("../products/productStore");

test("toProduct keeps the exact price string and exposes stock", () => {
  const product = toProduct({
    id: 10, name: "Sub", model: "M", serial_number: "S", description: "D", category_id: 3,
    category: "Subwoofers", price: "18749.90", currency: "TRY", quantity_in_stock: 0,
    warranty_status: "2 years", distributor: "X", image: "subwoofer.jpg",
  });
  assert.equal(product.price, "18749.90");
  assert.equal(product.quantityInStock, 0);
  assert.equal(product.inStock, false);
  assert.equal(product.category, "Subwoofers");
  assert.equal(product.serialNumber, "S");
  assert.equal("cost" in product, false); // the cost price is never sent to customers
});