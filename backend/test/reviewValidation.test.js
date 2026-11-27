const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseId, validScore, parseComment, validDecision } = require("../reviews/reviewRoutes");

test("IDs accept the full unsigned MySQL range", () => {
  assert.equal(parseId("1"), 1);
  assert.equal(parseId("4294967295"), 4294967295);
});
test("IDs reject out-of-range values and noncanonical path syntax", () => {
  for (const input of [1, "", "01", "0", "-1", "1e2", "1.2", "4294967296"]) assert.equal(parseId(input), null);
});
test("ratings accept each integer from one to five", () => {
  for (const score of [1, 2, 3, 4, 5]) assert.equal(validScore(score), true);
});
test("ratings reject coercions, fractions, and out-of-range numbers", () => {
  for (const score of [null, "5", true, 0, 1.2, 6, Infinity]) assert.equal(validScore(score), false);
});
test("comments trim boundary whitespace and preserve text", () => {
  assert.equal(parseComment("  Güzel ses.\nÖneririm.  "), "Güzel ses.\nÖneririm.");
});
test("comment length counts characters the database can store", () => {
  assert.equal(parseComment("🎧".repeat(1000)), "🎧".repeat(1000));
  assert.equal(parseComment("🎧".repeat(1001)), null);
});
test("comments reject blanks and nontext input", () => {
  for (const body of [null, "", "  ", { text: "hi" }, ["hi"]]) assert.equal(parseComment(body), null);
});
test("moderation accepts only a final decision with a positive integer revision", () => {
  assert.equal(validDecision("approved", 1), true);
  assert.equal(validDecision("rejected", 1), true);
  for (const status of ["pending", "", null]) assert.equal(validDecision(status, 1), false);
  for (const revision of [0, 1.2, "1", null, 4294967296]) assert.equal(validDecision("approved", revision), false);
});
