import type { MetadataRoute } from "next";

/** Lets people add emet to their phone's home screen — on iPhone that is required for phone notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "emet HQ",
    short_name: "emet",
    start_url: "/today",
    display: "standalone",
    background_color: "#08080a",
    theme_color: "#08080a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
