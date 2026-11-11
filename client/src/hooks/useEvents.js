import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchEvents } from "../api/events.js";
import { selectEvents } from "../lib/filterEvents.js";
import { DEBOUNCE_MS } from "../config.js";

/** Returns a value that only changes after `delay` ms without changes. */
function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Loads events for the given filters (debounced) and returns only the
 * live + upcoming events that match them.
 */
export function useEvents(filters, { debounceMs = DEBOUNCE_MS } = {}) {
  const debouncedFilters = useDebounced(filters, debounceMs);
  const [raw, setRaw] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    fetchEvents(debouncedFilters, { signal: controller.signal })
      .then((events) => {
        setRaw(events);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Could not load events.");
        setStatus("error");
      });

    return () => controller.abort();
  }, [debouncedFilters, reloadKey]);

  const events = useMemo(
    () => selectEvents(raw, debouncedFilters),
    [raw, debouncedFilters]
  );

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  return { events, status, error, retry };
}
