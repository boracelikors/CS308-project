const { Router } = require("express");
const { requireRole } = require("../auth/guards");

const MAX_STOCK = 2147483647;

function validQuantity(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_STOCK;
}

function createInventoryRouter({ db }) {
  const router = Router();
  router.use(requireRole("product_manager"));
  router.patch("/:id/stock", async (req, res) => {
    const id = Number(req.params.id);
    if (!/^[1-9]\d{0,9}$/.test(req.params.id) || id > 4294967295) {
      return res.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." } });
    }
    const { quantity, expectedQuantity } = req.body ?? {};
    if (!validQuantity(quantity) || !validQuantity(expectedQuantity)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter a nonnegative whole stock quantity." } });
    }

    const product = () => db("products").where({ id, is_active: true });
    const changed = await product().where({ quantity_in_stock: expectedQuantity }).update({ quantity_in_stock: quantity });
    if (changed) return res.json({ id, quantityInStock: quantity });

    const current = await product().first("quantity_in_stock");
    if (!current) return res.status(404).json({ error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." } });
    if (current.quantity_in_stock === quantity) return res.json({ id, quantityInStock: quantity });
    return res.status(409).json({
      error: { code: "STOCK_CHANGED", message: "Stock changed since you started editing. Review the latest quantity.", currentQuantity: current.quantity_in_stock },
    });
  });
  return router;
}

module.exports = { createInventoryRouter };
