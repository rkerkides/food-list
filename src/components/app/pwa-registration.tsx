"use client";

import { useEffect } from "react";
import { clearInstallPrompt, saveInstallPrompt, type InstallPromptEvent } from "./pwa-install-state";

/** Registers the deliberately small, privacy-safe offline shell after hydration. */
export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installation is optional; the app remains fully usable online without it.
      });
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      saveInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);

  return null;
}
