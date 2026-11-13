const path = require("path");

// Load backend/.env into process.env (quiet: no log line on startup)
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const isTest = process.env.NODE_ENV === "test";
const isProduction = process.env.NODE_ENV === "production";

const REQUIRED = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
if (isTest) REQUIRED.push("DB_NAME_TEST");
// Signs the login cookie (SCRUM-23). Generate one with: openssl rand -hex 32
if (!isTest) REQUIRED.push("SESSION_SECRET");

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // Name the missing keys, never print their values
  throw new Error(
    `Missing required environment variables: ${missing.join(", ")}. ` +
      "Copy backend/.env.example to backend/.env and fill in the values."
  );
}
// Database tests reset every table: refuse to start them against a non-test database
if (isTest) {
  const { testDatabaseProblem } = require("./db/testDatabaseGuard");
  const problem = testDatabaseProblem({ dbName: process.env.DB_NAME, testDbName: process.env.DB_NAME_TEST });
  if (problem) throw new Error(problem);
}
const dbPort = Number(process.env.DB_PORT);
if (!Number.isInteger(dbPort) || dbPort <= 0) {
  throw new Error("DB_PORT must be a positive integer (MySQL default is 3306).");
}

module.exports = {
  isTest,
  isProduction,
  port: Number(process.env.PORT) || 3001,
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173,http://localhost:4173",
  // Database tests never send cookies to a browser, so a fixed secret is fine there
  sessionSecret: process.env.SESSION_SECRET || (isTest ? "test-only-session-secret" : undefined),
  db: {
    host: process.env.DB_HOST,
    port: dbPort,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Tests always use the separate test database
    database: isTest ? process.env.DB_NAME_TEST : process.env.DB_NAME,
  },
};
