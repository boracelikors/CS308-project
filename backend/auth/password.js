const bcrypt = require("bcryptjs");

// Cost factor: each +1 doubles the hashing time (12 is a common default)
const SALT_ROUNDS = 12;

// Returns a bcrypt hash that includes its own random salt
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// True only if plainPassword matches the stored hash
async function verifyPassword(plainPassword, storedHash) {
  return bcrypt.compare(plainPassword, storedHash);
}

module.exports = { hashPassword, verifyPassword, SALT_ROUNDS };
