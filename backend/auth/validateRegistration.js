const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Returns { ok: true, value } or { ok: false, fields: { fieldName: message } }
function validateRegistration(body) {
  const input = body && typeof body === "object" ? body : {};
  const fields = {};

  const name = trimmedString(input.name);
  if (name.length < 2 || name.length > 100) {
    fields.name = "Name must be 2-100 characters.";
  }

  const taxId = trimmedString(input.taxId);
  if (!/^\d{10,11}$/.test(taxId)) {
    fields.taxId = "Tax ID must be 10 or 11 digits.";
  }

  const email = trimmedString(input.email).toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    fields.email = "Enter a valid email address.";
  }

  const homeAddress = trimmedString(input.homeAddress);
  if (homeAddress.length < 10 || homeAddress.length > 255) {
    fields.homeAddress = "Home address must be 10-255 characters.";
  }

  // Passwords are not trimmed; bcrypt only uses the first 72 bytes
  const password = typeof input.password === "string" ? input.password : "";
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    fields.password = "Password must be 8-72 characters.";
  } else if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    fields.password = "Password must contain at least one letter and one digit.";
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  // Public registration always creates a customer; any submitted role is ignored
  return { ok: true, value: { name, taxId, email, homeAddress, password, role: "customer" } };
}

module.exports = { validateRegistration };
