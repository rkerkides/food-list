import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trapezi — your food map",
    short_name: "Trapezi",
    description: "Save Cyprus places, remember the meals you loved, and decide where to eat next.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f3",
    theme_color: "#b8502e",
    orientation: "portrait-primary",
    categories: ["food", "lifestyle", "productivity"],
    icons: [
      {
        src: "/icons/trapezi-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/trapezi-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/trapezi-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
