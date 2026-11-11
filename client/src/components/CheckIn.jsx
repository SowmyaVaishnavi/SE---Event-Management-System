import React, { useEffect, useRef, useState } from "react";
import { checkInTicket } from "../api/bookings.js";

const CAMERA_OK = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

/** Organizer check-in: scan a ticket QR (camera, where supported) or type the code (EMS-F-019). */
export default function CheckIn() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, message, attendee, ticket }
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  async function submit(value) {
    const ticketCode = (value ?? code).trim();
    setBusy(true);
    setResult(null);
    try {
      const data = await checkInTicket(ticketCode);
      setResult({ ok: true, message: data.message, attendee: data.attendee, ticket: data.ticket });
      setCode("");
    } catch (err) {
      setResult({ ok: false, message: err.message, attendee: err.data?.attendee, ticket: err.data?.ticket });
    } finally {
      setBusy(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    if (!scanning) return undefined;
    let timer;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        timer = setInterval(async () => {
          try {
            const found = await detector.detect(videoRef.current);
            if (found[0]?.rawValue) {
              clearInterval(timer);
              stopCamera();
              setCode(found[0].rawValue);
              submit(found[0].rawValue);
            }
          } catch {
            /* frame not ready yet */
          }
        }, 400);
      } catch {
        setResult({ ok: false, message: "Could not open the camera. Type the ticket code instead." });
        stopCamera();
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <section className="register card" aria-labelledby="checkin-heading">
      <h2 id="checkin-heading">Check-in</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="field">
          <label htmlFor="ticket-code">Ticket code</label>
          <input
            id="ticket-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="EMS-XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            required
          />
        </div>
        <button className="btn" type="submit" disabled={busy || !code.trim()}>
          {busy ? "Checking..." : "Check in"}
        </button>{" "}
        {CAMERA_OK && (
          <button type="button" className="btn btn-secondary" onClick={() => (scanning ? stopCamera() : setScanning(true))} aria-pressed={scanning}>
            {scanning ? "Stop camera" : "Scan with camera"}
          </button>
        )}
      </form>

      {scanning && <video ref={videoRef} className="scan-video" muted playsInline aria-label="Camera preview for scanning a ticket QR code" />}

      <div aria-live="polite">
        {result && (
          <div className={`message ${result.ok ? "" : "error"} checkin-result`} role={result.ok ? "status" : "alert"}>
            <strong>{result.ok ? "✔ " : "✖ "}{result.message}</strong>
            {result.attendee && <div>Attendee: {result.attendee.name} ({result.attendee.email})</div>}
            {result.ticket?.event && <div>Event: {result.ticket.event.title}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
