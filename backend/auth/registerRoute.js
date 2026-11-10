// POST /auth/register (SCRUM-22). Public; creates a customer account, does not log in.
const express = require("express");
const { validateRegistration } = require("./validateRegistration");
const { hashPassword: realHashPassword } = require("./password");
const { createUser: realCreateUser } = require("../users/userStore");

// Dependencies are passed in so tests can replace the database and the slow bcrypt hash
function createRegisterHandler({ createUser, hashPassword }) {
  return async function register(req, res, next) {
    const result = validateRegistration(req.body);
    if (!result.ok) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Some fields are invalid.", fields: result.fields },
      });
    }

    // The plain password goes only to the hash function, never to the database
    const { password, ...profile } = result.value;
    try {
      const passwordHash = await hashPassword(password);
      const user = await createUser({ ...profile, passwordHash });
      return res.status(201).json({ user });
    } catch (err) {
      if (err.code === "EMAIL_TAKEN") {
        return res.status(409).json({
          error: { code: "EMAIL_TAKEN", message: "An account with this email already exists." },
        });
      }
      return next(err);
    }
  };
}

function createAuthRouter({ db }) {
  const router = express.Router();
  router.post(
    "/register",
    createRegisterHandler({
      createUser: (fields) => realCreateUser(db, fields),
      hashPassword: realHashPassword,
    })
  );
  return router;
}

module.exports = { createRegisterHandler, createAuthRouter };
