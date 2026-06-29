/**
 * Stealth Router — keeps the browser URL bar permanently at the site root.
 * Internal navigation uses the History API (replaceState / pushState) but the
 * path segment is stored only in the history state object, not in the URL.
 *
 * Special case: PhonePe (and Google OAuth) redirect back with a real URL path
 * like /purchase/success?payment_id=... or /auth/google/callback?code=...
 * On those hard-redirects, we read window.location.pathname to land on the
 * correct page, then immediately mask the URL back to the site root.
 *
 * Uses useSyncExternalStore so ALL components share the same path state and
 * re-render together when navigate() is called — the same pattern wouter's
 * built-in useBrowserLocation uses.
 */

import { useSyncExternalStore } from "react";
import { useCallback } from "react";

const STORAGE_KEY = "__acrozo_route__";

// Paths that PhonePe / Google can redirect to externally.
const EXTERNAL_LANDING_PATHS = [
  "/purchase/success",
  "/payment/mock",
  "/auth/google/callback",
];

// ── Shared external store ────────────────────────────────────────────────────
// All components subscribe to the same set of events so they all re-render
// in sync whenever navigate() fires history.pushState / history.replaceState.

const subscribeToLocationUpdates = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  window.addEventListener("pushState", callback);
  window.addEventListener("replaceState", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("pushState", callback);
    window.removeEventListener("replaceState", callback);
  };
};

// Patch pushState / replaceState once so they fire real events.
// (The browser fires "popstate" for back/forward but NOT for pushState calls.)
const patchKey = Symbol.for("acrozo_router_patched");
if (typeof history !== "undefined" && !(window as any)[patchKey]) {
  for (const type of ["pushState", "replaceState"] as const) {
    const original = history[type].bind(history);
    history[type] = function (...args: Parameters<typeof history.pushState>) {
      const result = original(...args);
      window.dispatchEvent(new Event(type));
      return result;
    };
  }
  Object.defineProperty(window, patchKey, { value: true });
}

// ── Initial path resolution ──────────────────────────────────────────────────

function getInitialPath(): string {
  const realPath = window.location.pathname.replace(/\/$/, "") || "/";
  const realSearch = window.location.search;

  // If PhonePe / OAuth landed us on a real path, honour it then mask the URL.
  for (const landing of EXTERNAL_LANDING_PATHS) {
    if (realPath === landing || realPath.startsWith(landing + "?")) {
      const fullPath = realPath + realSearch;
      history.replaceState({ acrozoPath: fullPath }, "", "/");
      try { sessionStorage.setItem(STORAGE_KEY, fullPath); } catch (_) {}
      return fullPath;
    }
  }

  // Restore last internal route from sessionStorage on hard-refresh.
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch (_) {}

  return "/";
}

// Snapshot function: read the current path from history state (shared across all instances).
function getPathSnapshot(): string {
  return (history.state as any)?.acrozoPath ?? getInitialPath();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useStealthLocation(): [string, (to: string, opts?: { replace?: boolean }) => void] {
  const path = useSyncExternalStore(
    subscribeToLocationUpdates,
    getPathSnapshot,
    () => "/",   // server snapshot (SSR fallback)
  );

  const navigate = useCallback(
    (to: string, opts?: { replace?: boolean }) => {
      const state = { acrozoPath: to };
      if (opts?.replace) {
        history.replaceState(state, "", "/");
      } else {
        history.pushState(state, "", "/");
      }
      try { sessionStorage.setItem(STORAGE_KEY, to); } catch (_) {}
    },
    [],
  );

  return [path, navigate];
}
