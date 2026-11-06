"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    return subscribeToInstallPrompt(setInstallPrompt);
  }, []);

  const prompt = installPrompt;

  async function install(event: InstallPromptEvent) {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") clearInstallPrompt();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => (prompt ? void install(prompt) : setHelpOpen(true))}
        aria-label="Install Trapezi app"
        title="Install Trapezi"
        className="w-auto px-2.5 min-[375px]:px-3"
      >
        <Download className="size-3.5" />
        <span className="hidden min-[375px]:inline">Install</span>
      </Button>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Install Trapezi</DialogTitle>
            <p className="text-sm text-ink-muted">
              Keep your food map in its own app window, with an icon in your dock or home screen.
            </p>
          </DialogHeader>
          <DialogBody className="space-y-3 text-sm text-ink-soft">
            <p>
              In Brave, open the menu <strong className="text-ink">⋮</strong> and choose
              <strong className="text-ink"> Install Trapezi</strong>. Depending on your version,
              it may appear under <strong className="text-ink">Save and share</strong>.
            </p>
            <p className="rounded-xl bg-surface-muted p-3 text-xs text-ink-muted">
              If it is not listed yet, reload this page once after the app has finished loading.
              Brave only shows its native option after it has checked the manifest and offline support.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={() => setHelpOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
