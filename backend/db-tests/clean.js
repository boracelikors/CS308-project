// Runs automatically before `npm run test:db` (npm "pretest:db" script).
// Empties dobby_test so every test file starts from the migrations of THIS checkout,
// even if the database was last migrated on a branch with other migration files.
const { db, config, dropAllTables } = require("./support");

dropAllTables()
  .then(() => console.log(`Emptied ${config.db.database} before the database tests.`))
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());