import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SahiSehat",
    short_name: "SahiSehat",
    description: "Lab-tested food, matched to your body.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f6",
    theme_color: "#0b6249",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // PRD D2: appear in the Android share sheet and accept text or a link.
    share_target: { action: "/share", method: "GET", params: { title: "title", text: "text", url: "url" } },
  } as MetadataRoute.Manifest;
}
