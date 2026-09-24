import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { PwaRegistration } from "@/components/app/pwa-registration";

export const metadata: Metadata = {
  title: {
    default: "Trapezi — where to eat in Cyprus",
    template: "%s · Trapezi",
  },
  description:
    "A personal food discovery and restaurant tracker for Cyprus: save places, remember what you actually liked, and decide where to eat next.",
  applicationName: "Trapezi",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trapezi",
  },
  icons: {
    icon: "/icons/trapezi-icon.svg",
    apple: "/icons/trapezi-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#b8502e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
