// DEVELOPMENT ONLY: drop every table and rebuild the schema from migrations.
// Usage: npm run db:reset        (dobby_dev)
//        npm run db:reset:test   (dobby_test)
// Refuses to run in production or against a database not named *_dev / *_test.

const config = require("../config");
const { db } = require("./knex");

async function main() {
  const name = config.db.database;
  if (process.env.NODE_ENV === "production" || !/_(dev|test)$/.test(name)) {
    throw new Error(`Refusing to reset "${name}". Only *_dev or *_test databases can be reset.`);
  }
  const [, rolledBack] = await db.migrate.rollback(undefined, true);
  const [, applied] = await db.migrate.latest();
  console.log(`Reset ${name}: rolled back ${rolledBack.length}, applied ${applied.length} migrations.`);
  if (process.argv.includes("--seed")) {
    const [seeds] = await db.seed.run();
    console.log(`Ran ${seeds.length} seed files.`);
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
