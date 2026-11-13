// Unit tests for the GET /products query rules (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseListQuery,
  parsePositiveInt,
  likePattern,
  pageCount,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} = require("../products/productQuery");

test("no parameters gives the defaults", () => {
  assert.deepEqual(parseListQuery({}), {
    ok: true,
    value: { search: null, categoryId: null, sort: null, page: 1, pageSize: DEFAULT_PAGE_SIZE },
  });
});

test("all parameters together are accepted", () => {
  const result = parseListQuery({ search: " monitor ", categoryId: "1", sort: "price_desc", page: "2", pageSize: "5" });
  assert.deepEqual(result, {
    ok: true,
    value: { search: "monitor", categoryId: 1, sort: "price_desc", page: 2, pageSize: 5 },
  });
});

test("search is trimmed and an empty search means no search", () => {
  assert.equal(parseListQuery({ search: "  dac  " }).value.search, "dac");
  assert.equal(parseListQuery({ search: "   " }).value.search, null);
  assert.equal(parseListQuery({ search: "" }).value.search, null);
});

test("search longer than 100 characters is rejected", () => {
  assert.equal(parseListQuery({ search: "a".repeat(100) }).ok, true);
  const result = parseListQuery({ search: "a".repeat(101) });
  assert.equal(result.ok, false);
  assert.ok(result.fields.search);
});

test("a repeated parameter (array) is rejected", () => {
  const result = parseListQuery({ search: ["a", "b"], sort: ["price_asc", "price_desc"] });
  assert.equal(result.ok, false);
  assert.ok(result.fields.search);
  assert.ok(result.fields.sort);
});

test("every supported sort is accepted", () => {
  for (const sort of ["price_asc", "price_desc", "popularity"]) {
    assert.equal(parseListQuery({ sort }).value.sort, sort);
  }
});

test("an unknown sort is rejected, including SQL-looking input", () => {
  for (const sort of ["price", "PRICE_ASC", "name", "id; DROP TABLE products", ""]) {
    const result = parseListQuery({ sort });
    assert.equal(result.ok, false, `sort=${sort}`);
    assert.ok(result.fields.sort);
  }
});

test("categoryId must be a positive whole number", () => {
  for (const categoryId of ["0", "-1", "1.5", "abc", "", "01", "1 OR 1=1"]) {
    const result = parseListQuery({ categoryId });
    assert.equal(result.ok, false, `categoryId=${categoryId}`);
    assert.ok(result.fields.categoryId);
  }
});

test("page must be a positive whole number", () => {
  for (const page of ["0", "-2", "x", "2.5", ""]) {
    assert.equal(parseListQuery({ page }).ok, false, `page=${page}`);
  }
});

test("pageSize is limited to 1-50", () => {
  assert.equal(parseListQuery({ pageSize: "1" }).value.pageSize, 1);
  assert.equal(parseListQuery({ pageSize: String(MAX_PAGE_SIZE) }).value.pageSize, MAX_PAGE_SIZE);
  assert.equal(parseListQuery({ pageSize: "51" }).ok, false);
  assert.equal(parseListQuery({ pageSize: "0" }).ok, false);
  assert.equal(parseListQuery({ pageSize: "1000000" }).ok, false);
});

test("several invalid parameters are all reported at once", () => {
  const result = parseListQuery({ categoryId: "x", sort: "y", page: "0", pageSize: "99" });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.fields).sort(), ["categoryId", "page", "pageSize", "sort"]);
});

test("unknown parameters are ignored", () => {
  assert.equal(parseListQuery({ color: "red" }).ok, true);
});

test("parsePositiveInt accepts only plain positive whole numbers", () => {
  assert.equal(parsePositiveInt("7"), 7);
  assert.equal(parsePositiveInt("1234567890"), 1234567890);
  for (const value of ["0", "-7", "7.0", "7a", "", " 7", "99999999999", undefined, 7]) {
    assert.equal(parsePositiveInt(value), null, `value=${value}`);
  }
});

test("likePattern lowercases and escapes LIKE wildcards", () => {
  assert.equal(likePattern("Monitor"), "%monitor%");
  assert.equal(likePattern("100%"), "%100\\%%");
  assert.equal(likePattern("a_b"), "%a\\_b%");
  assert.equal(likePattern("back\\slash"), "%back\\\\slash%");
});

test("pageCount rounds up and is 0 for no results", () => {
  assert.equal(pageCount(0, 20), 0);
  assert.equal(pageCount(14, 20), 1);
  assert.equal(pageCount(14, 5), 3);
  assert.equal(pageCount(15, 5), 3);
});