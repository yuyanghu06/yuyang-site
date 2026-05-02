import { useEffect, useState } from "react";

const COOKIE_NAME = "device_type";

function readDeviceCookie(): "mobile" | "desktop" | undefined {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`),
  );
  const raw = match ? decodeURIComponent(match[1]) : undefined;
  if (raw === "mobile" || raw === "desktop") return raw;
  return undefined;
}

function writeDeviceCookie(value: "mobile" | "desktop"): void {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function detectMobileFromUA(): boolean {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

export function useMobileDevice(): { isMobile: boolean } {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof document === "undefined") return false;
    const cookie = readDeviceCookie();
    if (cookie !== undefined) return cookie === "mobile";
    return typeof navigator !== "undefined" ? detectMobileFromUA() : false;
  });

  useEffect(() => {
    const cookie = readDeviceCookie();
    if (cookie !== undefined) {
      setIsMobile(cookie === "mobile");
    } else {
      const mobile = detectMobileFromUA();
      writeDeviceCookie(mobile ? "mobile" : "desktop");
      setIsMobile(mobile);
    }
  }, []);

  return { isMobile };
}
