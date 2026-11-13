// Safety rule for database tests: they drop and rebuild every table, so they may only
// ever touch a dedicated test database, never a teammate's development data.
// Pure function, unit-tested in test/testDatabaseGuard.test.js; config.js calls it.

// Returns a message explaining the problem, or null when the settings are safe.
function testDatabaseProblem({ dbName, testDbName }) {
  if (!testDbName) {
    return "DB_NAME_TEST is missing. Database tests need their own database, e.g. dobby_test.";
  }
  if (!/_test$/i.test(testDbName)) {
    return `DB_NAME_TEST is "${testDbName}". Its name must end with _test (e.g. dobby_test), ` +
      "because database tests delete all data in it.";
  }
  if (dbName && dbName.toLowerCase() === testDbName.toLowerCase()) {
    return `DB_NAME and DB_NAME_TEST are both "${testDbName}". Use a separate test database ` +
      "so tests never reset your development data.";
  }
  return null;
}

module.exports = { testDatabaseProblem };