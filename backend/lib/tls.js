// EMS-SR-001 / EMS-NF-003: TLS 1.2+ for every connection. See docs/TLS.md.
//
// Two ways to run:
//  1. Node terminates TLS itself: set TLS_CERT_FILE and TLS_KEY_FILE. Only TLS 1.2 and 1.3 are accepted.
//     HTTP_REDIRECT_PORT (optional) starts a plain-HTTP listener that only redirects to HTTPS.
//  2. Behind a TLS proxy (Render, Railway, nginx): set TRUST_PROXY=1 and REQUIRE_HTTPS=true.
//     Requests that did not arrive over HTTPS are redirected (GET) or refused.
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const MIN_TLS_VERSION = "TLSv1.2";
const truthy = (v) => ["1", "true", "yes"].includes(String(v || "").toLowerCase());

function tlsOptionsFromEnv(env = process.env) {
  if (!env.TLS_CERT_FILE && !env.TLS_KEY_FILE) return null;
  if (!env.TLS_CERT_FILE || !env.TLS_KEY_FILE) {
    throw new Error("Set both TLS_CERT_FILE and TLS_KEY_FILE to enable HTTPS");
  }
  // Relative paths are relative to the backend folder, wherever the server is started from.
  const read = (file) => fs.readFileSync(path.resolve(__dirname, "..", file));
  return {
    cert: read(env.TLS_CERT_FILE),
    key: read(env.TLS_KEY_FILE),
    minVersion: MIN_TLS_VERSION,
    honorCipherOrder: true,
  };
}

// Strict-Transport-Security on HTTPS responses; redirect or refuse plain HTTP when required.
function httpsOnly({ requireHttps = false } = {}) {
  return (req, res, next) => {
    if (req.secure) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      return next();
    }
    if (!requireHttps) return next();
    if (req.method === "GET" || req.method === "HEAD") {
      return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    }
    return res.status(403).json({ message: "HTTPS is required" });
  };
}

// Starts the API. Returns the main server (HTTPS when TLS is configured).
function startServer(app, { port, env = process.env, log = console.log } = {}) {
  const tlsOptions = tlsOptionsFromEnv(env);

  if (!tlsOptions) {
    if (env.NODE_ENV === "production" && !truthy(env.REQUIRE_HTTPS)) {
      log("WARNING: running plain HTTP in production. Set TLS_CERT_FILE/TLS_KEY_FILE or put the API behind a TLS proxy with REQUIRE_HTTPS=true (EMS-SR-001).");
    }
    return http.createServer(app).listen(port, () => log(`Server running on http://localhost:${port}`));
  }

  const server = https.createServer(tlsOptions, app).listen(port, () =>
    log(`Server running on https://localhost:${port} (minimum ${MIN_TLS_VERSION})`));

  if (env.HTTP_REDIRECT_PORT) {
    http
      .createServer((req, res) => {
        const host = (req.headers.host || "localhost").replace(/:\d+$/, "");
        res.writeHead(308, { Location: `https://${host}${port === 443 ? "" : `:${port}`}${req.url}` });
        res.end();
      })
      .listen(Number(env.HTTP_REDIRECT_PORT), () => log(`HTTP on port ${env.HTTP_REDIRECT_PORT} redirects to HTTPS`));
  }
  return server;
}

module.exports = { MIN_TLS_VERSION, tlsOptionsFromEnv, httpsOnly, startServer, truthy };
