// Basic login attempt limiting (SCRUM-23 item 6).
// Counts failed logins per email inside a time window; after maxAttempts
// failures the email is blocked until the window has passed.
// Kept in memory: a server restart clears it, which is fine for this project.

function createLoginLimiter({
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000, // 15 minutes
  now = () => Date.now(), // injectable clock so tests do not have to wait
} = {}) {
  const failures = new Map(); // email -> { count, firstAt }

  function keyFor(email) {
    return String(email ?? "").trim().toLowerCase();
  }

  // Drops the entry if its window is over; returns the live entry or undefined
  function liveEntry(key) {
    const entry = failures.get(key);
    if (entry && now() - entry.firstAt >= windowMs) {
      failures.delete(key);
      return undefined;
    }
    return entry;
  }

  function isBlocked(email) {
    const entry = liveEntry(keyFor(email));
    return Boolean(entry) && entry.count >= maxAttempts;
  }

  function recordFailure(email) {
    const key = keyFor(email);
    const entry = liveEntry(key);
    if (entry) {
      entry.count += 1;
    } else {
      failures.set(key, { count: 1, firstAt: now() });
    }
  }

  // A successful login clears the counter for that email
  function recordSuccess(email) {
    failures.delete(keyFor(email));
  }

  return { isBlocked, recordFailure, recordSuccess };
}

module.exports = { createLoginLimiter };
