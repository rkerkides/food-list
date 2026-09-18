import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Trapezi — where to eat in Cyprus",
    template: "%s · Trapezi",
  },
  description:
    "A personal food discovery and restaurant tracker for Cyprus: save places, remember what you actually liked, and decide where to eat next.",
  applicationName: "Trapezi",
};

export const viewport: Viewport = {
  themeColor: "#faf7f3",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
