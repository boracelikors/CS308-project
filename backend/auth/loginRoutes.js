// POST /auth/login, POST /auth/logout, GET /auth/me (SCRUM-23)
const { SESSION_COOKIE_NAME, sessionCookieOptions } = require("./session");

const LOGIN_ERRORS = {
  VALIDATION_ERROR: { status: 400, message: "Some fields are invalid." },
  // Same message for unknown email and wrong password
  INVALID_CREDENTIALS: { status: 401, message: "Email or password is incorrect." },
  TOO_MANY_ATTEMPTS: { status: 429, message: "Too many failed attempts. Please try again in 15 minutes." },
};

// authenticate: from auth/authenticate.js (injected so tests need no database)
function createLoginHandler({ authenticate }) {
  return async function login(req, res, next) {
    const result = await authenticate(req.body);
    if (!result.ok) {
      const { status, message } = LOGIN_ERRORS[result.code];
      const error = { code: result.code, message };
      if (result.fields) error.fields = result.fields;
      return res.status(status).json({ error });
    }
    // New session ID on login, so an ID set before login cannot be reused (session fixation)
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = result.user;
      req.session.save((saveErr) => (saveErr ? next(saveErr) : res.json({ user: result.user })));
    });
  };
}

// 204 also when nobody was logged in, so the frontend can always call it
function createLogoutHandler({ secureCookie = false } = {}) {
  return function logout(req, res, next) {
    const finish = () => {
      res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions({ secureCookie }));
      res.status(204).end();
    };
    if (!req.session) return finish();
    // Deletes the session on the server, not only the cookie in the browser
    req.session.destroy((err) => (err ? next(err) : finish()));
  };
}

// Use behind requireAuth: answers 401 for guests, otherwise who is logged in
function me(req, res) {
  res.json({ user: req.session.user });
}

module.exports = { createLoginHandler, createLogoutHandler, me };
