// Data access for the users table (schema: SCRUM-20, db/migrations/..._create_users.js)

// Inserts a new account and returns only the fields that are safe to send to the client.
// Duplicate emails are rejected by the unique index uq_users_email, so two requests
// registering the same email at the same moment cannot both succeed.
async function createUser(db, { name, email, passwordHash, role, taxId, homeAddress }) {
  try {
    const [id] = await db("users").insert({
      name,
      email,
      password_hash: passwordHash,
      role,
      tax_id: taxId,
      home_address: homeAddress,
    });
    return { id, name, email, role };
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY" && String(err.sqlMessage).includes("uq_users_email")) {
      const taken = new Error("Email already registered");
      taken.code = "EMAIL_TAKEN";
      throw taken;
    }
    throw err;
  }
}

module.exports = { createUser };
