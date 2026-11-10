// All /auth routes, wired to the real database (SCRUM-22, SCRUM-23)
const express = require("express");
const { createRegisterHandler } = require("./registerRoute");
const { createLoginHandler, createLogoutHandler, me } = require("./loginRoutes");
const { createAuthenticator } = require("./authenticate");
const { createLoginLimiter } = require("./loginLimiter");
const { hashPassword, verifyPassword } = require("./password");
const { requireAuth } = require("./guards");
const { createUser, findUserByEmail } = require("../users/userStore");

function createAuthRouter({ db, secureCookie = false, limiter = createLoginLimiter() }) {
  const router = express.Router();

  router.post(
    "/register",
    createRegisterHandler({ createUser: (fields) => createUser(db, fields), hashPassword })
  );

  router.post(
    "/login",
    createLoginHandler({
      authenticate: createAuthenticator({
        findUserByEmail: (email) => findUserByEmail(db, email),
        verifyPassword,
        limiter,
      }),
    })
  );

  router.post("/logout", createLogoutHandler({ secureCookie }));
  router.get("/me", requireAuth, me);

  return router;
}

module.exports = { createAuthRouter };
