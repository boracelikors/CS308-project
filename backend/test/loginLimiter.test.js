const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoginLimiter } = require("../auth/loginLimiter");

// Fake clock: tests move time forward instead of waiting 15 minutes
function fakeClock(start = 0) {
  let time = start;
  return { now: () => time, advance: (ms) => { time += ms; } };
}

const WINDOW = 15 * 60 * 1000;

test("not blocked before reaching the limit", () => {
  const limiter = createLoginLimiter({ maxAttempts: 3 });
  limiter.recordFailure("a@example.com");
  limiter.recordFailure("a@example.com");
  assert.equal(limiter.isBlocked("a@example.com"), false);
});

test("blocked after maxAttempts failures", () => {
  const limiter = createLoginLimiter({ maxAttempts: 3 });
  for (let i = 0; i < 3; i++) limiter.recordFailure("a@example.com");
  assert.equal(limiter.isBlocked("a@example.com"), true);
});

test("email is compared case- and space-insensitively", () => {
  const limiter = createLoginLimiter({ maxAttempts: 2 });
  limiter.recordFailure("A@Example.com");
  limiter.recordFailure("  a@example.com ");
  assert.equal(limiter.isBlocked("a@EXAMPLE.com"), true);
});

test("one email being blocked does not affect another", () => {
  const limiter = createLoginLimiter({ maxAttempts: 1 });
  limiter.recordFailure("a@example.com");
  assert.equal(limiter.isBlocked("a@example.com"), true);
  assert.equal(limiter.isBlocked("b@example.com"), false);
});

test("block expires after the window", () => {
  const clock = fakeClock();
  const limiter = createLoginLimiter({ maxAttempts: 2, windowMs: WINDOW, now: clock.now });
  limiter.recordFailure("a@example.com");
  limiter.recordFailure("a@example.com");
  assert.equal(limiter.isBlocked("a@example.com"), true);
  clock.advance(WINDOW - 1);
  assert.equal(limiter.isBlocked("a@example.com"), true, "still blocked just before the window ends");
  clock.advance(1);
  assert.equal(limiter.isBlocked("a@example.com"), false, "free again once the window is over");
});

test("a failure after the window starts a fresh count", () => {
  const clock = fakeClock();
  const limiter = createLoginLimiter({ maxAttempts: 2, windowMs: WINDOW, now: clock.now });
  limiter.recordFailure("a@example.com");
  clock.advance(WINDOW);
  limiter.recordFailure("a@example.com");
  assert.equal(limiter.isBlocked("a@example.com"), false);
});

test("successful login clears the counter", () => {
  const limiter = createLoginLimiter({ maxAttempts: 2 });
  limiter.recordFailure("a@example.com");
  limiter.recordSuccess("a@example.com");
  limiter.recordFailure("a@example.com");
  assert.equal(limiter.isBlocked("a@example.com"), false);
});
