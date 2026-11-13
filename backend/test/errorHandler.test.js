// Unit tests for the shared error mapping (http/errorHandler.js): every route relies on it
// to turn unexpected failures into { error: { code, message } } without leaking details.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { errorHandler } = require("../http/errorHandler");

async function startApp(t, route) {
  const app = express();
  app.use(express.json());
  app.post("/thing", route);
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  t.after(() => new Promise((r) => server.close(r)));
  return (body, contentType = "application/json") =>
    fetch(`http://localhost:${server.address().port}/thing`, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
    });
}

function silenceConsole(t) {
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  t.after(() => {
    console.error = original;
  });
  return logged;
}

test("malformed JSON is 400 VALIDATION_ERROR, not 500", async (t) => {
  const post = await startApp(t, (req, res) => res.json({ ok: true }));
  const res = await post('{"broken": ');
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), {
    error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON." },
  });
});

test("an unexpected error is 500 INTERNAL_ERROR with a generic message and is logged", async (t) => {
  const logged = silenceConsole(t);
  const post = await startApp(t, () => {
    throw new Error("ER_ACCESS_DENIED_ERROR: Access denied for user 'dobby_app'");
  });
  const res = await post("{}");
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.deepEqual(body, {
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  });
  assert.equal(JSON.stringify(body).includes("dobby_app"), false); // no internals in the response
  assert.equal(logged.length, 1); // but the real error is in the server log
});

test("a rejected promise in an async route is caught too (Express 5)", async (t) => {
  silenceConsole(t);
  const post = await startApp(t, async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:3306");
  });
  const res = await post("{}");
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error.code, "INTERNAL_ERROR");
});

test("an error after the response started is passed on instead of sending a second response", () => {
  const err = new Error("late failure");
  let passedOn = null;
  const res = {
    headersSent: true,
    status: () => assert.fail("must not set a status"),
    json: () => assert.fail("must not send a body"),
  };
  errorHandler(err, {}, res, (e) => {
    passedOn = e;
  });
  assert.equal(passedOn, err);
});