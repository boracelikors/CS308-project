// Last middleware in server.js: turns any unhandled error into the shared error shape.

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  // express.json() could not parse the request body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON." },
    });
  }
  // Details stay in the server log, never in the response
  console.error(err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
  });
}

module.exports = { errorHandler };
