const express = require("express");
const cors = require("cors");

// Load and validate backend/.env first; stop with a readable message if it is wrong
let config;
try {
  config = require("./config");
} catch (err) {
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

const { db, checkDatabase } = require("./db/knex");
const products = require("./sample-products.json"); // Load the six sample products from Hasan's file
const { createAuthRouter } = require("./auth/registerRoute");
const { errorHandler } = require("./http/errorHandler");

const app = express();

// FRONTEND_ORIGIN may list several origins, comma-separated (Vite dev server and preview)
const allowedOrigins = config.frontendOrigin.split(",").map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins })); // Only allow browser requests from our frontend
app.use(express.json());

// Unchanged: the server process is up
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// New: is the database reachable? Never exposes credentials.
app.get("/health/db", async (req, res) => {
  try {
    await checkDatabase();
    res.json({ status: "ok", database: "up" });
  } catch {
    res.status(503).json({ status: "error", database: "down" });
  }
});

// Return all sample products as a JSON array
app.get("/products", (req, res) => {
  res.json(products);
});

// POST /auth/register (SCRUM-22)
app.use("/auth", createAuthRouter({ db }));

// Must stay after all routes: unhandled errors become { error: { code, message } }
app.use(errorHandler);

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
  await db.destroy();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
