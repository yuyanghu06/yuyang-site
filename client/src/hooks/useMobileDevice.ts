import { useEffect, useState } from "react";

// ── Cookie helpers ────────────────────────────────────────────────────────────
/** Name of the cookie used to persist the detected device type across page loads */
const COOKIE_NAME = "device_type";

/**
 * Reads the device_type cookie value.
 * Returns "mobile" | "desktop" | undefined (not yet set).
 */
function readDeviceCookie(): "mobile" | "desktop" | undefined {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`),
  );
  const raw = match ? decodeURIComponent(match[1]) : undefined;
  // Only accept known values to guard against cookie tampering
  if (raw === "mobile" || raw === "desktop") return raw;
  return undefined;
}

/**
 * Writes the device_type cookie with a 1-year expiry.
 * SameSite=Lax is safe for same-origin navigation.
 */
function writeDeviceCookie(value: "mobile" | "desktop"): void {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

// ── UA detection ──────────────────────────────────────────────────────────────
/**
 * Detects mobile via navigator.userAgent.
 * Covers iOS, Android, Windows Phone, BlackBerry, and Opera Mini.
 */
function detectMobileFromUA(): boolean {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
/**
 * useMobileDevice — detects whether the current device is mobile.
 *
 * Strategy:
 *   1. On mount, check if the "device_type" cookie already exists.
 *      If so, trust it (avoids UA re-parsing on every render).
 *   2. If the cookie is absent, parse navigator.userAgent, set the cookie,
 *      and update state.
 *
 * Returns { isMobile: boolean }.
 */
export function useMobileDevice(): { isMobile: boolean } {
  // Lazy initializer: attempt cookie read first so the first render matches
  // the hydrated state (no flash of wrong layout).
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof document === "undefined") return false; // SSR guard
    const cookie = readDeviceCookie();
    if (cookie !== undefined) return cookie === "mobile";
    // No cookie yet — fall back to UA on initial render
    return typeof navigator !== "undefined" ? detectMobileFromUA() : false;
  });

  useEffect(() => {
    // After mount, reconcile with cookie (may have been written server-side)
    const cookie = readDeviceCookie();
    if (cookie !== undefined) {
      // Cookie already present — use its value and update state if needed
      const cookieMobile = cookie === "mobile";
      setIsMobile(cookieMobile);
    } else {
      // First visit — detect, persist, and apply
      const mobile = detectMobileFromUA();
      writeDeviceCookie(mobile ? "mobile" : "desktop");
      setIsMobile(mobile);
    }
  }, []); // Runs once on mount — cookie and UA don't change mid-session

  return { isMobile };
}
