"use client";

import { useEffect } from "react";

/** Registers the deliberately small, privacy-safe offline shell after hydration. */
export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installation is optional; the app remains fully usable online without it.
    });
  }, []);

  return null;
}
