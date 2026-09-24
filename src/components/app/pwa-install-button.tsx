"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/** Shows an explicit install action when the browser has deemed the PWA installable. */
export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const prompt = installPrompt;
  if (!prompt) return null;

  async function install(event: InstallPromptEvent) {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") setInstallPrompt(null);
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
