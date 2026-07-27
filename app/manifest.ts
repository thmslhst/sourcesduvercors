import type { MetadataRoute } from "next";

/**
 * PWA manifest (served at /manifest.webmanifest, auto-linked by Next).
 * Installability is the point: the app must open from the home screen on
 * the plateau with zero bars (ROADMAP Phase 3).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sources du Vercors",
    short_name: "Sources",
    description:
      "Les sources d’eau du Vercors : coulent-elles ? Observations partagées par les randonneurs.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#4D794E",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
