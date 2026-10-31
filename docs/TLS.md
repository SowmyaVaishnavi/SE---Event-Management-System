# TLS 1.2+ for all connections (EMS-SR-001, EMS-NF-003)

Owner: Developer. Test case: **TC-Sec-01**, "traffic scan confirms no unencrypted connections".

The system has three network links. Each one must use TLS 1.2 or newer:

| Link | How it is protected |
|------|---------------------|
| Browser to React app | Served over HTTPS by the host (Vercel, Netlify, Render static sites all force HTTPS with TLS 1.2+). |
| Browser / React app to Express API | Either Node serves HTTPS itself (option 1) or a TLS proxy does it (option 2). Code: `backend/lib/tls.js`. |
| Express API to MongoDB | A TLS connection string. MongoDB Atlas requires TLS 1.2+ and `mongodb+srv://` turns TLS on. For a self-hosted MongoDB add `?tls=true`. |

Passwords are also never stored in plaintext (bcrypt, EMS-SR-002, see `backend/lib/passwords.js`).

## Option 1: Node serves HTTPS itself

The API only accepts TLS 1.2 and TLS 1.3 (`minVersion: "TLSv1.2"`). Every HTTPS response carries `Strict-Transport-Security`, so browsers will not fall back to HTTP.

Local demo with a self-signed certificate (OpenSSL comes with Git for Windows):

```bash
cd backend
npm run cert:dev
```

Then add to `backend/.env`:

```
TLS_CERT_FILE=certs/localhost.crt
TLS_KEY_FILE=certs/localhost.key
# optional: a plain-HTTP port that only redirects to HTTPS
HTTP_REDIRECT_PORT=5080
```

Start the API (`npm start`). The log says `Server running on https://localhost:5000 (minimum TLSv1.2)`.
Run the frontend against it:

```bash
cd client
VITE_API_TARGET=https://localhost:5000 npm run dev
```

(PowerShell: `$env:VITE_API_TARGET="https://localhost:5000"; npm run dev`.) The browser warns about the self-signed certificate; that is expected for the local demo only. `certs/` is git-ignored, so keys are never committed.

For a real server use a certificate from Let's Encrypt (certbot) and point `TLS_CERT_FILE` / `TLS_KEY_FILE` at it.

## Option 2: behind a TLS proxy (Render, Railway, Heroku, nginx)

These hosts terminate TLS 1.2+ in front of the app and forward plain HTTP inside their network. Set:

```
TRUST_PROXY=1
REQUIRE_HTTPS=true
```

Then the API trusts the proxy's `X-Forwarded-Proto` header, redirects plain-HTTP `GET` requests to `https://` (`308`), refuses other plain-HTTP requests with `403 { "message": "HTTPS is required" }`, and sends `Strict-Transport-Security`.

If `NODE_ENV=production` and neither option is set, the server logs a warning at startup.

## How to verify (TC-Sec-01)

1. Automated: `cd backend && npm test` runs `test/tls.test.js`. It starts the HTTPS server with a throwaway certificate and checks that TLS 1.2 and 1.3 handshakes work, TLS 1.0/1.1 are refused, HSTS is sent, and that with `REQUIRE_HTTPS` plain HTTP is redirected or refused.
2. Manual, with OpenSSL against a running server:

   ```bash
   openssl s_client -connect localhost:5000 -tls1_1 </dev/null   # must fail (no protocols / handshake failure)
   openssl s_client -connect localhost:5000 -tls1_2 </dev/null   # must succeed: "Protocol  : TLSv1.2"
   openssl s_client -connect localhost:5000 -tls1_3 </dev/null   # must succeed: "Protocol  : TLSv1.3"
   curl -I http://localhost:5080/api/events                      # 308 redirect to https:// (if HTTP_REDIRECT_PORT is set)
   ```

3. Deployed site: run the domain through SSL Labs (`https://www.ssllabs.com/ssltest/`) and check that only TLS 1.2 and 1.3 are listed. For the database, Atlas shows "TLS 1.2" as the minimum under *Network Access / Advanced*.
4. Capture the browser's DevTools Network tab with the *Protocol* / *Security* column: every request is `https`.

Record the result in the Test Plan execution log under TC-Sec-01.
