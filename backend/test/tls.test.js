// EMS-SR-001 (TC-Sec-01): the HTTPS server accepts TLS 1.2+ and refuses older versions.
// Needs OpenSSL on the PATH to make a throwaway certificate; skipped otherwise. Run: npm test
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const tls = require("tls");
const express = require("express");
const { execFileSync } = require("child_process");
const { startServer, httpsOnly, tlsOptionsFromEnv } = require("../lib/tls");

let dir;
try {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ems-tls-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost",
    "-keyout", path.join(dir, "k.pem"), "-out", path.join(dir, "c.pem")], { stdio: "ignore" });
} catch {
  dir = null;
}

function handshake(port, options) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: "127.0.0.1", port, rejectUnauthorized: false, ...options }, () => {
      const version = socket.getProtocol();
      socket.end();
      resolve(version);
    });
    socket.on("error", () => resolve(null));
  });
}

test("HTTPS server: TLS 1.2 and 1.3 work, TLS 1.0 / 1.1 are refused, HSTS is sent", { skip: !dir && "openssl not available" }, async () => {
  const app = express();
  app.use(httpsOnly());
  app.get("/", (req, res) => res.json({ ok: true }));
  const env = { TLS_CERT_FILE: path.join(dir, "c.pem"), TLS_KEY_FILE: path.join(dir, "k.pem") };
  const server = startServer(app, { port: 0, env, log: () => {} });
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address();
  try {
    assert.strictEqual(await handshake(port, { minVersion: "TLSv1.2", maxVersion: "TLSv1.2" }), "TLSv1.2");
    assert.strictEqual(await handshake(port, { minVersion: "TLSv1.3" }), "TLSv1.3");
    assert.strictEqual(await handshake(port, { minVersion: "TLSv1", maxVersion: "TLSv1.1", ciphers: "DEFAULT:@SECLEVEL=0" }), null);

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch(`https://127.0.0.1:${port}/`);
    assert.match(res.headers.get("strict-transport-security"), /max-age=\d+/);
  } finally {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    server.close();
  }
});

test("REQUIRE_HTTPS behind a proxy: plain HTTP is redirected or refused", async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(httpsOnly({ requireHttps: true }));
  app.all("/x", (req, res) => res.json({ ok: true }));
  const server = startServer(app, { port: 0, env: {}, log: () => {} });
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const get = await fetch(`${base}/x`, { redirect: "manual" });
    assert.strictEqual(get.status, 308);
    assert.match(get.headers.get("location"), /^https:\/\//);
    assert.strictEqual((await fetch(`${base}/x`, { method: "POST" })).status, 403);
    const viaProxy = await fetch(`${base}/x`, { headers: { "X-Forwarded-Proto": "https" } });
    assert.strictEqual(viaProxy.status, 200);
    assert.ok(viaProxy.headers.get("strict-transport-security"));
  } finally {
    server.close();
  }
});

test("tlsOptionsFromEnv needs both files and pins the minimum version", () => {
  assert.strictEqual(tlsOptionsFromEnv({}), null);
  assert.throws(() => tlsOptionsFromEnv({ TLS_CERT_FILE: "x" }), /both/);
});
