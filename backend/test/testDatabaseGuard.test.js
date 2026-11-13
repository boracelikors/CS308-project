// Unit tests for the rule that database tests only touch a *_test database (no database needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const { testDatabaseProblem } = require("../db/testDatabaseGuard");

test("separate dev and test databases are accepted", () => {
  assert.equal(testDatabaseProblem({ dbName: "dobby_dev", testDbName: "dobby_test" }), null);
  assert.equal(testDatabaseProblem({ dbName: "dobby_dev", testDbName: "DOBBY_TEST" }), null);
});

test("a missing test database name is refused", () => {
  assert.match(testDatabaseProblem({ dbName: "dobby_dev", testDbName: undefined }), /DB_NAME_TEST is missing/);
  assert.match(testDatabaseProblem({ dbName: "dobby_dev", testDbName: "" }), /DB_NAME_TEST is missing/);
});

test("a test database whose name does not end with _test is refused", () => {
  for (const testDbName of ["dobby_dev", "dobby", "test_dobby", "dobby_testing", "dobby_test2"]) {
    assert.match(testDatabaseProblem({ dbName: "x", testDbName }), /must end with _test/, testDbName);
  }
});

test("using the development database as the test database is refused", () => {
  assert.match(testDatabaseProblem({ dbName: "dobby_test", testDbName: "dobby_test" }), /both "dobby_test"/);
  assert.match(testDatabaseProblem({ dbName: "Dobby_Test", testDbName: "dobby_test" }), /separate test database/);
});