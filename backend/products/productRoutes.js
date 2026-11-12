// GET /products and GET /products/:id (catalogue API). Public: guests can browse.
const express = require("express");
const { parseListQuery, parsePositiveInt } = require("./productQuery");
const productStore = require("./productStore");

const NOT_FOUND = { error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." } };

// GET /products keeps the Sprint 1 response shape (a plain JSON array), so the
// existing frontend works unchanged. Pagination metadata travels in these headers.
// app.js lists them in CORS exposedHeaders so browser JavaScript can read them.
const PAGINATION_HEADERS = ["X-Total-Count", "X-Page", "X-Page-Size", "X-Total-Pages"];

function setPaginationHeaders(res, { total, page, pageSize, totalPages }) {
  res.set({
    "X-Total-Count": String(total),
    "X-Page": String(page),
    "X-Page-Size": String(pageSize),
    "X-Total-Pages": String(totalPages),
  });
}

// store is injectable so the HTTP tests can run without a database
function createProductRouter({ db, store = bindStore(db) }) {
  const router = express.Router();

  // GET /products?search=&categoryId=&sort=&page=&pageSize=
  router.get("/", async (req, res) => {
    const parsed = parseListQuery(req.query);
    if (!parsed.ok) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Some query parameters are invalid.", fields: parsed.fields },
      });
    }
    // Express 5 passes a rejected promise (e.g. database down) to the error handler -> 500
    const { items, pagination } = await store.listProducts(parsed.value);
    setPaginationHeaders(res, pagination);
    res.json(items);
  });

  // GET /products/:id
  router.get("/:id", async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (id === null) return res.status(404).json(NOT_FOUND); // "abc" or "-1" can never be a product
    const product = await store.getProduct(id);
    if (!product) return res.status(404).json(NOT_FOUND);
    res.json({ product });
  });

  return router;
}

function bindStore(db) {
  return {
    listProducts: (filters) => productStore.listProducts(db, filters),
    getProduct: (id) => productStore.getProduct(db, id),
  };
}

module.exports = { createProductRouter, PAGINATION_HEADERS };