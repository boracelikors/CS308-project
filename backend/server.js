// Load and validate backend/.env first; stop with a readable message if it is wrong
let config;
try {
  config = require("./config");
} catch (err) {
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

const { db, checkDatabase } = require("./db/knex");
const { KnexSessionStore } = require("./auth/sessionStore");
const { createApp } = require("./app");

// Login sessions live in the MySQL "sessions" table (run npm run migrate first)
const sessionStore = new KnexSessionStore({ db });
const app = createApp({ db, config, sessionStore });

const server = app.listen(config.port, async () => {
  console.log(`Backend running on http://localhost:${config.port}`);
  try {
    await checkDatabase();
    console.log(`Database ready (${config.db.database})`);
  } catch (err) {
    console.error(
      `Database NOT reachable (${err.code || "unknown error"}). ` +
        "Is MySQL running? Check the DB_* values in backend/.env."
    );
  }
});

// Close the HTTP server and the connection pool cleanly on Ctrl+C
async function shutdown() {
  server.close();
  sessionStore.close();
  await db.destroy();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
