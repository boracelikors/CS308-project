// Query-string rules for GET /products and the product ID for GET /products/:id.
// Pure functions (no database), so every rule here is unit-tested in test/productQuery.test.js.

const SORTS = ["price_asc", "price_desc", "popularity"];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;

// "12" -> 12. Anything else (missing, "abc", "0", "-1", "1.5", "007", a repeated parameter) -> null
function parsePositiveInt(value) {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

// A parameter counts as given when it appears in the URL, even if empty (?page=).
// Express turns a repeated parameter (?search=a&search=b) into an array; those are rejected.
function isPresent(value) {
  return value !== undefined;
}

// Returns { ok: true, value } or { ok: false, fields: { param: message } }
// value: { search, categoryId, sort, page, pageSize }  (search/categoryId/sort may be null)
function parseListQuery(query = {}) {
  const fields = {};

  let search = null;
  if (isPresent(query.search)) {
    if (typeof query.search !== "string") {
      fields.search = "search must be a single text value.";
    } else {
      const trimmed = query.search.trim();
      if (trimmed.length > MAX_SEARCH_LENGTH) {
        fields.search = `search must be at most ${MAX_SEARCH_LENGTH} characters.`;
      } else if (trimmed.length > 0) {
        search = trimmed; // an empty search means "no search"
      }
    }
  }

  let categoryId = null;
  if (isPresent(query.categoryId)) {
    categoryId = parsePositiveInt(query.categoryId);
    if (categoryId === null) fields.categoryId = "categoryId must be a positive whole number.";
  }

  let sort = null; // null = default order (product ID ascending)
  if (isPresent(query.sort)) {
    if (typeof query.sort === "string" && SORTS.includes(query.sort)) {
      sort = query.sort;
    } else {
      fields.sort = `sort must be one of: ${SORTS.join(", ")}.`;
    }
  }

  let page = 1;
  if (isPresent(query.page)) {
    page = parsePositiveInt(query.page);
    if (page === null) fields.page = "page must be a positive whole number.";
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  if (isPresent(query.pageSize)) {
    pageSize = parsePositiveInt(query.pageSize);
    if (pageSize === null || pageSize > MAX_PAGE_SIZE) {
      fields.pageSize = `pageSize must be a whole number from 1 to ${MAX_PAGE_SIZE}.`;
    }
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, value: { search, categoryId, sort, page, pageSize } };
}

// LIKE treats % and _ as wildcards; escape them (and the escape character itself)
// so a search for "100%" matches the text "100%" and not "100 anything".
function likePattern(search) {
  const escaped = search.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

// Total pages for the pagination metadata; 0 when there are no results
function pageCount(total, pageSize) {
  return Math.ceil(total / pageSize);
}

module.exports = {
  SORTS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  parsePositiveInt,
  parseListQuery,
  likePattern,
  pageCount,
};