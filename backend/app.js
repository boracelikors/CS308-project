// Builds the Express app. server.js starts it; database tests start it on a free port.
const express = require("express");
const cors = require("cors");
const { createSessionMiddleware } = require("./auth/session");
const { createAuthRouter } = require("./auth/authRoutes");
const { createCartRouter } = require("./cart/cartRoutes");
const { errorHandler } = require("./http/errorHandler");
const products = require("./sample-products.json"); // Load the six sample products from Hasan's file

function createApp({ db, config, sessionStore }) {
  const app = express();

  // FRONTEND_ORIGIN may list several origins, comma-separated (Vite dev server and preview)
  const allowedOrigins = config.frontendOrigin.split(",").map((origin) => origin.trim());
  // credentials: true lets the frontend send the login cookie with fetch(..., { credentials: "include" })
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(
    createSessionMiddleware({
      secret: config.sessionSecret,
      store: sessionStore,
      secureCookie: config.isProduction,
    })
  );

  // Unchanged: the server process is up
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Is the database reachable? Never exposes credentials.
  app.get("/health/db", async (req, res) => {
    try {
      await db.raw("SELECT 1");
      res.json({ status: "ok", database: "up" });
    } catch {
      res.status(503).json({ status: "error", database: "down" });
    }
  });

  // Return all sample products as a JSON array
  app.get("/products", (req, res) => {
    res.json(products);
  });

  // POST /auth/register (SCRUM-22); POST /auth/login, POST /auth/logout, GET /auth/me (SCRUM-23)
  app.use("/auth", createAuthRouter({ db, secureCookie: config.isProduction }));

  // GET /cart, POST /cart/items, PUT and DELETE /cart/items/:productId (SCRUM-28)
  app.use("/cart", createCartRouter({ db }));

  // Must stay after all routes: unhandled errors become { error: { code, message } }
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
