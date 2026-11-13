// Checks an email + password for POST /auth/login (SCRUM-23).
// Independent of how the session is stored: the login route calls this and
// then starts the session for the returned user.
const { hashPassword } = require("./password");

// Results:
//   { ok: true, user: { id, name, email, role } }
//   { ok: false, code: "VALIDATION_ERROR", fields }
//   { ok: false, code: "INVALID_CREDENTIALS" }   same for unknown email and wrong password
//   { ok: false, code: "TOO_MANY_ATTEMPTS" }
function createAuthenticator({ findUserByEmail, verifyPassword, limiter, dummyHash }) {
  // An unknown email still runs one bcrypt compare, so the response time does
  // not reveal whether the account exists. The dummy hash is made once, lazily.
  let dummy = dummyHash ? Promise.resolve(dummyHash) : null;
  const getDummyHash = () => (dummy ??= hashPassword("not-a-real-password-1"));

  return async function authenticate(body) {
    const input = body && typeof body === "object" ? body : {};
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";

    const fields = {};
    if (!email) fields.email = "Enter your email address.";
    if (!password) fields.password = "Enter your password.";
    if (Object.keys(fields).length > 0) {
      return { ok: false, code: "VALIDATION_ERROR", fields };
    }

    // Checked before the password, so a blocked email cannot keep guessing
    if (limiter.isBlocked(email)) {
      return { ok: false, code: "TOO_MANY_ATTEMPTS" };
    }

    const user = await findUserByEmail(email);
    const matches = await verifyPassword(password, user ? user.passwordHash : await getDummyHash());
    if (!user || !matches) {
      limiter.recordFailure(email);
      return { ok: false, code: "INVALID_CREDENTIALS" };
    }

    limiter.recordSuccess(email);
    return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, homeAddress: user.homeAddress } };
  };
}

module.exports = { createAuthenticator };
