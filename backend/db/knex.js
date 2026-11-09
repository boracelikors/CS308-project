const knex = require("knex");
const knexfile = require("../knexfile");
const config = require("../config");

// One shared connection pool for the whole app
const db = knex(config.isTest ? knexfile.test : knexfile.development);

// Resolves if MySQL answers, rejects otherwise
async function checkDatabase() {
  await db.raw("SELECT 1");
}

module.exports = { db, checkDatabase };
