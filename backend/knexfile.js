const config = require("./config");

// Shared settings for every environment
const base = {
  client: "mysql2",
  connection: { ...config.db, charset: "utf8mb4" },
  pool: { min: 0, max: 10 },
  migrations: {
    directory: "./db/migrations",
    tableName: "knex_migrations", // Knex records applied migrations here
  },
  seeds: {
    directory: "./db/seeds",
  },
};

// config.js already picks dobby_dev or dobby_test based on NODE_ENV
module.exports = {
  development: base,
  test: base,
};
