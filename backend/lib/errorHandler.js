// EMS-NF-003 / SAD 4.4: safe, standard error answers, and no sensitive data in logs.
// Without this, Express's default handler (a) sends a stack trace in the response when NODE_ENV is not
// "production" and (b) prints the failing request, including the raw body, to the server log. A login body
// that is not valid JSON would therefore put the typed password in the log.
// Mount it LAST in server.js: app.use(errorHandler);

const SAFE_MESSAGES = {
  400: "The request could not be read. Check that it is valid JSON.",
  413: "The request is too large.",
  415: "Unsupported content type.",
};

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  // Log only the kind of problem, never err.body, err.stack or the request.
  if (status >= 500) console.error("Unhandled error:", err?.name || "Error");
  res.status(status).json({
    message: status >= 500 ? "Something went wrong. Please try again." : SAFE_MESSAGES[status] || "The request was not accepted.",
  });
}

module.exports = { errorHandler };
