// Database queries for the product catalogue (GET /products, GET /products/:id).
// Every value from the request reaches MySQL as a bound parameter (Knex builds
// "WHERE p.category_id = ?"), never by gluing strings into SQL.
const { likePattern, pageCount } = require("./productQuery");

const PRODUCT_COLUMNS = [
  "p.id",
  "p.name",
  "p.model",
  "p.serial_number",
  "p.description",
  "p.category_id",
  "c.name as category",
  "p.price",
  "p.currency",
  "p.quantity_in_stock",
  "p.warranty_status",
  "p.distributor",
  "p.image",
];

// One database row -> the JSON shape sent to the frontend.
// price stays a string ("18749.90") because MySQL DECIMAL comes back as a string;
// converting it to a JS number could change the value (floating point).
function toProduct(row) {
  return {
    id: row.id,
    name: row.name,
    model: row.model,
    serialNumber: row.serial_number,
    description: row.description,
    category: row.category, // kept as the category name: the Sprint 1 cards already show it
    categoryId: row.category_id,
    price: row.price,
    currency: row.currency,
    quantityInStock: row.quantity_in_stock,
    inStock: row.quantity_in_stock > 0, // zero-stock products are listed, but cannot be bought
    warrantyStatus: row.warranty_status,
    distributor: row.distributor,
    image: row.image,
  };
}

// Products that are on sale and match the search and category filters.
// Products taken off sale (is_active = false) are hidden; zero-stock products are not.
function filteredProducts(db, { search, categoryId }) {
  const query = db("products as p")
    .join("categories as c", "c.id", "p.category_id")
    .where("p.is_active", true);

  if (categoryId !== null) {
    query.andWhere("p.category_id", categoryId);
  }
  if (search !== null) {
    // Case-insensitive on any collation: both sides are lowercased
    const pattern = likePattern(search);
    query.andWhere((w) =>
      w.whereRaw("LOWER(p.name) LIKE ?", [pattern]).orWhereRaw("LOWER(p.description) LIKE ?", [pattern])
    );
  }
  return query;
}

// Units sold per product. Every row in orders is a paid order: an order is only
// created after the mock bank approves the payment (checkout flow).
// When cancellations/refunds are added, exclude them here.
function unitsSoldSubquery(db) {
  return db("order_items as oi")
    .join("orders as o", "o.id", "oi.order_id")
    .groupBy("oi.product_id")
    .select("oi.product_id")
    .sum({ units_sold: "oi.quantity" })
    .as("sold");
}

// Applies the chosen sort. The product ID is always the last key, so products
// with the same price or the same sales keep a fixed order across pages.
function applySort(db, query, sort) {
  if (sort === "price_asc") query.orderBy("p.price", "asc");
  if (sort === "price_desc") query.orderBy("p.price", "desc");
  if (sort === "popularity") {
    query.leftJoin(unitsSoldSubquery(db), "sold.product_id", "p.id");
    query.orderByRaw("COALESCE(sold.units_sold, 0) DESC");
  }
  query.orderBy("p.id", "asc");
  return query;
}

// filters: the value returned by parseListQuery
// Returns { items, pagination: { page, pageSize, total, totalPages } }
async function listProducts(db, { search, categoryId, sort, page, pageSize }) {
  const filters = { search, categoryId };

  const countRow = await filteredProducts(db, filters).count({ total: "p.id" }).first();
  const total = Number(countRow.total);

  const rows = await applySort(db, filteredProducts(db, filters).select(PRODUCT_COLUMNS), sort)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    items: rows.map(toProduct),
    pagination: { page, pageSize, total, totalPages: pageCount(total, pageSize) },
  };
}

// One product on sale, or null (unknown ID or taken off sale)
async function getProduct(db, id) {
  const row = await db("products as p")
    .join("categories as c", "c.id", "p.category_id")
    .where({ "p.id": id, "p.is_active": true })
    .first(PRODUCT_COLUMNS);
  return row ? toProduct(row) : null;
}

module.exports = { toProduct, listProducts, getProduct };