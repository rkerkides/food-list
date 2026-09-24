"use client";

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<(prompt: InstallPromptEvent | null) => void>();

export function currentInstallPrompt() {
  return deferredPrompt;
}

export function saveInstallPrompt(prompt: InstallPromptEvent) {
  deferredPrompt = prompt;
  notify();
}

export function clearInstallPrompt() {
  deferredPrompt = null;
  notify();
}

export function subscribeToInstallPrompt(listener: (prompt: InstallPromptEvent | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of listeners) listener(deferredPrompt);
}
