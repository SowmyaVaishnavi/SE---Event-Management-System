// EMS-SR-001: make a self-signed certificate for local HTTPS testing (needs OpenSSL).
//   npm run cert:dev   ->  certs/localhost.crt and certs/localhost.key (git-ignored)
// OpenSSL comes with Git for Windows but is not always on the PATH in PowerShell, so the usual
// Git for Windows locations are tried too. Set OPENSSL to the full path of openssl.exe to use another one.
// For a real deployment use a certificate from Let's Encrypt or the hosting provider instead.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CANDIDATES = [
  process.env.OPENSSL,
  "openssl",
  "C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe",
  "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
  "C:\\Program Files (x86)\\Git\\mingw64\\bin\\openssl.exe",
  "C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe",
].filter(Boolean);

// MSYS2_ARG_CONV_EXCL stops Git's bundled OpenSSL from rewriting "/CN=localhost" as a Windows path.
const env = { ...process.env, MSYS2_ARG_CONV_EXCL: "*", MSYS_NO_PATHCONV: "1" };

function findOpenssl() {
  for (const bin of CANDIDATES) {
    try {
      execFileSync(bin, ["version"], { stdio: "ignore", env });
      return bin;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

const openssl = findOpenssl();
if (!openssl) {
  console.error("OpenSSL was not found. Install Git for Windows (it includes OpenSSL) or set OPENSSL to the path of openssl.exe.");
  process.exit(1);
}

const dir = path.join(__dirname, "..", "certs");
fs.mkdirSync(dir, { recursive: true });
const key = path.join(dir, "localhost.key");
const crt = path.join(dir, "localhost.crt");

execFileSync(openssl, [
  "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "365",
  "-keyout", key, "-out", crt,
  "-subj", "/CN=localhost",
  "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
], { stdio: "inherit", env });

console.log(`Created ${path.relative(process.cwd(), crt)} and ${path.relative(process.cwd(), key)}`);
console.log("Add to backend/.env:\n  TLS_CERT_FILE=certs/localhost.crt\n  TLS_KEY_FILE=certs/localhost.key");
