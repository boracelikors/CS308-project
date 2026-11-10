const ROLES = ["customer", "sales_manager", "product_manager", "support_agent"];

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

// 401 when nobody is logged in
function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return sendError(res, 401, "UNAUTHENTICATED", "Please log in.");
  }
  next();
}

// 401 when not logged in, 403 when logged in with a role that is not allowed
function requireRole(...allowedRoles) {
  // Fail at startup on a typo like "admn", not silently at request time
  for (const role of allowedRoles) {
    if (!ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
  }
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      return sendError(res, 401, "UNAUTHENTICATED", "Please log in.");
    }
    if (!allowedRoles.includes(user.role)) {
      return sendError(res, 403, "FORBIDDEN", "You do not have access to this resource.");
    }
    next();
  };
}

// Ownership is separate from roles: a customer may only touch their own cart/orders
function isOwner(user, ownerId) {
  return Boolean(user) && String(user.id) === String(ownerId);
}

module.exports = { ROLES, requireAuth, requireRole, isOwner };
