"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import {
  clearInstallPrompt,
  currentInstallPrompt,
  subscribeToInstallPrompt,
  type InstallPromptEvent,
} from "./pwa-install-state";

/** Shows an explicit install action when the browser has deemed the PWA installable. */
export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(currentInstallPrompt);

  useEffect(() => {
    return subscribeToInstallPrompt(setInstallPrompt);
  }, []);

  const prompt = installPrompt;
  if (!prompt) return null;

  async function install(event: InstallPromptEvent) {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") clearInstallPrompt();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={() => void install(prompt)}
      aria-label="Install Trapezi app"
      title="Install Trapezi"
      className="sm:w-auto sm:px-3"
    >
      <Download className="size-3.5" />
      <span className="hidden sm:inline">Install</span>
    </Button>
  );
}
