// TC-Sec-01 / EMS-SR-001 evidence: which TLS versions does the API accept? (docs/TLS.md)
//   npm run check:tls                                  (defaults: HTTPS on 5000, redirect port 5080)
//   npm run check:tls -- --port 5443 --http-port 5080 --host localhost
// Start the API with HTTPS first (TLS_CERT_FILE / TLS_KEY_FILE set). Works with the self-signed dev certificate.
const tls = require("tls");
const http = require("http");
const https = require("https");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const HOST = arg("host", "127.0.0.1");
const PORT = Number(arg("port", 5000));
const HTTP_PORT = Number(arg("http-port", 5080));

// Offers exactly one TLS version. The security level is lowered on our side so we can really try the
// old versions; otherwise this computer's OpenSSL would refuse to even try TLS 1.0 / 1.1.
function probe(label, version) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: HOST, port: PORT, rejectUnauthorized: false, minVersion: version, maxVersion: version, ciphers: "DEFAULT:@SECLEVEL=0" },
      () => {
        const protocol = socket.getProtocol();
        socket.end();
        resolve({ label, accepted: true, detail: protocol });
      }
    );
    socket.on("error", (error) => resolve({ label, accepted: false, detail: error.code || error.message }));
    socket.setTimeout(5000, () => { socket.destroy(); resolve({ label, accepted: false, detail: "timeout" }); });
  });
}

function get(client, url, options = {}) {
  return new Promise((resolve, reject) => {
    client.get(url, { rejectUnauthorized: false, ...options }, (res) => { res.resume(); resolve(res); }).on("error", reject);
  });
}

async function main() {
  console.log(`EMS API https://${HOST}:${PORT} - TLS version check (EMS-SR-001: TLS 1.2 and newer only)\n`);
  const results = [];
  for (const [label, version] of [["TLS 1.0", "TLSv1"], ["TLS 1.1", "TLSv1.1"], ["TLS 1.2", "TLSv1.2"], ["TLS 1.3", "TLSv1.3"]]) {
    results.push(await probe(label, version));
  }

  if (results.every((r) => !r.accepted && !/PROTOCOL_VERSION/.test(r.detail))) {
    console.error(`Could not connect (${results[0].detail}). Is the API running with HTTPS on port ${PORT}? See docs/TLS.md.`);
    process.exit(2);
  }

  for (const r of results) console.log(`${r.label}  ${r.accepted ? `ACCEPTED (${r.detail})` : `REFUSED  (${r.detail})`}`);
  const ok = !results[0].accepted && !results[1].accepted && results[2].accepted && results[3].accepted;

  const res = await get(https, `https://${HOST}:${PORT}/api/health`);
  console.log(`\nHTTPS GET /api/health -> ${res.statusCode}`);
  console.log(`Strict-Transport-Security: ${res.headers["strict-transport-security"] || "(missing)"}`);

  try {
    const redirect = await get(http, `http://${HOST}:${HTTP_PORT}/api/events`);
    console.log(`\nPlain HTTP port ${HTTP_PORT} -> ${redirect.statusCode} redirect to ${redirect.headers.location}`);
  } catch {
    console.log(`\nPlain HTTP port ${HTTP_PORT}: not listening (set HTTP_REDIRECT_PORT=${HTTP_PORT} to see the redirect)`);
  }

  console.log(`\nResult: ${ok ? "PASS - only TLS 1.2 and 1.3 are accepted" : "FAIL - an old TLS version was accepted, or 1.2/1.3 was refused"}`);
  process.exit(ok ? 0 : 1);
}

main();
