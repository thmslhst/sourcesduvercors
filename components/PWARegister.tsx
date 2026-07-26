"use client";

/**
 * Registers the service worker (production builds only — caching next-dev
 * chunks makes hot reload lie). In dev it actively unregisters any SW left
 * over from a local `next start` on the same port.
 */

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => void reg.unregister()));
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline caching is progressive enhancement; the app still works.
    });
  }, []);
  return null;
}
