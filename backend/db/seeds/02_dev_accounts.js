// SCRUM-35: DEVELOPMENT/TEST-ONLY staff account so delivery status changes can be
// demonstrated before the manager dashboard exists. Not a real person or real credentials.
//   email:    pm@dobby.test        (".test" is a reserved, non-routable domain)
//   password: DemoManager2026
// Never runs in production. Safe to run again: an existing account is left unchanged.
const { hashPassword } = require("../../auth/password");

const DEV_PRODUCT_MANAGER = {
  name: "Demo Product Manager",
  email: "pm@dobby.test",
  password: "DemoManager2026",
  role: "product_manager",
};

exports.seed = async function (knex) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo accounts are for development and test databases only.");
  }
  const exists = await knex("users").where({ email: DEV_PRODUCT_MANAGER.email }).first("id");
  if (exists) return;
  await knex("users")
    .insert({
      name: DEV_PRODUCT_MANAGER.name,
      email: DEV_PRODUCT_MANAGER.email,
      password_hash: await hashPassword(DEV_PRODUCT_MANAGER.password),
      role: DEV_PRODUCT_MANAGER.role,
    })
    .onConflict("email")
    .ignore();
};

exports.DEV_PRODUCT_MANAGER = DEV_PRODUCT_MANAGER;
