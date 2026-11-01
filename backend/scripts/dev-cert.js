// EMS-SR-001: make a self-signed certificate for local HTTPS testing (needs OpenSSL, which ships with Git for Windows).
//   npm run cert:dev   ->  certs/localhost.crt and certs/localhost.key (git-ignored)
// For a real deployment use a certificate from Let's Encrypt or the hosting provider instead.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "certs");
fs.mkdirSync(dir, { recursive: true });
const key = path.join(dir, "localhost.key");
const crt = path.join(dir, "localhost.crt");

execFileSync("openssl", [
  "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "365",
  "-keyout", key, "-out", crt,
  "-subj", "/CN=localhost",
  "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
], { stdio: "inherit" });

console.log(`Created ${path.relative(process.cwd(), crt)} and ${path.relative(process.cwd(), key)}`);
console.log("Add to backend/.env:\n  TLS_CERT_FILE=certs/localhost.crt\n  TLS_KEY_FILE=certs/localhost.key");
