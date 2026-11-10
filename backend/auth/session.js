// Session cookie settings (SCRUM-23, approved by Yunus: server-side session + HttpOnly cookie)
const session = require("express-session");

const SESSION_COOKIE_NAME = "dobby.sid";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // stay logged in for 7 days

function sessionCookieOptions({ secureCookie }) {
  return {
    httpOnly: true, // JavaScript in the page cannot read the cookie (protects against XSS theft)
    sameSite: "lax", // not sent on cross-site POSTs (CSRF protection); localhost:5173 -> :3001 is same-site
    secure: secureCookie, // HTTPS only in production
    path: "/",
  };
}

function createSessionMiddleware({ secret, store, secureCookie = false }) {
  if (!secret) throw new Error("SESSION_SECRET is required for sessions.");
  return session({
    name: SESSION_COOKIE_NAME,
    secret,
    store, // omitted only in tests (falls back to an in-memory store)
    resave: false,
    saveUninitialized: false, // guests get no session and no cookie
    cookie: { ...sessionCookieOptions({ secureCookie }), maxAge: SESSION_MAX_AGE_MS },
  });
}

module.exports = { SESSION_COOKIE_NAME, sessionCookieOptions, createSessionMiddleware };
